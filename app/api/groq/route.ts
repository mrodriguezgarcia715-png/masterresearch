import { NextRequest, NextResponse } from "next/server";
import https from "node:https";

const GROQ_HOST  = "api.groq.com";
const GROQ_PATH  = "/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ── Helper: https.request evita el problema UNABLE_TO_VERIFY_LEAF_SIGNATURE
//    que afecta al fetch nativo (undici) en Node.js 18+ sobre Windows. ─────────

function httpsPost(
  headers: Record<string, string>,
  body: string
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: GROQ_HOST,
        path:     GROQ_PATH,
        method:   "POST",
        headers:  { ...headers, "Content-Length": Buffer.byteLength(body) },
        rejectUnauthorized: process.env.NODE_ENV === "production",
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => { data += chunk.toString(); });
        res.on("end",  () => resolve({ status: res.statusCode ?? 0, text: data }));
      }
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Formatear respuestas ──────────────────────────────────────────────────────

const NOMBRES: Record<string, string> = {
  p1:  "Modelo de negocio",
  p2:  "Clientes",
  p3:  "Ventaja competitiva",
  p4:  "Industria y posición competitiva",
  p5:  "Poder de marca y precios",
  p6:  "Adaptabilidad y cultura",
  p7:  "Riesgos estratégicos",
  p8:  "Sostenibilidad a largo plazo",
  p9:  "Asignación de capital",
  p10: "Estructura de poder y acciones",
  p11: "Estructura de propiedad",
  p12: "Información privilegiada e insiders",
  p13: "CEO y alta dirección",
  p14: "Supervisión del management",
  p15: "Compensación del management",
  p16: "Conflictos de interés",
  p17: "Deuda y protección de acreedores",
  p18: "Protección gerencial",
  p19: "Transparencia al mercado",
  p20: "Seguimiento de analistas",
  p21: "Liquidez y free float",
  p22: "Reputación social y empleados",
};

const BLOQUES_KEYS = {
  A: ["p1","p2","p3","p4","p5","p6","p7","p8","p9"],
  B: ["p10","p11","p12","p13","p14","p15","p16","p17","p18"],
  C: ["p19","p20","p21","p22"],
};

function buildPrompt(ticker: string, empresa: string, respuestas: Record<string, string>): string {
  const todasLasKeys = [...BLOQUES_KEYS.A, ...BLOQUES_KEYS.B, ...BLOQUES_KEYS.C];
  const sinDato = todasLasKeys.filter(
    k => !respuestas[k] || respuestas[k] === "Información no disponible"
  ).length;
  const pctSinDato = Math.round((sinDato / todasLasKeys.length) * 100);

  const notaPenalizacion = pctSinDato > 30
    ? `⚠ PENALIZACIÓN OBLIGATORIA POR DATOS FALTANTES: El ${pctSinDato}% de las secciones (${sinDato} de ${todasLasKeys.length}) tienen "Información no disponible". Reglas de penalización que DEBES aplicar al calcular la puntuación:
  - 30-50% faltante → resta 5-10 puntos al score base.
  - 50-70% faltante → resta 10-20 puntos al score base.
  - Más del 70% faltante → la puntuación máxima posible es 50.
  Refleja esta limitación también en las debilidades y en la conclusión.`
    : `Cobertura de datos: ${100 - pctSinDato}% (${todasLasKeys.length - sinDato}/${todasLasKeys.length} secciones disponibles). No aplica penalización por datos faltantes.`;

  function fmtBloque(keys: string[]): string {
    return keys.map(k => `[${NOMBRES[k]}]\n${respuestas[k] ?? "Información no disponible"}`).join("\n\n");
  }

  return `Eres un analista financiero senior experto en inversiones de valor. Analiza la siguiente información de ${empresa} (${ticker}) extraída de fuentes oficiales (SEC EDGAR, Yahoo Finance, Glassdoor) y genera un resumen ejecutivo estructurado en español.

BLOQUE A — EL NEGOCIO (preguntas 1-9):
${fmtBloque(BLOQUES_KEYS.A)}

BLOQUE B — GOBIERNO CORPORATIVO (preguntas 10-18):
${fmtBloque(BLOQUES_KEYS.B)}

BLOQUE C — MERCADO Y SOCIEDAD (preguntas 19-22):
${fmtBloque(BLOQUES_KEYS.C)}

INSTRUCCIONES:
- Usa SOLO la información proporcionada arriba. No inventes datos.
- Si la información es insuficiente para un punto, indícalo brevemente.
- Sé directo, concreto y útil para un inversor.
- Todo en español.
- Los resúmenes por bloque deben ser párrafos fluidos de 2-3 oraciones que sinteticen los hallazgos clave de ese bloque.
- ${notaPenalizacion}

Responde ÚNICAMENTE con un JSON válido con exactamente este formato (sin markdown, sin texto adicional):
{
  "resumenBloques": {
    "bloqueA": "párrafo resumen del Bloque A — El Negocio en 2-3 oraciones",
    "bloqueB": "párrafo resumen del Bloque B — Gobierno Corporativo en 2-3 oraciones",
    "bloqueC": "párrafo resumen del Bloque C — Mercado y Sociedad en 2-3 oraciones"
  },
  "fortalezas": ["punto 1", "punto 2", "punto 3", "punto 4"],
  "debilidades": ["punto 1", "punto 2", "punto 3"],
  "gobierno": "evaluación del gobierno corporativo en 2-3 oraciones",
  "conclusion": "conclusión general de inversión en 2-3 oraciones",
  "puntuacion": 75
}

Para la puntuación (1-100):
- 1-25: empresa con problemas graves, no apta para inversión
- 26-50: empresa con debilidades importantes y riesgos significativos
- 51-70: empresa promedio con oportunidades y riesgos equilibrados
- 71-85: empresa sólida con ventajas competitivas claras
- 86-100: empresa excepcional, negocio de alta calidad`;
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GROQ_API_KEY no configurada en .env.local" },
      { status: 500 }
    );
  }

  try {
    const { ticker, empresa, respuestas } = await req.json() as {
      ticker: string;
      empresa: string;
      respuestas: Record<string, string>;
    };

    if (!ticker || !respuestas) {
      return NextResponse.json({ error: "ticker y respuestas son requeridos" }, { status: 400 });
    }

    const body = JSON.stringify({
      model:       GROQ_MODEL,
      messages:    [{ role: "user", content: buildPrompt(ticker, empresa ?? ticker, respuestas) }],
      temperature: 0.3,
      max_tokens:  1800,
    });

    const { status, text } = await httpsPost(
      {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type":  "application/json",
      },
      body
    );

    if (status < 200 || status >= 300) {
      return NextResponse.json(
        { error: `Groq API error ${status}: ${text.slice(0, 200)}` },
        { status: 502 }
      );
    }

    const data = JSON.parse(text) as {
      choices: Array<{ message: { content: string } }>;
    };

    const raw   = data.choices?.[0]?.message?.content ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      return NextResponse.json({ error: "Groq devolvió una respuesta no parseable", raw: raw.slice(0, 200) }, { status: 502 });
    }

    const resultado = JSON.parse(match[0]);
    return NextResponse.json(resultado);

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno del servidor";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
