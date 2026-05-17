import { NextRequest, NextResponse } from "next/server";

const NA = "Información no disponible";

// ── Helpers ──────────────────────────────────────────────────────────────────

function safeStr(val: unknown): string {
  if (val === null || val === undefined || val === "" || val === "0" || val === 0)
    return NA;
  return String(val);
}

function safeNum(val: unknown): number | string {
  if (val === null || val === undefined || val === "") return NA;
  const n = Number(val);
  return isNaN(n) || n === 0 ? NA : n;
}

function pct(val: unknown): string {
  const n = Number(val);
  if (isNaN(n) || n === 0) return NA;
  return `${n}%`;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

// ── Tipo compartido ───────────────────────────────────────────────────────────

type EmpleadorData = {
  name?: string;
  overallRating?: string | number;
  ratingDescription?: string;
  numberOfRatings?: number;
  recommendToFriend?: string | number;
  ceoApproval?: string | number;
  ceoName?: string;
  industryName?: string;
};

// ── Estrategia 1: autocomplete JSON de Glassdoor ─────────────────────────────

async function buscarViaGlassdoor(termino: string): Promise<EmpleadorData | null> {
  try {
    const url =
      `https://www.glassdoor.com/api/employer/find.htm` +
      `?term=${encodeURIComponent(termino)}&autocomplete=true&countryId=1`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
        Referer: "https://www.glassdoor.com/",
        "X-Requested-With": "XMLHttpRequest",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return null;

    const data = (await res.json()) as EmpleadorData[];
    if (!Array.isArray(data) || data.length === 0) return null;

    const exacto = data.find(
      (e) => e.name?.toLowerCase() === termino.toLowerCase()
    );
    return exacto ?? data[0];
  } catch {
    return null;
  }
}

// ── Estrategia 2: Indeed employer profile ────────────────────────────────────

async function buscarViaIndeed(
  termino: string,
  ticker: string
): Promise<EmpleadorData | null> {
  const slugs = [...new Set([ticker.toLowerCase(), toSlug(termino)])].filter(Boolean);

  const INDEED_HEADERS = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
      "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
  };

  for (const slug of slugs) {
    for (const path of [`/cmp/${slug}/reviews`, `/cmp/${slug}`]) {
      try {
        const res = await fetch(`https://www.indeed.com${path}`, {
          headers: INDEED_HEADERS,
          cache: "no-store",
          signal: AbortSignal.timeout(4000),
        });

        if (!res.ok) continue;
        const html = await res.text();

        // JSON-LD structured data
        const scriptTags = html.match(
          /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
        );
        if (scriptTags) {
          for (const block of scriptTags) {
            try {
              const jsonText = block.replace(/<\/?script[^>]*>/gi, "").trim();
              const ld = JSON.parse(jsonText) as {
                name?: string;
                aggregateRating?: {
                  ratingValue?: string | number;
                  reviewCount?: string | number;
                };
              };
              if (ld.aggregateRating?.ratingValue) {
                return {
                  name: ld.name ?? termino,
                  overallRating: ld.aggregateRating.ratingValue,
                  numberOfRatings:
                    Number(ld.aggregateRating.reviewCount) || undefined,
                };
              }
            } catch { /* bloque malformado */ }
          }
        }

        // Regex fallback
        const ratingMatch  = html.match(/["']ratingValue["']\s*:\s*["']?([\d.]+)/);
        const reviewsMatch = html.match(/["'](?:reviewCount|numberOfRatings)["']\s*:\s*["']?(\d+)/);
        const recMatch     = html.match(/["']recommendToFriend["']\s*:\s*["']?([\d.]+)/);
        const ceoMatch     = html.match(/["']ceoRating["']\s*:\s*["']?([\d.]+)/);

        if (ratingMatch) {
          return {
            name: termino,
            overallRating: ratingMatch[1],
            numberOfRatings: reviewsMatch ? Number(reviewsMatch[1]) : undefined,
            recommendToFriend: recMatch?.[1],
            ceoApproval: ceoMatch?.[1],
          };
        }
      } catch { /* probar siguiente slug/path */ }
    }
  }

  return null;
}

// ── Estrategia 3: DuckDuckGo (fallback final) ────────────────────────────────

async function buscarViaDDG(termino: string): Promise<EmpleadorData | null> {
  try {
    const q = `${termino} employee rating Glassdoor reviews`;
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "MasterResearch/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;

    const data = await res.json() as { AbstractText?: string; Answer?: string };
    const texto = data.Answer?.trim() || data.AbstractText?.trim() || "";
    if (!texto) return null;

    // Intentar extraer rating numérico del texto (ej: "4.1 out of 5")
    const ratingMatch = texto.match(/(\d+\.?\d*)\s*(?:out of 5|\/\s*5|\s*stars?)/i);
    if (!ratingMatch) return null;

    return { overallRating: ratingMatch[1], name: termino };
  } catch {
    return null;
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ticker  = req.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? null;
  const empresa = req.nextUrl.searchParams.get("empresa") ?? null;

  if (!ticker && !empresa) {
    return NextResponse.json(
      { error: "Se requiere al menos 'ticker' o 'empresa'" },
      { status: 400 }
    );
  }

  const termino = empresa ?? ticker!;

  const vacio = {
    ticker,
    empresa: empresa ?? ticker,
    ratingGeneral:    NA,
    descripcionRating: NA,
    numeroResenas:    NA,
    recomendarian:    NA,
    aprobacionCEO:    NA,
    nombreCEO:        NA,
    industria:        NA,
    fuente:           NA,
  };

  // Estrategia 1: Glassdoor autocomplete JSON
  let datos: EmpleadorData | null = await buscarViaGlassdoor(termino);
  let fuente = "Glassdoor";

  // Estrategia 2: Indeed
  if (!datos) {
    datos = await buscarViaIndeed(termino, ticker ?? termino);
    fuente = "Indeed";
  }

  // Estrategia 3: DuckDuckGo (fallback final)
  if (!datos) {
    datos = await buscarViaDDG(termino);
    fuente = "DuckDuckGo";
  }

  if (!datos) {
    return NextResponse.json(vacio);
  }

  return NextResponse.json({
    ticker,
    empresa:          datos.name ?? empresa ?? ticker,
    ratingGeneral:    safeNum(datos.overallRating),
    descripcionRating: safeStr(datos.ratingDescription),
    numeroResenas:    safeNum(datos.numberOfRatings),
    recomendarian:    pct(datos.recommendToFriend),
    aprobacionCEO:    pct(datos.ceoApproval),
    nombreCEO:        safeStr(datos.ceoName),
    industria:        safeStr(datos.industryName),
    fuente,
  });
}
