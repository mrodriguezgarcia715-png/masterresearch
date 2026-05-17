import { NextRequest } from "next/server";
import { jsonResponse } from "../_lib/json";

const NA = "Información no disponible";
const FMP = "https://financialmodelingprep.com/api/v3";

function fmt(val: unknown): string | number {
  if (val === null || val === undefined || val === "") return NA;
  if (typeof val === "number" && (isNaN(val) || val === 0)) return NA;
  if (val === 0) return NA;
  return val as string | number;
}

async function fmpFetch(path: string, apiKey: string): Promise<Record<string, unknown> | null> {
  try {
    const sep = path.includes("?") ? "&" : "?";
    const res = await fetch(`${FMP}${path}${sep}apikey=${apiKey}`, {
      headers: { "User-Agent": "MasterResearch/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) return (data[0] as Record<string, unknown>) ?? null;
    return (data as Record<string, unknown>) ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) {
    return jsonResponse({ error: "Ticker requerido" }, 400);
  }

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) {
    return jsonResponse({ error: "FMP_API_KEY no configurada" }, 500);
  }

  const [quote, floatData, targetData, ratingsData] = await Promise.all([
    fmpFetch(`/quote/${encodeURIComponent(ticker)}`, apiKey),
    fmpFetch(`/shares_float?symbol=${encodeURIComponent(ticker)}`, apiKey),
    fmpFetch(`/price-target-consensus/${encodeURIComponent(ticker)}`, apiKey),
    fmpFetch(`/analyst-stock-recommendations/${encodeURIComponent(ticker)}`, apiKey),
  ]);

  const precioActual = fmt(quote?.price);
  const volumenPromedio = fmt(quote?.avgVolume ?? quote?.averageVolume);
  const freeFloat = fmt(floatData?.floatShares);
  const precioObjetivoPromedio = fmt(targetData?.targetConsensus);

  const strongBuy  = Number(ratingsData?.analystRatingsStrongBuy  ?? 0);
  const buy        = Number(ratingsData?.analystRatingsbuy         ?? 0);
  const hold       = Number(ratingsData?.analystRatingsHold        ?? 0);
  const sell       = Number(ratingsData?.analystRatingsSell        ?? 0);
  const strongSell = Number(ratingsData?.analystRatingsStrongSell  ?? 0);

  const totalAnalistas = strongBuy + buy + hold + sell + strongSell;

  const compra   = fmt(ratingsData ? (strongBuy + buy)   || null : null);
  const mantener = fmt(ratingsData ? hold                || null : null);
  const venta    = fmt(ratingsData ? (sell + strongSell) || null : null);
  const numAnalistas = fmt(ratingsData ? totalAnalistas || null : null);

  return jsonResponse({
    ticker,
    precioActual,
    volumenPromedio,
    freeFloat,
    numAnalistas,
    consenso: { compra, mantener, venta },
    precioObjetivoPromedio,
  });
}
