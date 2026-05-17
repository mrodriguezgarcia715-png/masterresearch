import { NextRequest, NextResponse } from "next/server";

const NA = "Información no disponible";

function fmt(val: unknown): string | number {
  if (val === null || val === undefined || val === "") return NA;
  if (typeof val === "number" && isNaN(val)) return NA;
  return val as string | number;
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker")?.toUpperCase();
  if (!ticker) {
    return NextResponse.json({ error: "Ticker requerido" }, { status: 400 });
  }

  const url =
    `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}` +
    `?modules=price,summaryDetail,defaultKeyStatistics,financialData,recommendationTrend`;

  let data: Record<string, unknown>;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
          "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      next: { revalidate: 300 }, // cache 5 min en Next.js
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Yahoo Finance respondió con ${res.status}` },
        { status: res.status }
      );
    }

    const json = (await res.json()) as {
      quoteSummary?: { result?: unknown[]; error?: unknown };
    };

    if (
      !json.quoteSummary?.result ||
      json.quoteSummary.result.length === 0
    ) {
      return NextResponse.json(
        { error: `No se encontraron datos para el ticker "${ticker}".` },
        { status: 404 }
      );
    }

    data = json.quoteSummary.result[0] as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: "Error al conectar con Yahoo Finance." },
      { status: 502 }
    );
  }

  // ── Módulos ──────────────────────────────────────────────────────────────────
  const price = (data.price ?? {}) as Record<string, Record<string, unknown>>;
  const summary = (data.summaryDetail ?? {}) as Record<string, Record<string, unknown>>;
  const keyStats = (data.defaultKeyStatistics ?? {}) as Record<string, Record<string, unknown>>;
  const recTrend = (data.recommendationTrend ?? {}) as {
    trend?: Array<Record<string, unknown>>;
  };

  // ── Precio actual ────────────────────────────────────────────────────────────
  const precioActual = fmt(price.regularMarketPrice?.raw);

  // ── Volumen promedio (90 días) ───────────────────────────────────────────────
  const volumenPromedio = fmt(
    summary.averageVolume?.raw ?? price.averageVolume?.raw
  );

  // ── Free Float (acciones en circulación flotante) ────────────────────────────
  const freeFloat = fmt(keyStats.floatShares?.raw ?? summary.floatShares?.raw);

  // ── Consenso de analistas + número ──────────────────────────────────────────
  // recommendationTrend.trend[0] = período más reciente ("0m")
  const tendencia = recTrend.trend?.find(
    (t) => t.period === "0m"
  ) as Record<string, unknown> | undefined;

  const numAnalistas: string | number = tendencia
    ? fmt(
        (Number(tendencia.strongBuy ?? 0) +
          Number(tendencia.buy ?? 0) +
          Number(tendencia.hold ?? 0) +
          Number(tendencia.sell ?? 0) +
          Number(tendencia.strongSell ?? 0)) || NA
      )
    : NA;

  const compra: string | number = tendencia
    ? fmt(
        (Number(tendencia.strongBuy ?? 0) + Number(tendencia.buy ?? 0)) || NA
      )
    : NA;
  const mantener: string | number = tendencia ? fmt(tendencia.hold ?? NA) : NA;
  const venta: string | number = tendencia
    ? fmt(
        (Number(tendencia.sell ?? 0) + Number(tendencia.strongSell ?? 0)) || NA
      )
    : NA;

  // ── Precio objetivo promedio ─────────────────────────────────────────────────
  const precioObjetivoPromedio = fmt(
    (data.financialData as Record<string, Record<string, unknown>>)
      ?.targetMeanPrice?.raw
  );

  return NextResponse.json({
    ticker,
    precioActual,
    volumenPromedio,
    freeFloat,
    numAnalistas,
    consenso: {
      compra,
      mantener,
      venta,
    },
    precioObjetivoPromedio,
  });
}
