import { NextRequest } from "next/server";

const UA = "MasterResearch mrodriguezgarcia715@gmail.com";
const MAX_DOC_BYTES = 15 * 1024 * 1024; // 15 MB

// Cache en memoria: evita re-descargar el JSON de tickers (3 MB) en cada petición
let tickerCache: Record<string, { cik: string; title: string }> | null = null;

async function getTickerMap(): Promise<Record<string, { cik: string; title: string }>> {
  if (tickerCache) return tickerCache;

  const res = await fetch("https://www.sec.gov/files/company_tickers.json", {
    headers: { "User-Agent": UA },
  });
  if (!res.ok) throw new Error("No se pudo descargar el listado de tickers del SEC.");

  const raw = (await res.json()) as Record<
    string,
    { cik_str: number; ticker: string; title: string }
  >;

  const map: Record<string, { cik: string; title: string }> = {};
  for (const entry of Object.values(raw)) {
    map[entry.ticker.toUpperCase()] = {
      cik: String(entry.cik_str).padStart(10, "0"),
      title: entry.title,
    };
  }
  tickerCache = map;
  return map;
}

// ── Helpers de extracción ────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x[\da-fA-F]+;/g, " ")
    .replace(/&#\d+;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extraerSeccion(texto: string, itemInicio: string, itemFin: string): string {
  // Coincide con: "Item 1.", "ITEM 1A.", "Item 1 —", etc.
  const reInicio = new RegExp(`\\bitem\\s+${itemInicio}[.\\s—–\\-]`, "gi");
  const reFin = new RegExp(`\\bitem\\s+${itemFin}[.\\s—–\\-]`, "i");

  // Recoge TODAS las ocurrencias del marcador de inicio
  // (la primera suele ser la tabla de contenidos; la que tiene más texto es la sección real)
  const coincidencias: string[] = [];
  let m: RegExpExecArray | null;

  while ((m = reInicio.exec(texto)) !== null) {
    const startIdx = m.index;
    const resto = texto.slice(startIdx + 20);
    const idxFin = resto.search(reFin);

    const seccion =
      idxFin > 0
        ? texto.slice(startIdx, startIdx + 20 + idxFin)
        : texto.slice(startIdx, startIdx + 20000);

    coincidencias.push(seccion.slice(0, 8000).trim());
  }

  if (coincidencias.length === 0) return "Sección no encontrada en el documento.";

  // La entrada del TOC tendrá pocos caracteres; elegimos la sección más larga
  return coincidencias.reduce((prev, curr) =>
    curr.length > prev.length ? curr : prev
  );
}

// ── Handler SSE ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) {
    return new Response(JSON.stringify({ error: "Ticker requerido" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // cliente desconectado
        }
      };

      try {
        // ── 1. Buscar empresa ──
        send({ tipo: "estado", mensaje: "Buscando empresa..." });

        const mapaT = await getTickerMap();
        const entrada = mapaT[ticker];

        if (!entrada) {
          send({
            tipo: "error",
            mensaje: `No se encontró "${ticker}" en el registro del SEC. Verifica que el ticker sea correcto.`,
          });
          controller.close();
          return;
        }

        const { cik, title: nombre } = entrada;
        send({ tipo: "empresa", nombre, cik: parseInt(cik) });

        // ── 2. Obtener submissions → encontrar 10-K más reciente ──
        send({ tipo: "estado", mensaje: "Buscando 10-K más reciente..." });

        const subRes = await fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
          headers: { "User-Agent": UA },
        });
        if (!subRes.ok) {
          send({ tipo: "error", mensaje: "No se pudieron obtener los reportes del SEC." });
          controller.close();
          return;
        }

        const subs = await subRes.json();
        const recent = subs.filings.recent;
        const forms = recent.form as string[];
        const dates = recent.filingDate as string[];
        const accessions = recent.accessionNumber as string[];

        let filing10K: { accession: string; fecha: string; accessionClean: string } | null = null;
        for (let i = 0; i < forms.length; i++) {
          if (forms[i] === "10-K") {
            filing10K = {
              accession: accessions[i],
              fecha: dates[i],
              accessionClean: accessions[i].replace(/-/g, ""),
            };
            break;
          }
        }

        if (!filing10K) {
          send({
            tipo: "error",
            mensaje: "No se encontró un reporte 10-K para esta empresa en el SEC.",
          });
          controller.close();
          return;
        }
        send({ tipo: "filing", accession: filing10K.accession, fecha: filing10K.fecha });

        // ── 3. Obtener índice del filing para encontrar el documento principal ──
        send({ tipo: "estado", mensaje: "Descargando 10-K más reciente..." });

        const cikNum = parseInt(cik);
        const indexUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${filing10K.accessionClean}/index.json`;

        const indexRes = await fetch(indexUrl, { headers: { "User-Agent": UA } });
        if (!indexRes.ok) {
          send({ tipo: "error", mensaje: "No se pudo acceder al índice del reporte 10-K." });
          controller.close();
          return;
        }

        const indexData = await indexRes.json();
        const archivos = indexData.directory.item as Array<{
          name: string;
          type: string;
          size: string;
        }>;

        // Prioridad: tipo "10-K" + extensión htm/html; si no, cualquier htm/html
        const docPrincipal =
          archivos.find(
            (f) =>
              f.type === "10-K" &&
              (f.name.endsWith(".htm") || f.name.endsWith(".html"))
          ) ||
          archivos.find(
            (f) =>
              (f.name.endsWith(".htm") || f.name.endsWith(".html")) &&
              !f.name.toLowerCase().includes("ex") &&
              !f.name.toLowerCase().includes("exhibit")
          ) ||
          archivos.find((f) => f.name.endsWith(".htm") || f.name.endsWith(".html"));

        if (!docPrincipal) {
          send({
            tipo: "error",
            mensaje: "No se encontró el documento HTML principal del 10-K en el índice.",
          });
          controller.close();
          return;
        }

        const docUrl = `https://www.sec.gov/Archives/edgar/data/${cikNum}/${filing10K.accessionClean}/${docPrincipal.name}`;
        send({ tipo: "documento", url: docUrl, nombre: docPrincipal.name });

        // ── 4. Descargar documento con límite de tamaño ──
        const docRes = await fetch(docUrl, { headers: { "User-Agent": UA } });
        if (!docRes.ok) {
          send({ tipo: "error", mensaje: "No se pudo descargar el documento 10-K." });
          controller.close();
          return;
        }

        send({ tipo: "estado", mensaje: "Extrayendo información..." });

        const reader = docRes.body!.getReader();
        const trozos: Uint8Array[] = [];
        let totalBytes = 0;

        while (totalBytes < MAX_DOC_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          trozos.push(value);
          totalBytes += value.length;
        }
        await reader.cancel();

        // Fusionar trozos en un solo buffer
        const buffer = new Uint8Array(totalBytes);
        let offset = 0;
        for (const trozo of trozos) {
          buffer.set(trozo, offset);
          offset += trozo.length;
        }

        const html = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
        const texto = stripHtml(html);

        // ── 5. Extraer secciones ──
        const item1 = extraerSeccion(texto, "1", "1a");
        const item1a = extraerSeccion(texto, "1a", "1b");
        const item7 = extraerSeccion(texto, "7", "7a");

        send({
          tipo: "items",
          items: {
            item1: { titulo: "Item 1 — Descripción del Negocio", contenido: item1 },
            item1a: { titulo: "Item 1A — Factores de Riesgo", contenido: item1a },
            item7: {
              titulo: "Item 7 — Discusión y Análisis del Management (MD&A)",
              contenido: item7,
            },
          },
        });

        send({ tipo: "completo" });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error interno del servidor";
        send({ tipo: "error", mensaje: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
