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

// Cabeceras que imitan un navegador real para evitar bloqueos básicos
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.glassdoor.com/",
  "X-Requested-With": "XMLHttpRequest",
};

// ── Estrategia 1: autocomplete JSON de Glassdoor ─────────────────────────────

type GlassdoorEmployer = {
  id?: number;
  name?: string;
  overallRating?: string | number;
  ratingDescription?: string;
  numberOfRatings?: number;
  recommendToFriend?: string | number;
  ceoApproval?: string | number;
  ceoName?: string;
  industryName?: string;
  squareLogo?: string;
};

async function buscarViaAutocomplete(
  termino: string
): Promise<GlassdoorEmployer | null> {
  const url =
    `https://www.glassdoor.com/api/employer/find.htm` +
    `?term=${encodeURIComponent(termino)}&autocomplete=true&countryId=1`;

  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    // Next.js: no cachear (datos frescos)
    cache: "no-store",
  });

  if (!res.ok) return null;

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return null;

  const data = (await res.json()) as GlassdoorEmployer[];
  if (!Array.isArray(data) || data.length === 0) return null;

  // Preferir coincidencia exacta de nombre; si no, el primero
  const exacto = data.find(
    (e) => e.name?.toLowerCase() === termino.toLowerCase()
  );
  return exacto ?? data[0];
}

// ── Estrategia 2: scraping HTML + JSON-LD ────────────────────────────────────

type JsonLd = {
  "@type"?: string;
  aggregateRating?: {
    ratingValue?: string | number;
    reviewCount?: string | number;
    bestRating?: string | number;
  };
  name?: string;
};

async function buscarViaHtml(
  termino: string
): Promise<Partial<GlassdoorEmployer> | null> {
  // Búsqueda en la página pública de Glassdoor
  const url = `https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(termino)}`;

  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    cache: "no-store",
  });

  if (!res.ok) return null;

  const html = await res.text();

  // Intentar extraer JSON-LD con aggregateRating
  const ldMatch = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  );

  if (!ldMatch) return null;

  for (const block of ldMatch) {
    try {
      const jsonText = block.replace(/<\/?script[^>]*>/gi, "").trim();
      const ld = JSON.parse(jsonText) as JsonLd;
      if (ld.aggregateRating) {
        return {
          name: ld.name,
          overallRating: ld.aggregateRating.ratingValue,
          numberOfRatings: Number(ld.aggregateRating.reviewCount) || undefined,
        };
      }
    } catch {
      // bloque JSON malformado, continuar
    }
  }

  // Fallback: buscar el rating con regex en el HTML
  const ratingMatch = html.match(/overallRating["']?\s*:\s*["']?([\d.]+)/);
  const reviewsMatch = html.match(/numberOfRatings["']?\s*:\s*(\d+)/);
  const ceoMatch = html.match(/ceoApproval["']?\s*:\s*["']?([\d.]+)/);
  const recMatch = html.match(/recommendToFriend["']?\s*:\s*["']?([\d.]+)/);

  if (!ratingMatch) return null;

  return {
    overallRating: ratingMatch[1],
    numberOfRatings: reviewsMatch ? Number(reviewsMatch[1]) : undefined,
    ceoApproval: ceoMatch?.[1],
    recommendToFriend: recMatch?.[1],
  };
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? null;
  const empresa = req.nextUrl.searchParams.get("empresa") ?? null;

  if (!ticker && !empresa) {
    return NextResponse.json(
      { error: "Se requiere al menos 'ticker' o 'empresa'" },
      { status: 400 }
    );
  }

  // Usar el nombre de empresa si viene; si no, el ticker como búsqueda
  const termino = empresa ?? ticker!;

  const vacio = {
    ticker,
    empresa: empresa ?? ticker,
    ratingGeneral: NA,
    descripcionRating: NA,
    numeroResenas: NA,
    recomendarian: NA,
    aprobacionCEO: NA,
    nombreCEO: NA,
    industria: NA,
    fuente: "Glassdoor",
  };

  let datos: Partial<GlassdoorEmployer> | null = null;

  try {
    // Estrategia 1: JSON autocomplete
    datos = await buscarViaAutocomplete(termino);
  } catch {
    // continuar con estrategia 2
  }

  if (!datos) {
    try {
      // Estrategia 2: scraping HTML
      datos = await buscarViaHtml(termino);
    } catch {
      // ambas fallaron → devolver NAs
    }
  }

  if (!datos) {
    return NextResponse.json(vacio);
  }

  return NextResponse.json({
    ticker,
    empresa: datos.name ?? empresa ?? ticker,
    ratingGeneral: safeNum(datos.overallRating),
    descripcionRating: safeStr(datos.ratingDescription),
    numeroResenas: safeNum(datos.numberOfRatings),
    recomendarian: pct(datos.recommendToFriend),
    aprobacionCEO: pct(datos.ceoApproval),
    nombreCEO: safeStr(datos.ceoName),
    industria: safeStr(datos.industryName),
    fuente: "Glassdoor",
  });
}
