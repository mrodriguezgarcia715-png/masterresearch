import { NextRequest } from "next/server";
import { jsonResponse } from "../_lib/json";

// DuckDuckGo Instant Answer API — gratuita, sin clave
const DDG = "https://api.duckduckgo.com/";

async function ddgQuery(q: string): Promise<string> {
  try {
    const url = `${DDG}?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "MasterResearch/1.0" },
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return "";

    const data = await res.json() as {
      AbstractText?: string;
      Answer?: string;
      RelatedTopics?: Array<{ Text?: string }>;
    };

    // Preferir respuesta directa, luego abstract, luego primer tema relacionado
    const texto =
      data.Answer?.trim() ||
      data.AbstractText?.trim() ||
      data.RelatedTopics?.[0]?.Text?.trim() ||
      "";

    return texto.length > 30 ? texto : "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const ticker  = req.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? "";
  const empresa = req.nextUrl.searchParams.get("empresa") ?? ticker;

  if (!ticker) {
    return jsonResponse({}, 400);
  }

  // Consultas específicas por sección
  const queries: Record<string, string> = {
    p9:  `${empresa} ${ticker} stock buyback share repurchase dividend capital allocation`,
    p11: `${empresa} institutional shareholders ownership Vanguard BlackRock`,
    p16: `${empresa} related party transactions conflict of interest`,
    p17: `${empresa} long-term debt bonds credit rating Moody S&P`,
    p18: `${empresa} anti-takeover poison pill staggered board shareholder rights`,
    p22: `${empresa} employee satisfaction workplace culture Glassdoor rating`,
  };

  // Ejecutar todas las consultas en paralelo
  const resultados: Record<string, string> = {};
  await Promise.all(
    Object.entries(queries).map(async ([key, q]) => {
      const texto = await ddgQuery(q);
      if (texto) resultados[key] = texto;
    })
  );

  return jsonResponse(resultados);
}
