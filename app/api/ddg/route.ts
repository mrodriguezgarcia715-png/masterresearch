import { NextRequest } from "next/server";
import { jsonResponse } from "../_lib/json";
import https from "node:https";

// Usa https.request (no fetch) para evitar CRYPT_E_NO_REVOCATION_CHECK en Windows/SChannel
function httpsGet(hostname: string, path: string): Promise<string> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname,
        path,
        method:  "GET",
        headers: { "User-Agent": "MasterResearch/1.0", "Accept": "application/json" },
        rejectUnauthorized: process.env.NODE_ENV === "production",
        timeout: 6000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end",  () => resolve(data));
      }
    );
    req.on("error",   () => resolve(""));
    req.on("timeout", () => { req.destroy(); resolve(""); });
    req.end();
  });
}

// DuckDuckGo Instant Answer API
async function ddgQuery(q: string): Promise<string> {
  try {
    const path = `/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`;
    const raw  = await httpsGet("api.duckduckgo.com", path);
    if (!raw) return "";

    const data = JSON.parse(raw) as {
      AbstractText?: string;
      Answer?: string;
      RelatedTopics?: Array<{ Text?: string }>;
    };

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

// Wikipedia REST Summary API — fallback para secciones sin datos
async function wikiSummary(empresa: string): Promise<string> {
  try {
    const title = empresa.replace(/[,\.]/g, "").trim().replace(/\s+/g, "_");
    const path  = `/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
    const raw   = await httpsGet("en.wikipedia.org", path);
    if (!raw) return "";

    const data = JSON.parse(raw) as { extract?: string; type?: string };
    if (data.type === "disambiguation") return "";

    const extract = data.extract?.trim() || "";
    return extract.length > 50 ? extract.slice(0, 450) : "";
  } catch {
    return "";
  }
}

export async function GET(req: NextRequest) {
  const ticker  = req.nextUrl.searchParams.get("ticker")?.toUpperCase() ?? "";
  const empresa = req.nextUrl.searchParams.get("empresa") ?? ticker;

  if (!ticker) return jsonResponse({}, 400);

  const queries: Record<string, string> = {
    p9:          `${empresa} ${ticker} stock buyback share repurchase dividend capital allocation`,
    p16:         `${empresa} related party transactions conflict of interest`,
    p17:         `${empresa} long-term debt bonds credit rating Moody S&P`,
    p18:         `${empresa} anti-takeover poison pill staggered board shareholder rights`,
    mercado:     `${ticker} stock analysts price target 2026`,
    empleados:   `${empresa} employee satisfaction rating`,
    gobierno:    `${empresa} corporate governance board directors`,
    accionistas: `${empresa} institutional shareholders 2026`,
  };

  // Todas las queries DDG en paralelo
  const resultados: Record<string, string> = {};
  await Promise.all(
    Object.entries(queries).map(async ([key, q]) => {
      const texto = await ddgQuery(q);
      if (texto) resultados[key] = texto;
    })
  );

  // Wikipedia como fallback para secciones que DDG no pudo responder
  const sectionKeys = ["mercado", "empleados", "gobierno", "accionistas"];
  const vacias = sectionKeys.filter(k => !resultados[k]);
  if (vacias.length > 0) {
    const wikiText = await wikiSummary(empresa);
    if (wikiText) {
      for (const k of vacias) {
        resultados[k] = wikiText;
      }
    }
  }

  return jsonResponse(resultados);
}
