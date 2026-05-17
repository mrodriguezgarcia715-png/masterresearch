import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
  ShadingType,
} from "docx";

// ── Tipos mínimos necesarios ──────────────────────────────────────────────────

type Respuestas = Record<string, string>;

type ResumenEjecutivo = {
  resumenBloques?: { bloqueA: string; bloqueB: string; bloqueC: string };
  fortalezas?: string[];
  debilidades?: string[];
  gobierno?: string;
  conclusion?: string;
  puntuacion?: number;
};

// ── Definición de preguntas (igual que page.tsx) ──────────────────────────────

const PREGUNTAS: { id: string; bloque: "A" | "B" | "C"; num: number; titulo: string }[] = [
  { id: "p1",  bloque: "A", num: 1,  titulo: "Modelo de negocio" },
  { id: "p2",  bloque: "A", num: 2,  titulo: "Clientes" },
  { id: "p3",  bloque: "A", num: 3,  titulo: "Ventaja competitiva" },
  { id: "p4",  bloque: "A", num: 4,  titulo: "Industria y posición competitiva" },
  { id: "p5",  bloque: "A", num: 5,  titulo: "Poder de marca y precios" },
  { id: "p6",  bloque: "A", num: 6,  titulo: "Adaptabilidad y cultura" },
  { id: "p7",  bloque: "A", num: 7,  titulo: "Riesgos estratégicos" },
  { id: "p8",  bloque: "A", num: 8,  titulo: "Sostenibilidad a largo plazo" },
  { id: "p9",  bloque: "A", num: 9,  titulo: "Asignación de capital" },
  { id: "p10", bloque: "B", num: 10, titulo: "Estructura de poder y acciones" },
  { id: "p11", bloque: "B", num: 11, titulo: "Estructura de propiedad" },
  { id: "p12", bloque: "B", num: 12, titulo: "Información privilegiada e insiders" },
  { id: "p13", bloque: "B", num: 13, titulo: "CEO y alta dirección" },
  { id: "p14", bloque: "B", num: 14, titulo: "Supervisión del management" },
  { id: "p15", bloque: "B", num: 15, titulo: "Compensación del management" },
  { id: "p16", bloque: "B", num: 16, titulo: "Conflictos de interés" },
  { id: "p17", bloque: "B", num: 17, titulo: "Deuda y protección de acreedores" },
  { id: "p18", bloque: "B", num: 18, titulo: "Protección gerencial" },
  { id: "p19", bloque: "C", num: 19, titulo: "Transparencia al mercado" },
  { id: "p20", bloque: "C", num: 20, titulo: "Seguimiento de analistas" },
  { id: "p21", bloque: "C", num: 21, titulo: "Liquidez y free float" },
  { id: "p22", bloque: "C", num: 22, titulo: "Reputación social y empleados" },
];

const BLOQUES_TITULO: Record<"A" | "B" | "C", string> = {
  A: "Bloque A — El Negocio",
  B: "Bloque B — Gobierno Corporativo",
  C: "Bloque C — Mercado y Sociedad",
};

// ── Helpers de párrafos ───────────────────────────────────────────────────────

function parrafoTitulo(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32, color: "1e293b" })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 0, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "f59e0b", space: 4 },
    },
  });
}

function parrafoBloque(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: "ffffff" })],
    spacing: { before: 360, after: 80 },
    shading: { type: ShadingType.SOLID, color: "1e3a5f" },
    indent: { left: 120, right: 120 },
  });
}

function parrafoPregunta(num: number, titulo: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: `${num}. `, bold: true, size: 20, color: "f59e0b" }),
      new TextRun({ text: titulo, bold: true, size: 20, color: "1e293b" }),
    ],
    spacing: { before: 200, after: 40 },
  });
}

function parrafoRespuesta(texto: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: texto || "Información no disponible",
        size: 18,
        color: texto && texto !== "Información no disponible" ? "374151" : "9ca3af",
        italics: !texto || texto === "Información no disponible",
      }),
    ],
    indent: { left: 240 },
    spacing: { before: 0, after: 120 },
  });
}

function parrafoSeccion(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: "1e293b" })],
    spacing: { before: 280, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color: "e2e8f0", space: 4 },
    },
  });
}

function parrafoBullet(text: string, positive: boolean): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: positive ? "✓  " : "✗  ", bold: true, color: positive ? "16a34a" : "dc2626", size: 18 }),
      new TextRun({ text, size: 18, color: "374151" }),
    ],
    indent: { left: 240 },
    spacing: { before: 40, after: 40 },
  });
}

function parrafoTexto(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, size: 18, color: "374151" })],
    indent: { left: 240 },
    spacing: { before: 0, after: 120 },
  });
}

function parrafoPuntuacion(puntuacion: number): Paragraph {
  const color = puntuacion >= 71 ? "16a34a" : puntuacion >= 51 ? "d97706" : "dc2626";
  const label =
    puntuacion >= 86 ? "Empresa excepcional"
    : puntuacion >= 71 ? "Empresa sólida"
    : puntuacion >= 51 ? "Empresa promedio"
    : puntuacion >= 26 ? "Debilidades importantes"
    : "Problemas graves";
  return new Paragraph({
    children: [
      new TextRun({ text: `${puntuacion}`, bold: true, size: 64, color }),
      new TextRun({ text: " / 100", size: 32, color: "9ca3af" }),
      new TextRun({ text: `     ${label}`, size: 22, color, bold: true }),
    ],
    alignment: AlignmentType.LEFT,
    spacing: { before: 120, after: 200 },
    indent: { left: 240 },
  });
}

function parrafoSeccionColor(text: string, color: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color })],
    spacing: { before: 240, after: 80 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 4, color, space: 4 },
    },
  });
}

function separador(): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text: "" })],
    spacing: { before: 0, after: 0 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 2, color: "e2e8f0", space: 4 },
    },
  });
}

// ── Función principal de exportación ─────────────────────────────────────────

export async function exportarWord(params: {
  ticker: string;
  empresa: string;
  respuestas: Respuestas;
  resumen: ResumenEjecutivo;
}): Promise<void> {
  const { ticker, empresa, respuestas, resumen } = params;

  const ahora = new Date();
  const fechaStr = ahora.toLocaleDateString("es-ES", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  const horaStr = ahora.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });

  const children: Paragraph[] = [];

  // ── Encabezado ──────────────────────────────────────────────────────────────
  children.push(parrafoTitulo(`Análisis Fundamental: ${ticker.toUpperCase()} — ${empresa}`));

  children.push(new Paragraph({
    children: [
      new TextRun({ text: "Fecha de análisis: ", bold: true, size: 18, color: "374151" }),
      new TextRun({ text: `${fechaStr}, ${horaStr} hrs`, size: 18, color: "374151" }),
    ],
    spacing: { before: 0, after: 40 },
  }));

  children.push(new Paragraph({
    children: [
      new TextRun({ text: "Fuentes: ", bold: true, size: 18, color: "374151" }),
      new TextRun({ text: "SEC EDGAR · Yahoo Finance · Glassdoor · IA (Groq)", size: 18, color: "6b7280" }),
    ],
    spacing: { before: 0, after: 360 },
  }));

  // ── 22 Preguntas agrupadas por bloque ───────────────────────────────────────
  const bloques: ("A" | "B" | "C")[] = ["A", "B", "C"];

  for (const bloque of bloques) {
    children.push(parrafoBloque(BLOQUES_TITULO[bloque]));

    const preguntas = PREGUNTAS.filter(p => p.bloque === bloque);
    for (const preg of preguntas) {
      children.push(parrafoPregunta(preg.num, preg.titulo));
      children.push(parrafoRespuesta(respuestas[preg.id] ?? ""));
    }
  }

  // ── Resúmenes por Bloque ─────────────────────────────────────────────────────
  if (resumen.resumenBloques) {
    children.push(separador());
    children.push(new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 40, after: 0 } }));

    children.push(new Paragraph({
      children: [new TextRun({ text: "Resumen por Bloque", bold: true, size: 28, color: "ffffff" })],
      spacing: { before: 0, after: 120 },
      shading: { type: ShadingType.SOLID, color: "1e293b" },
      indent: { left: 120, right: 120 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: "f59e0b", space: 4 },
      },
    }));

    const bloquesDef = [
      { key: "bloqueA" as const, titulo: "Bloque A — El Negocio",           color: "d97706" },
      { key: "bloqueB" as const, titulo: "Bloque B — Gobierno Corporativo", color: "1d4ed8" },
      { key: "bloqueC" as const, titulo: "Bloque C — Mercado y Sociedad",   color: "059669" },
    ];

    for (const b of bloquesDef) {
      const texto = resumen.resumenBloques[b.key] ?? "";
      children.push(parrafoSeccionColor(b.titulo, b.color));
      children.push(parrafoTexto(texto || "Información no disponible"));
    }
  }

  // ── Resumen Ejecutivo ────────────────────────────────────────────────────────
  children.push(separador());
  children.push(new Paragraph({ children: [new TextRun({ text: "" })], spacing: { before: 40, after: 0 } }));

  children.push(new Paragraph({
    children: [new TextRun({ text: "Resumen Ejecutivo", bold: true, size: 32, color: "1e293b" })],
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 0, after: 80 },
    shading: { type: ShadingType.SOLID, color: "1e293b" },
    indent: { left: 120, right: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "f59e0b", space: 4 },
    },
  }));

  // Puntuación
  if (resumen.puntuacion !== undefined) {
    children.push(parrafoSeccion("Puntuación"));
    children.push(parrafoPuntuacion(resumen.puntuacion));
  }

  // Fortalezas
  if (resumen.fortalezas?.length) {
    children.push(parrafoSeccion("Fortalezas"));
    for (const f of resumen.fortalezas) {
      children.push(parrafoBullet(f, true));
    }
  }

  // Debilidades
  if (resumen.debilidades?.length) {
    children.push(parrafoSeccion("Debilidades"));
    for (const d of resumen.debilidades) {
      children.push(parrafoBullet(d, false));
    }
  }

  // Gobierno corporativo
  if (resumen.gobierno) {
    children.push(parrafoSeccion("Gobierno Corporativo"));
    children.push(parrafoTexto(resumen.gobierno));
  }

  // Conclusión
  if (resumen.conclusion) {
    children.push(parrafoSeccion("Conclusión"));
    children.push(parrafoTexto(resumen.conclusion));
  }

  // ── Pie de página ────────────────────────────────────────────────────────────
  children.push(separador());
  children.push(new Paragraph({
    children: [
      new TextRun({ text: "Generado por MasterResearch · ", size: 16, color: "9ca3af" }),
      new TextRun({ text: `${fechaStr}, ${horaStr} hrs`, size: 16, color: "9ca3af" }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 0 },
  }));

  // ── Generar y descargar ──────────────────────────────────────────────────────
  const doc = new Document({
    sections: [{ children }],
    styles: {
      default: {
        document: {
          run: { font: "Calibri", size: 18 },
        },
      },
    },
  });

  const blob = await Packer.toBlob(doc);
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${ticker.toUpperCase()}_analisis_${ahora.toISOString().slice(0, 10)}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
