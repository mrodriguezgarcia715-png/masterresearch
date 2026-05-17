import { NextRequest } from "next/server";
import { jsonResponse } from "../_lib/json";
import https from "node:https";

const GROQ_HOST  = "api.groq.com";
const GROQ_PATH  = "/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function httpsPost(headers: Record<string, string>, body: string): Promise<{ status: number; text: string }> {
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

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return jsonResponse({ error: "GROQ_API_KEY no configurada" }, 500);

  const { item1, item1a, item7 } = await req.json() as {
    item1: string;
    item1a: string;
    item7: string;
  };

  const i1  = (item1  ?? "").slice(0, 5000);
  const i1a = (item1a ?? "").slice(0, 5000);
  const i7  = (item7  ?? "").slice(0, 5000);

  const prompt = `Eres un traductor profesional de documentos financieros. Traduce al espanol los siguientes tres fragmentos de un reporte 10-K de la SEC.

REGLAS ESTRICTAS:
- Traduccion COMPLETA y FIEL. NO resumir. NO omitir contenido.
- Mantener la estructura original del texto.
- Usar terminologia financiera estandar en espanol.
- NO agregar comentarios ni interpretaciones propias.

ITEM 1 - Business:
${i1}

---
ITEM 1A - Risk Factors:
${i1a}

---
ITEM 7 - MD&A:
${i7}

Responde UNICAMENTE con JSON valido sin markdown ni bloques de codigo:
{"item1_es":"...traduccion completa del Item 1...","item1a_es":"...traduccion completa del Item 1A...","item7_es":"...traduccion completa del Item 7..."}`;

  const body = JSON.stringify({
    model:       GROQ_MODEL,
    messages:    [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens:  8000,
  });

  try {
    const { status, text } = await httpsPost(
      { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body
    );

    if (status < 200 || status >= 300) {
      return jsonResponse({ error: `Groq error ${status}: ${text.slice(0, 200)}` }, 502);
    }

    const data = JSON.parse(text) as { choices: Array<{ message: { content: string } }> };
    const raw   = data.choices?.[0]?.message?.content ?? "{}";
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return jsonResponse({ error: "Respuesta no parseable" }, 502);

    return jsonResponse(JSON.parse(match[0]));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno";
    return jsonResponse({ error: msg }, 500);
  }
}
