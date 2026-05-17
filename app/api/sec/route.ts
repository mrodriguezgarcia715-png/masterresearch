import { NextRequest } from "next/server";
import { jsonResponse } from "../_lib/json";

const UA = "MasterResearch mrodriguezgarcia715@gmail.com";
const NA = "Informacion no disponible";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

async function secFetch(url: string): Promise<Response> {
  return fetch(url, { headers: { "User-Agent": UA }, cache: "no-store" });
}

// ── Ticker → CIK ─────────────────────────────────────────────────────────────

let tickerCache: Record<string, { cik: string; title: string }> | null = null;

async function getCik(ticker: string): Promise<{ cik: string; title: string } | null> {
  if (!tickerCache) {
    const res = await secFetch("https://www.sec.gov/files/company_tickers.json");
    if (!res.ok) return null;
    const raw = (await res.json()) as Record<
      string,
      { cik_str: number; ticker: string; title: string }
    >;
    const map: Record<string, { cik: string; title: string }> = {};
    for (const e of Object.values(raw)) {
      map[e.ticker.toUpperCase()] = {
        cik: String(e.cik_str).padStart(10, "0"),
        title: e.title,
      };
    }
    tickerCache = map;
  }
  return tickerCache[ticker.toUpperCase()] ?? null;
}

// ── Buscar filing más reciente por form type ──────────────────────────────────

type FilingRef = { accession: string; fecha: string; accessionClean: string };

async function getLatestFiling(cik: string, formType: string): Promise<FilingRef | null> {
  const res = await secFetch(`https://data.sec.gov/submissions/CIK${cik}.json`);
  if (!res.ok) return null;
  const subs = await res.json();
  const recent = subs.filings.recent;
  const forms = recent.form as string[];
  const dates = recent.filingDate as string[];
  const accessions = recent.accessionNumber as string[];

  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === formType) {
      return {
        accession: accessions[i],
        fecha: dates[i],
        accessionClean: accessions[i].replace(/-/g, ""),
      };
    }
  }
  // Si no está en el bloque reciente, probar en archivos adicionales
  if (subs.filings.files) {
    for (const file of subs.filings.files as Array<{ name: string }>) {
      const r2 = await secFetch(`https://data.sec.gov/submissions/${file.name}`);
      if (!r2.ok) continue;
      const extra = await r2.json();
      const fs = extra.form as string[];
      const ds = extra.filingDate as string[];
      const as2 = extra.accessionNumber as string[];
      for (let i = 0; i < fs.length; i++) {
        if (fs[i] === formType) {
          return {
            accession: as2[i],
            fecha: ds[i],
            accessionClean: as2[i].replace(/-/g, ""),
          };
        }
      }
    }
  }
  return null;
}

// ── Obtener documento principal HTML de un filing ────────────────────────────

async function getDocHtml(cikNum: number, ac: string): Promise<string | null> {
  const indexRes = await secFetch(
    `https://www.sec.gov/Archives/edgar/data/${cikNum}/${ac}/index.json`
  );
  if (!indexRes.ok) return null;
  const idx = await indexRes.json();
  const archivos = idx.directory.item as Array<{ name: string; type: string }>;

  const doc =
    archivos.find(
      (f) => (f.type === "DEF 14A" || f.type === "10-K") &&
        (f.name.endsWith(".htm") || f.name.endsWith(".html"))
    ) ||
    archivos.find(
      (f) =>
        (f.name.endsWith(".htm") || f.name.endsWith(".html")) &&
        !f.name.toLowerCase().includes("ex") &&
        !f.name.toLowerCase().includes("exhibit")
    );
  if (!doc) return null;

  const docRes = await secFetch(
    `https://www.sec.gov/Archives/edgar/data/${cikNum}/${ac}/${doc.name}`
  );
  if (!docRes.ok) return null;
  // Leer hasta 8 MB
  const reader = docRes.body!.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < 8 * 1024 * 1024) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  await reader.cancel();
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

// ── Parsear DEF 14A ───────────────────────────────────────────────────────────

type Director = { nombre: string; cargo: string };
type CompensacionCEO = { nombre: string; total: string };
type ClaseAccion = { clase: string; descripcion: string };
type Accionista = { nombre: string; porcentaje: string; acciones: string };

function parseDef14a(texto: string) {
  // ── Directores ──
  const directores: Director[] = [];
  // Buscar tabla de directores: nombres seguidos de cargos típicos
  const cargosRe =
    /([A-Z][a-z]+(?:\s+[A-Z][a-z\.]+){1,4})\s{1,10}((?:Chief|President|Chair|Director|Officer|Independent|Executive)[^,\n]{0,60})/g;
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = cargosRe.exec(texto)) !== null && directores.length < 15) {
    const nombre = m[1].trim();
    const cargo = m[2].trim().replace(/\s+/g, " ").slice(0, 80);
    if (!seen.has(nombre) && nombre.length > 4) {
      seen.add(nombre);
      directores.push({ nombre, cargo });
    }
  }

  // ── CEO y compensación ──
  const compCEO: CompensacionCEO = { nombre: NA, total: NA };

  // Palabras que nunca son nombre de persona
  const NO_NOMBRE = /^(Total|Target|Base|Annual|Long|Named|Summary|Compensation|Plan|Equity|Cash|Grant|Award|Proxy|Notice|Meeting|Vote|Board|Committee|Pension|Benefit|Value|Amount|Number|Shares|Stock|Fiscal|Year|Table|Section|Item|Form|The|Our|We|This|These|None|No)\b/i;

  // Elimina palabras de cargo/rol y devuelve solo el nombre propio (Nombre Apellido)
  function limpiarNombre(raw: string): string {
    const ROLES = /\b(None|No|Chief|Executive|Officer|President|Vice|Senior|Director|Chair(?:man|person)?|Independent|Principal|Founder|Lead|General|Counsel|Financial|Operating|Technology|Marketing|Legal|Human|Resources|Compliance|Corporate|Head|Managing|and|since|Key|Skills|Qualifications)\b/gi;
    const cleaned = raw
      .replace(ROLES, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
    const m = cleaned.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/);
    return m ? m[1] : "";
  }

  // Estrategia 1: iterar TODOS los directores etiquetados como CEO (no solo el primero)
  const ceoDirs = directores.filter(d =>
    /chief executive officer/i.test(d.cargo) ||
    /chief executive/i.test(d.nombre)
  );
  for (const ceoDir of ceoDirs) {
    const nombrePuro = limpiarNombre(ceoDir.nombre);
    if (nombrePuro.length > 3 && !NO_NOMBRE.test(nombrePuro)) {
      compCEO.nombre = nombrePuro;
      break;
    }
  }

  // Estrategia 2: "[Nombre] Chief Executive Officer" en texto continuo — itera todos los matches
  if (compCEO.nombre === NA) {
    const re2 = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\s+Chief Executive Officer/g;
    let m2: RegExpExecArray | null;
    while ((m2 = re2.exec(texto)) !== null) {
      const n = m2[1].trim();
      if (!NO_NOMBRE.test(n)) { compCEO.nombre = n; break; }
    }
  }

  // Estrategia 3: "Chief Executive Officer" seguido de nombre
  if (compCEO.nombre === NA) {
    const re3 = /Chief Executive Officer\W{1,10}([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})/g;
    let m3: RegExpExecArray | null;
    while ((m3 = re3.exec(texto)) !== null) {
      const n = m3[1].trim();
      if (!NO_NOMBRE.test(n)) { compCEO.nombre = n; break; }
    }
  }

  // Extraer compensación total si tenemos el nombre
  if (compCEO.nombre !== NA) {
    const primerNombre = compCEO.nombre.split(/\s+/)[0];
    const totalRe = new RegExp(`${primerNombre}[\\s\\S]{0,800}?\\$([\\d,]{5,})`, "i");
    const tm = texto.match(totalRe);
    if (tm) compCEO.total = `$${tm[1]}`;
  }

  // ── Clases de acciones ──
  const clases: ClaseAccion[] = [];
  const classRe =
    /(Common Stock|Preferred Stock|Class [A-Z] (?:Common|Preferred)|Series [A-Z] Preferred)[^.]{0,200}/gi;
  const seenClases = new Set<string>();
  while ((m = classRe.exec(texto)) !== null && clases.length < 6) {
    const raw = m[0].trim().replace(/\s+/g, " ").slice(0, 120);
    const clase = m[1].trim();
    if (!seenClases.has(clase)) {
      seenClases.add(clase);
      clases.push({ clase, descripcion: raw });
    }
  }

  // ── Grandes accionistas ──
  const accionistas: Accionista[] = [];
  // Buscar tabla de "beneficial ownership" con porcentajes
  const ownRe =
    /([A-Z][a-zA-Z\s&,\.]{4,60})\s{1,20}([\d,]+)\s{1,20}(\d{1,2}(?:\.\d+)?%)/g;
  const seenOwn = new Set<string>();
  while ((m = ownRe.exec(texto)) !== null && accionistas.length < 20) {
    const nombre = m[1].trim().replace(/\s+/g, " ");
    if (seenOwn.has(nombre) || nombre.length < 4) continue;
    seenOwn.add(nombre);
    accionistas.push({
      nombre,
      acciones: m[2],
      porcentaje: m[3],
    });
  }

  return {
    directores: directores.length ? directores : null,
    compensacionCEO: compCEO.nombre !== NA ? compCEO : null,
    clasesAcciones: clases.length ? clases : null,
    grandesAccionistas: accionistas.length ? accionistas : null,
  };
}

// ── Parsear 13F-HR ────────────────────────────────────────────────────────────

type Accionista13F = {
  gestor: string;
  acciones: string;
  valor: string;
  url: string;
};

async function get13FHolders(
  ticker: string,
  empresa: string
): Promise<Accionista13F[]> {
  // Buscar 13F-HR recientes que mencionen el ticker o empresa
  const terms = [ticker, empresa.split(" ")[0]];
  const resultados: Accionista13F[] = [];
  const seen = new Set<string>();

  for (const term of terms) {
    if (resultados.length >= 20) break;
    const searchUrl =
      `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(term)}%22` +
      `&forms=13F-HR&dateRange=custom&startdt=2024-01-01&enddt=2025-12-31&hits.hits._source=period_of_report,entity_name,file_num,accession_no`;

    let hits: Array<{
      _source: { entity_name?: string; accession_no?: string };
    }> = [];

    try {
      const r = await secFetch(searchUrl);
      if (!r.ok) continue;
      const json = await r.json();
      hits = json.hits?.hits ?? [];
    } catch {
      continue;
    }

    for (const hit of hits.slice(0, 30)) {
      if (resultados.length >= 20) break;
      const gestor = hit._source?.entity_name ?? "";
      const accNo = hit._source?.accession_no ?? "";
      if (!gestor || !accNo || seen.has(gestor)) continue;

      // Obtener XML de información de posiciones del 13F
      const acClean = accNo.replace(/-/g, "");
      // Necesitamos el CIK del gestor para construir la URL
      // El accession number tiene el CIK embebido: primeros 10 dígitos
      const cikGestor = accNo.split("-")[0].replace(/^0+/, "");

      const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cikGestor}/${acClean}/`;
      let acciones = NA;
      let valor = NA;

      try {
        const idxRes = await secFetch(`${xmlUrl}index.json`);
        if (!idxRes.ok) { seen.add(gestor); continue; }
        const idx = await idxRes.json();
        const archivos = idx.directory.item as Array<{ name: string; type: string }>;
        const xmlDoc = archivos.find(
          (f) => f.name.toLowerCase().includes("infotable") ||
            (f.name.endsWith(".xml") && !f.name.toLowerCase().includes("primary"))
        ) || archivos.find((f) => f.name.endsWith(".xml"));

        if (!xmlDoc) { seen.add(gestor); continue; }

        const xmlRes = await secFetch(`${xmlUrl}${xmlDoc.name}`);
        if (!xmlRes.ok) { seen.add(gestor); continue; }
        const xml = await xmlRes.text();

        // Buscar la entrada que corresponde a la empresa
        const patterns = [
          ticker.toUpperCase(),
          empresa.split(" ")[0].toUpperCase(),
        ];

        for (const pat of patterns) {
          const re = new RegExp(
            `<nameOfIssuer>[^<]*${pat}[^<]*<\\/nameOfIssuer>[\\s\\S]{0,600}?<value>(\\d+)<\\/value>[\\s\\S]{0,200}?<sshPrnamt>(\\d+)<\\/sshPrnamt>`,
            "i"
          );
          const match = xml.match(re);
          if (match) {
            valor = `$${(parseInt(match[1]) / 1000).toLocaleString("en-US")}K`;
            acciones = parseInt(match[2]).toLocaleString("en-US");
            break;
          }
        }
      } catch {
        seen.add(gestor);
        continue;
      }

      seen.add(gestor);
      if (acciones !== NA) {
        resultados.push({
          gestor,
          acciones,
          valor,
          url: `https://www.sec.gov/Archives/edgar/data/${cikGestor}/${acClean}/`,
        });
      }
    }
  }

  // Ordenar por valor descendente (si hay datos)
  resultados.sort((a, b) => {
    if (a.valor === NA) return 1;
    if (b.valor === NA) return -1;
    return b.valor.localeCompare(a.valor);
  });

  return resultados.slice(0, 20);
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) {
    return jsonResponse({ error: "Ticker requerido" }, 400);
  }

  // 1. Resolver CIK
  const entrada = await getCik(ticker);
  if (!entrada) {
    return jsonResponse(
      { error: `Ticker "${ticker}" no encontrado en SEC EDGAR.` },
      404
    );
  }
  const { cik, title: empresa } = entrada;
  const cikNum = parseInt(cik);

  // 2. DEF 14A en paralelo con 13F
  const [def14aFiling, accionistas13F] = await Promise.all([
    getLatestFiling(cik, "DEF 14A"),
    get13FHolders(ticker, empresa),
  ]);

  // 3. Parsear DEF 14A
  let def14aData: {
    fecha: string;
    directores: Director[] | null;
    compensacionCEO: CompensacionCEO | null;
    clasesAcciones: ClaseAccion[] | null;
    grandesAccionistas: Accionista[] | null;
  } | null = null;

  if (def14aFiling) {
    const html = await getDocHtml(cikNum, def14aFiling.accessionClean);
    if (html) {
      const texto = stripHtml(html);
      const parsed = parseDef14a(texto);
      def14aData = { fecha: def14aFiling.fecha, ...parsed };
    }
  }

  return jsonResponse({
    ticker,
    empresa,
    cik: cikNum,
    def14a: def14aData
      ? {
          fecha: def14aData.fecha,
          directores: def14aData.directores ?? NA,
          compensacionCEO: def14aData.compensacionCEO ?? NA,
          clasesAcciones: def14aData.clasesAcciones ?? NA,
          grandesAccionistas: def14aData.grandesAccionistas ?? NA,
        }
      : NA,
    accionistas13F: accionistas13F.length ? accionistas13F : NA,
  });
}
