"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { exportarWord } from "./exportarWord";

// ── Types ─────────────────────────────────────────────────────────────────────

type ItemData = { titulo: string; contenido: string };

type DatosAnalisis = {
  nombre: string;
  cik: number;
  filing: { accession: string; fecha: string };
  documento: { url: string; nombre: string };
  items: { item1: ItemData; item1a: ItemData; item7: ItemData };
};

type DatosYahoo = {
  ticker?: string;
  precioActual?: number | string;
  volumenPromedio?: number | string;
  freeFloat?: number | string;
  numAnalistas?: number | string;
  consenso?: { compra: number | string; mantener: number | string; venta: number | string };
  precioObjetivoPromedio?: number | string;
  error?: string;
};

type DatosGlassdoor = {
  empresa?: string | null;
  ratingGeneral?: number | string;
  descripcionRating?: string;
  numeroResenas?: number | string;
  recomendarian?: string;
  aprobacionCEO?: string;
  nombreCEO?: string;
  industria?: string;
  error?: string;
};

type Director       = { nombre: string; cargo: string };
type CompensacionCEO = { nombre: string; total: string };
type ClaseAccion    = { clase: string; descripcion: string };
type Accionista13F  = { gestor: string; acciones: string; valor: string; url: string };

type DatosSEC = {
  ticker?: string;
  empresa?: string;
  cik?: number;
  def14a?: {
    fecha: string;
    directores: Director[] | string;
    compensacionCEO: CompensacionCEO | string;
    clasesAcciones: ClaseAccion[] | string;
    grandesAccionistas: string;
  } | string;
  accionistas13F?: Accionista13F[] | string;
  error?: string;
};

type Respuestas = Record<string, string>;
type Fuentes    = Record<string, string>;

type ResumenEjecutivo = {
  respuestasEsp?: Record<string, string>;
  resumenBloques?: { bloqueA: string; bloqueB: string; bloqueC: string };
  fortalezas?: string[];
  debilidades?: string[];
  gobierno?: string;
  conclusion?: string;
  puntuacion?: number;
  error?: string;
};

type ItemsEs = {
  item1_es:  string;
  item1a_es: string;
  item7_es:  string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const NA = "Informacion no disponible";

function n(v?: number | string | null): string {
  if (v === undefined || v === null || v === "") return NA;
  if (typeof v === "string") return v;
  if (isNaN(v)) return NA;
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return v.toLocaleString();
}

function p(v?: number | string | null): string {
  if (v === undefined || v === null || v === "") return NA;
  if (typeof v === "string") return v;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function s(v?: string | null): string {
  return v && v !== NA ? v : NA;
}

// ── Motor de 22 preguntas (client-side, solo datos existentes) ────────────────

const PREGUNTAS: { id: string; bloque: "A" | "B" | "C"; num: number; titulo: string; pregunta: string }[] = [
  { id: "p1",  bloque: "A", num: 1,  titulo: "Modelo de negocio",              pregunta: "¿Qué hace la empresa, qué problema resuelve y cómo genera dinero? ¿Cuál es su segmento más importante y qué tan esencial es para sus clientes?" },
  { id: "p2",  bloque: "A", num: 2,  titulo: "Clientes",                       pregunta: "¿Quién es el cliente principal, por qué lo elige y qué tan leal es? ¿La relación genera hábito, dependencia emocional o racional?" },
  { id: "p3",  bloque: "A", num: 3,  titulo: "Ventaja competitiva",            pregunta: "¿Qué tiene la empresa que la competencia no puede copiar fácilmente? ¿Tiene marca fuerte, efectos de red, costos de cambio o tecnología única? ¿La ventaja se fortalece o debilita con el tiempo?" },
  { id: "p4",  bloque: "A", num: 4,  titulo: "Industria y posición",           pregunta: "¿Quiénes son sus verdaderos competidores y qué tan agresiva es la industria? ¿Está creciendo, es cíclica o expuesta a disrupción? ¿Compite por precio o diferenciación? ¿De dónde vendrá el crecimiento futuro?" },
  { id: "p5",  bloque: "A", num: 5,  titulo: "Poder de marca y precios",       pregunta: "¿La marca genera confianza, status o identidad en sus clientes? ¿Puede subir precios sin perder clientes? ¿Su producto es diferenciado o commodity?" },
  { id: "p6",  bloque: "A", num: 6,  titulo: "Adaptabilidad y cultura",        pregunta: "¿La empresa se ha sabido reinventar ante cambios tecnológicos o de mercado? ¿La cultura favorece innovación o burocracia? ¿Depende demasiado de un fundador?" },
  { id: "p7",  bloque: "A", num: 7,  titulo: "Riesgos estratégicos",           pregunta: "¿Qué podría destruir este negocio — tecnología, regulación o competencia? ¿Depende demasiado de una sola fuente de ingresos, cliente o persona clave?" },
  { id: "p8",  bloque: "A", num: 8,  titulo: "Sostenibilidad de largo plazo",  pregunta: "¿La empresa seguirá siendo relevante en 10 años? ¿Su ventaja competitiva puede durar? ¿El negocio se fortalece con escala o se vuelve más difícil al crecer?" },
  { id: "p9",  bloque: "A", num: 9,  titulo: "Asignación de capital",          pregunta: "¿La empresa ha hecho buenas adquisiciones? ¿Recompra acciones cuando están baratas o caras? ¿Reinvierte bien sus ganancias o las desperdicia en proyectos sin retorno?" },
  { id: "p10", bloque: "B", num: 10, titulo: "Estructura de poder y acciones", pregunta: "¿Qué tipos de acciones existen y dónde se concentra el poder de voto? ¿Hay acciones clase A y B con derechos distintos? ¿Quién manda realmente — el CEO, un fundador, un inversor activista o un holding?" },
  { id: "p11", bloque: "B", num: 11, titulo: "Estructura de propiedad",        pregunta: "¿Qué porcentaje tienen institucionales, insiders e individuales? ¿Quiénes son los 10-20 mayores accionistas? ¿Hay activistas o fundadores relevantes?" },
  { id: "p12", bloque: "B", num: 12, titulo: "Información privilegiada",       pregunta: "¿Qué personas tienen acceso a información privilegiada? ¿Los insiders están comprando o vendiendo recientemente? ¿Las transacciones muestran confianza o desconfianza en la empresa?" },
  { id: "p13", bloque: "B", num: 13, titulo: "CEO y alta dirección",           pregunta: "¿Quién es el CEO, cuánto tiempo lleva, cómo llegó al cargo? ¿Tiene participación accionaria? ¿Cuál es su reputación según analistas?" },
  { id: "p14", bloque: "B", num: 14, titulo: "Supervisión del management",     pregunta: "¿Quién supervisa realmente al CEO? ¿Cuántos directores hay, qué proporción son independientes? ¿El CEO también preside el directorio? ¿El directorio ha actuado en contra del CEO?" },
  { id: "p15", bloque: "B", num: 15, titulo: "Compensación del management",    pregunta: "¿Cuánto gana el CEO, en qué forma y está atada al desempeño de largo plazo? ¿Hay señales de compensación excesiva desconectada del rendimiento?" },
  { id: "p16", bloque: "B", num: 16, titulo: "Conflictos de interés",          pregunta: "¿La empresa pertenece a un grupo mayor o holding familiar? ¿Los intereses del grupo pueden ir en contra de los accionistas minoritarios? ¿Hay directores que sirven en otras empresas del mismo grupo?" },
  { id: "p17", bloque: "B", num: 17, titulo: "Deuda y protección acreedores",  pregunta: "¿Qué tipos de deuda tiene — bonos, préstamos bancarios, leases? ¿Existen covenants impuestos por acreedores? ¿Cuál es su calificación Moody's o S&P?" },
  { id: "p18", bloque: "B", num: 18, titulo: "Protección gerencial",           pregunta: "¿Existen mecanismos que protejan a los gerentes contra la voluntad de los accionistas — poison pills, golden parachutes, enmiendas antitakeover? ¿Los accionistas tienen poder real para reemplazar al management?" },
  { id: "p19", bloque: "C", num: 19, titulo: "Transparencia al mercado",       pregunta: "¿Qué tan transparente es la empresa con sus inversores? ¿Ha habido retrasos, correcciones o escándalos contables en el pasado?" },
  { id: "p20", bloque: "C", num: 20, titulo: "Seguimiento de analistas",       pregunta: "¿Cuántos analistas siguen la acción y cuál es el consenso — compra, venta o mantener? ¿Cuál es el precio objetivo promedio vs el precio actual?" },
  { id: "p21", bloque: "C", num: 21, titulo: "Liquidez y free float",          pregunta: "¿Qué porcentaje de acciones está disponible para trading y cuál es el volumen promedio? ¿Es una acción líquida o difícil de negociar?" },
  { id: "p22", bloque: "C", num: 22, titulo: "Reputación social y empleados",  pregunta: "¿Cómo perciben los empleados a la empresa en satisfacción y rotación? ¿Ha tenido conflictos con reguladores, ambientalistas o grupos sociales?" },
];

function snip(texto: string, palabras: string[], chars = 450): string {
  for (const kw of palabras) {
    const i = texto.toLowerCase().indexOf(kw.toLowerCase());
    if (i < 0) continue;
    const ini = Math.max(0, texto.lastIndexOf(". ", i) + 2);
    const fin = Math.min(texto.length, ini + chars);
    const s   = texto.slice(ini, fin).trim();
    if (s.length > 60) return s + (fin < texto.length ? "…" : "");
  }
  return "";
}

function head(texto: string, chars: number): string {
  if (!texto) return "";
  return texto.slice(0, chars).trim() + (texto.length > chars ? "…" : "");
}

function validarTexto(texto: string | undefined | null): string {
  if (!texto) return "Informacion no disponible";
  const t = texto.trim();
  if (!t || t === "Informacion no disponible") return "Informacion no disponible";
  if (/^(see|refer to)\s+(item|note|section|exhibit)/i.test(t)) return "Informacion no disponible";
  if (/^\[.{0,80}\]$/.test(t)) return "Informacion no disponible";
  if (/^(n\/a|na|not applicable|none|pending|tbd)\.?$/i.test(t)) return "Informacion no disponible";
  return t;
}

function FuenteBadge({ fuente }: { fuente?: string }) {
  if (!fuente || fuente === "SEC EDGAR") return null;
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-orange-500/20 border border-orange-500/40 text-orange-400 ml-1 flex-shrink-0 whitespace-nowrap">
      {fuente}
    </span>
  );
}

function calcularRespuestas(
  datos: DatosAnalisis,
  yh: DatosYahoo | null,
  gl: DatosGlassdoor | null,
  sec: DatosSEC | null,
  ies?: ItemsEs | null
): { respuestas: Respuestas; fuentes: Fuentes } {
  const na = "Informacion no disponible";
  const t1  = datos.items.item1.contenido;
  const t1a = datos.items.item1a.contenido;
  const t7  = datos.items.item7.contenido;
  const t1_es  = ies?.item1_es;
  const t1a_es = ies?.item1a_es;
  const t7_es  = ies?.item7_es;

  const def    = sec?.def14a && typeof sec.def14a !== "string" ? sec.def14a as Exclude<DatosSEC["def14a"], string> : null;
  const dirs   = Array.isArray(def?.directores)      ? (def!.directores as Director[])     : null;
  const ceoC   = def?.compensacionCEO && typeof def.compensacionCEO === "object" ? (def.compensacionCEO as CompensacionCEO) : null;
  const clases = Array.isArray(def?.clasesAcciones)  ? (def!.clasesAcciones as ClaseAccion[]) : null;
  const a13f   = Array.isArray(sec?.accionistas13F)  ? (sec!.accionistas13F as Accionista13F[]) : null;
  const y      = yh && !yh.error ? yh : null;
  const g      = gl && !gl.error ? gl : null;

  const SEC = "SEC EDGAR";
  const YH  = "Yahoo Finance";
  const GD  = "Glassdoor";

  // Pre-computar valores para reutilizar en fuentes
  const p9snip  = snip(t7, ["acqui", "repurchas", "buyback", "dividend", "capital return", "return on", "share repurchase"]);
  const p10val  = clases
    ? `Tipos de acciones según DEF 14A (${def!.fecha}): ${clases.map(c => c.clase).join(", ")}.`
    : snip(t1, ["common stock", "class a", "class b", "preferred stock", "dual class", "voting right"]);
  const p11val  = a13f && a13f.length > 0
    ? `Top ${Math.min(a13f.length, 10)} accionistas institucionales (13F-HR): ${a13f.slice(0, 10).map((a, i) => `${i + 1}. ${a.gestor} — ${a.acciones} acc. (${a.valor})`).join("; ")}.`
    : "";
  const p12val  = dirs
    ? `Según DEF 14A, las siguientes personas tienen acceso a información privilegiada: ${dirs.slice(0, 8).map(d => `${d.nombre} (${d.cargo})`).join(", ")}.`
    : "";
  const p13parts: string[] = [];
  if (ceoC)              p13parts.push(`CEO reportado: ${ceoC.nombre}.`);
  else if (g?.nombreCEO) p13parts.push(`CEO según Glassdoor: ${g.nombreCEO}.`);
  if (g?.aprobacionCEO)  p13parts.push(`Aprobación del CEO (empleados): ${g.aprobacionCEO}.`);
  const p13extra = snip(t1, ["chief executive officer", "ceo since", "president and ceo"]);
  if (p13extra) p13parts.push(p13extra);
  const p13val  = p13parts.join(" ");
  const p14val  = dirs
    ? `El directorio tiene ${dirs.length} miembros según DEF 14A. Independientes: ${dirs.filter(d => /independent/i.test(d.cargo)).length}. Miembros: ${dirs.slice(0, 6).map(d => `${d.nombre} (${d.cargo})`).join(", ")}.`
    : "";
  const p15val  = ceoC ? `Compensación total del CEO ${ceoC.nombre}: ${ceoC.total} (DEF 14A).` : "";
  const p16snip = snip(t1a + " " + t1, ["conflict of interest", "related party", "affiliated", "related-party", "holding company", "family member"]);
  const p17snip = snip(t7, ["debt", "credit facility", "senior notes", "bond", "covenant", "moody", "standard & poor", "s&p", "long-term debt", "borrow"]);
  const p18snip = snip(t1a + " " + t1, ["poison pill", "golden parachute", "anti-takeover", "staggered board", "shareholder rights plan", "classified board", "defensive measure"]);
  const p20val  = y ? [
    y.numAnalistas           ? `${y.numAnalistas} analistas siguen la acción.` : "",
    y.consenso               ? `Consenso: ${(y.consenso as {compra:unknown;mantener:unknown;venta:unknown}).compra} compra, ${(y.consenso as {compra:unknown;mantener:unknown;venta:unknown}).mantener} mantener, ${(y.consenso as {compra:unknown;mantener:unknown;venta:unknown}).venta} venta.` : "",
    y.precioObjetivoPromedio ? `Precio objetivo promedio: ${typeof y.precioObjetivoPromedio === "number" ? "$" + (y.precioObjetivoPromedio as number).toFixed(2) : y.precioObjetivoPromedio}.` : "",
    y.precioActual           ? `Precio actual: ${typeof y.precioActual === "number" ? "$" + (y.precioActual as number).toFixed(2) : y.precioActual}.` : "",
  ].filter(Boolean).join(" ") : "";
  const p21val  = y ? [
    y.freeFloat       ? `Free float: ${typeof y.freeFloat === "number" ? (y.freeFloat as number).toLocaleString() : y.freeFloat} acciones en circulación libre.` : "",
    y.volumenPromedio ? `Volumen promedio diario: ${typeof y.volumenPromedio === "number" ? (y.volumenPromedio as number).toLocaleString() : y.volumenPromedio} acciones.` : "",
  ].filter(Boolean).join(" ") : "";
  const p22val  = g ? [
    g.ratingGeneral ? `Rating de empleados: ${g.ratingGeneral}/5 (${g.descripcionRating ?? ""}).` : "",
    g.numeroResenas ? `Basado en ${g.numeroResenas} reseñas.` : "",
    g.recomendarian ? `${g.recomendarian} de empleados recomendarían la empresa.` : "",
    g.aprobacionCEO ? `Aprobación del CEO: ${g.aprobacionCEO}.` : "",
  ].filter(Boolean).join(" ") : "";

  const respuestas: Respuestas = {
    // BLOQUE A
    p1:  head(t1_es ?? t1, 600) || na,
    p2:  snip(t1, ["customer", "client", "consumer", "buyer", "user", "subscriber"]) || na,
    p3:  snip(t1, ["competitive advantage", "brand", "network effect", "switching cost", "proprietary", "patent", "intellectual property", "moat"]) || na,
    p4:  snip(t1, ["competition", "competitor", "market share", "industry", "rival", "disrupt"]) || na,
    p5:  snip(t1, ["brand", "pric", "premium", "differentiat", "commodity", "pricing power"]) || na,
    p6:  snip(t1 + " " + t7, ["innovat", "technolog", "digital", "transform", "adapt", "reinvent", "research and development"]) || na,
    p7:  head(t1a_es ?? t1a, 600) || na,
    p8:  head(t7_es ?? t7, 600) || snip(t1 + " " + t7, ["long-term", "long term", "sustainable", "future", "scale", "growth driver"]) || na,
    p9:  p9snip || na,
    // BLOQUE B
    p10: p10val || na,
    p11: p11val || na,
    p12: p12val || na,
    p13: p13val || na,
    p14: p14val || na,
    p15: p15val || na,
    p16: p16snip || na,
    p17: p17snip || na,
    p18: p18snip || na,
    // BLOQUE C
    p19: `La empresa presenta reportes 10-K al SEC EDGAR de forma regular. Último 10-K: ${datos.filing.fecha} (accession ${datos.filing.accession}).${snip(t1a, ["restatement", "material weakness", "internal control", "accounting irregularity"]) ? " " + snip(t1a, ["restatement", "material weakness", "internal control"]) : ""}`,
    p20: p20val || na,
    p21: p21val || na,
    p22: p22val || na,
  };

  const p13fuente = ceoC ? SEC : (g?.nombreCEO || g?.aprobacionCEO) ? GD : p13extra ? SEC : "";

  const fuentes: Fuentes = {
    p1: SEC, p2: SEC, p3: SEC, p4: SEC, p5: SEC, p6: SEC, p7: SEC, p8: SEC,
    p9:  p9snip  ? SEC : "",
    p10: p10val  ? SEC : "",
    p11: p11val  ? SEC : "",
    p12: p12val  ? SEC : "",
    p13: p13fuente,
    p14: p14val  ? SEC : "",
    p15: p15val  ? SEC : "",
    p16: p16snip ? SEC : "",
    p17: p17snip ? SEC : "",
    p18: p18snip ? SEC : "",
    p19: SEC,
    p20: p20val ? YH : "",
    p21: p21val ? YH : "",
    p22: p22val ? GD : "",
  };

  return { respuestas, fuentes };
}

// ── Sección de 22 preguntas ────────────────────────────────────────────────────

const BLOQUES_INFO = {
  A: { titulo: "El Negocio",             color: "text-[#f59e0b]",  bg: "bg-[#f59e0b]/10",  border: "border-[#f59e0b]/30"  },
  B: { titulo: "Gobierno Corporativo",   color: "text-blue-400",   bg: "bg-blue-400/10",    border: "border-blue-400/30"   },
  C: { titulo: "Mercado y Sociedad",     color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
} as const;

function SeccionPreguntas({
  respuestas,
  respuestasEsp,
  fuentes,
}: {
  respuestas: Respuestas;
  respuestasEsp?: Record<string, string>;
  fuentes?: Fuentes;
}) {
  return (
    <div className="space-y-8">
      {(["A", "B", "C"] as const).map(bloque => {
        const info  = BLOQUES_INFO[bloque];
        const lista = PREGUNTAS.filter(p => p.bloque === bloque);
        return (
          <div key={bloque}>
            <div className="flex items-center gap-3 mb-4">
              <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest ${info.bg} border ${info.border} ${info.color}`}>
                Bloque {bloque}
              </span>
              <h2 className="text-white font-bold text-base">{info.titulo}</h2>
            </div>
            <div className="space-y-3">
              {lista.map(p => {
                const baseResp = validarTexto(respuestas[p.id]);
                const resp     = respuestasEsp?.[p.id] ?? baseResp;
                const fuente   = fuentes?.[p.id] ?? "";
                const sinDato  = resp === "Informacion no disponible";
                return (
                  <div key={p.id} className="bg-[#1e293b] rounded-xl border border-slate-700 p-5">
                    <div className="flex items-start gap-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 mt-0.5 ${info.bg} ${info.color} border ${info.border}`}>
                        {p.num}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-1 mb-1">
                          <p className="text-white font-semibold text-sm">{p.titulo}</p>
                          {!sinDato && <FuenteBadge fuente={fuente} />}
                        </div>
                        <p className="text-slate-500 text-[11px] mb-3 leading-relaxed">{p.pregunta}</p>
                        <p className={`text-xs leading-relaxed ${sinDato ? "text-slate-600 italic" : "text-slate-200"}`}>
                          {resp}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Tarjeta Resumen Ejecutivo (Groq) ─────────────────────────────────────────

function TarjetaResumen({ d, loading }: { d: ResumenEjecutivo | null; loading: boolean }) {
  if (!loading && !d) return null;

  if (loading) {
    return (
      <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-6 mt-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xl">📋</span>
          <div>
            <p className="text-white font-bold text-sm leading-none">Resumen Ejecutivo</p>
            <p className="text-slate-600 text-[10px] mt-0.5">Generando con Groq · llama3-70b-8192…</p>
          </div>
        </div>
        <div className="space-y-2.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-700/60 rounded animate-pulse" style={{ width: `${96 - i * 6}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (d?.error) {
    return (
      <div className="rounded-xl bg-red-950/40 border border-red-700/50 p-4 flex gap-3 items-start mt-6">
        <span className="text-lg mt-0.5">⚠️</span>
        <div>
          <p className="text-red-400 font-semibold text-xs mb-1">No se pudo generar el resumen ejecutivo</p>
          <p className="text-red-500 text-xs">{d.error}</p>
        </div>
      </div>
    );
  }

  if (!d) return null;

  const score = typeof d.puntuacion === "number" ? d.puntuacion : 0;
  const { color: scoreColor, bg: scoreBg, label: scoreLabel } =
    score >= 71 ? { color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/30", label: "Empresa sólida"   } :
    score >= 51 ? { color: "text-[#f59e0b]",   bg: "bg-[#f59e0b]/10 border-[#f59e0b]/30",   label: "Empresa promedio" } :
    score >= 26 ? { color: "text-orange-400",   bg: "bg-orange-400/10 border-orange-400/30", label: "Con debilidades"  } :
                  { color: "text-red-400",       bg: "bg-red-400/10 border-red-400/30",       label: "Alto riesgo"      };

  return (
    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-6 mt-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="text-xl">📋</span>
          <div>
            <p className="text-white font-bold text-sm leading-none">Resumen Ejecutivo</p>
            <p className="text-slate-600 text-[10px] mt-0.5">Groq · llama3-70b-8192</p>
          </div>
        </div>
        {/* Puntuación */}
        <div className={`flex flex-col items-center px-4 py-2 rounded-xl border ${scoreBg}`}>
          <span className={`text-3xl font-black font-mono leading-none ${scoreColor}`}>{score}</span>
          <span className={`text-[9px] font-semibold uppercase tracking-widest mt-0.5 ${scoreColor}`}>{scoreLabel}</span>
          <span className="text-slate-600 text-[9px]">/ 100</span>
        </div>
      </div>

      <div className="space-y-5">
        {/* Fortalezas */}
        {d.fortalezas && d.fortalezas.length > 0 && (
          <div>
            <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-2">✓ Fortalezas identificadas</p>
            <div className="space-y-1.5">
              {d.fortalezas.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-emerald-500 text-xs mt-0.5 flex-shrink-0">▸</span>
                  <p className="text-slate-200 text-xs leading-relaxed">{f}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debilidades */}
        {d.debilidades && d.debilidades.length > 0 && (
          <div>
            <p className="text-red-400 text-[10px] font-bold uppercase tracking-widest mb-2">⚠ Debilidades y Riesgos</p>
            <div className="space-y-1.5">
              {d.debilidades.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-red-400 text-xs mt-0.5 flex-shrink-0">▸</span>
                  <p className="text-slate-200 text-xs leading-relaxed">{f}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Gobierno */}
        {d.gobierno && (
          <div className="pt-4 border-t border-slate-800/50">
            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-widest mb-2">🏛 Evaluación Gobierno Corporativo</p>
            <p className="text-slate-200 text-xs leading-relaxed">{d.gobierno}</p>
          </div>
        )}

        {/* Conclusión */}
        {d.conclusion && (
          <div className="pt-4 border-t border-slate-800/50">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">📌 Conclusión general</p>
            <p className="text-slate-200 text-xs leading-relaxed">{d.conclusion}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tarjeta Gobierno Corporativo (DEF 14A) ────────────────────────────────────

function TarjetaGobierno({ d, loading }: { d: DatosSEC | null; loading: boolean }) {
  const def14a = d && !d.error && d.def14a && typeof d.def14a !== "string" ? d.def14a : null;
  const directores = def14a && Array.isArray(def14a.directores)                                      ? def14a.directores : null;
  const compCEO    = def14a && typeof def14a.compensacionCEO === "object" && def14a.compensacionCEO  ? def14a.compensacionCEO as CompensacionCEO : null;
  const clases     = def14a && Array.isArray(def14a.clasesAcciones)                                   ? def14a.clasesAcciones : null;

  return (
    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🏛️</span>
        <div>
          <p className="text-white font-bold text-sm leading-none">Gobierno Corporativo</p>
          <p className="text-slate-600 text-[10px] mt-0.5">
            SEC DEF 14A{def14a ? ` · ${def14a.fecha}` : ""}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-700/60 rounded animate-pulse" style={{ width: `${90 - i * 8}%` }} />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* CEO */}
          <div className="pb-3 border-b border-slate-800/50">
            <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-2">Compensación CEO</p>
            {compCEO ? (
              <div className="flex items-center justify-between">
                <span className="text-slate-300 text-xs">{compCEO.nombre}</span>
                <span className="text-[#f59e0b] text-xs font-bold font-mono">{compCEO.total}</span>
              </div>
            ) : (
              <span className="text-slate-600 text-xs italic">{NA}</span>
            )}
          </div>

          {/* Directores */}
          <div className="pb-3 border-b border-slate-800/50">
            <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-2">
              Junta Directiva{directores ? ` (${directores.length})` : ""}
            </p>
            {directores ? (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {directores.map((dir, i) => (
                  <div key={i} className="flex items-start justify-between gap-3">
                    <span className="text-slate-200 text-xs flex-shrink-0 leading-tight">{dir.nombre}</span>
                    <span className="text-slate-500 text-[10px] text-right leading-tight">{dir.cargo}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-slate-600 text-xs italic">{NA}</span>
            )}
          </div>

          {/* Tipos de acciones */}
          <div>
            <p className="text-slate-500 text-[10px] uppercase tracking-widest mb-2">Tipos de Acciones</p>
            {clases ? (
              <div className="space-y-1.5">
                {clases.map((c, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-[#f59e0b] text-[10px] flex-shrink-0 mt-0.5">▸</span>
                    <span className="text-slate-300 text-xs leading-tight">{c.clase}</span>
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-slate-600 text-xs italic">{NA}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tarjeta Accionistas Institucionales (13F-HR) ──────────────────────────────

function TarjetaAccionistas13F({ d, loading }: { d: DatosSEC | null; loading: boolean }) {
  const lista = d && !d.error && Array.isArray(d.accionistas13F) ? d.accionistas13F : null;

  return (
    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🏦</span>
        <div>
          <p className="text-white font-bold text-sm leading-none">Accionistas Institucionales</p>
          <p className="text-slate-600 text-[10px] mt-0.5">SEC 13F-HR · Top 20</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-3 bg-slate-700/60 rounded animate-pulse" style={{ width: `${88 - i * 4}%` }} />
          ))}
        </div>
      ) : lista && lista.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left pb-2 text-slate-500 font-medium text-[10px] uppercase tracking-widest w-6">#</th>
                <th className="text-left pb-2 text-slate-500 font-medium text-[10px] uppercase tracking-widest pl-2">Gestor</th>
                <th className="text-right pb-2 text-slate-500 font-medium text-[10px] uppercase tracking-widest">Acciones</th>
                <th className="text-right pb-2 text-slate-500 font-medium text-[10px] uppercase tracking-widest pl-3">Valor</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((acc, i) => (
                <tr key={i} className="border-b border-slate-800/40 last:border-0 hover:bg-slate-800/20 transition-colors">
                  <td className="py-1.5 text-slate-600 text-[10px]">{i + 1}</td>
                  <td className="py-1.5 pl-2">
                    <a href={acc.url} target="_blank" rel="noopener noreferrer"
                      className="text-slate-300 hover:text-[#f59e0b] transition-colors">
                      {acc.gestor}
                    </a>
                  </td>
                  <td className="py-1.5 text-right text-slate-300 font-mono">{acc.acciones}</td>
                  <td className="py-1.5 text-right text-[#f59e0b] font-mono pl-3">{acc.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <span className="text-slate-600 text-xs italic">{NA}</span>
      )}
    </div>
  );
}

// ── Tarjeta Yahoo ─────────────────────────────────────────────────────────────

function TarjetaYahoo({ d, loading }: { d: DatosYahoo | null; loading: boolean }) {
  const ok = d && !d.error;

  const bar = (() => {
    if (!ok || !d?.consenso) return null;
    const c = Number(d.consenso.compra);
    const m = Number(d.consenso.mantener);
    const v = Number(d.consenso.venta);
    const t = c + m + v;
    if (!t || isNaN(c) || isNaN(m) || isNaN(v)) return null;
    return { c, m, v, pC: (c / t) * 100, pM: (m / t) * 100, pV: (v / t) * 100 };
  })();

  function Row({ label, val }: { label: string; val: string }) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
        <span className="text-slate-500 text-xs">{label}</span>
        {loading
          ? <div className="h-3 w-20 bg-slate-700/60 rounded animate-pulse" />
          : <span className={`text-xs font-medium ${val === NA ? "text-slate-600 italic" : "text-slate-200"}`}>{val}</span>
        }
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📈</span>
        <div>
          <p className="text-white font-bold text-sm leading-none">Datos de Mercado</p>
          <p className="text-slate-600 text-[10px] mt-0.5">Yahoo Finance</p>
        </div>
      </div>
      <Row label="Precio actual"          val={ok ? p(d!.precioActual) : NA} />
      <Row label="Volumen promedio"        val={ok ? n(d!.volumenPromedio) : NA} />
      <Row label="Free float"             val={ok ? n(d!.freeFloat) : NA} />
      <Row label="Nº de analistas"        val={ok ? String(d!.numAnalistas ?? NA) : NA} />
      <Row label="Precio objetivo prom."  val={ok ? p(d!.precioObjetivoPromedio) : NA} />
      <div className="mt-4 pt-3 border-t border-slate-800/50">
        <p className="text-slate-500 text-xs mb-2">Consenso de analistas</p>
        {loading
          ? <div className="h-2 w-full bg-slate-700/60 rounded animate-pulse" />
          : bar
            ? <>
                <div className="flex rounded-full overflow-hidden h-2 mb-2">
                  <div className="bg-emerald-500" style={{ width: `${bar.pC}%` }} />
                  <div className="bg-amber-400"   style={{ width: `${bar.pM}%` }} />
                  <div className="bg-red-500"     style={{ width: `${bar.pV}%` }} />
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-emerald-400">Compra: {bar.c}</span>
                  <span className="text-amber-400">Mantener: {bar.m}</span>
                  <span className="text-red-400">Venta: {bar.v}</span>
                </div>
              </>
            : <span className="text-slate-600 text-xs italic">{NA}</span>
        }
      </div>
    </div>
  );
}

// ── Tarjeta Glassdoor ─────────────────────────────────────────────────────────

function TarjetaGlassdoor({ d, loading }: { d: DatosGlassdoor | null; loading: boolean }) {
  const ok = d && !d.error;
  const rating = ok && typeof d!.ratingGeneral === "number" ? d!.ratingGeneral : null;

  function Row({ label, val }: { label: string; val: string }) {
    return (
      <div className="flex items-center justify-between py-2 border-b border-slate-800/50 last:border-0">
        <span className="text-slate-500 text-xs">{label}</span>
        {loading
          ? <div className="h-3 w-20 bg-slate-700/60 rounded animate-pulse" />
          : <span className={`text-xs font-medium ${val === NA ? "text-slate-600 italic" : "text-slate-200"}`}>{val}</span>
        }
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">⭐</span>
        <div>
          <p className="text-white font-bold text-sm leading-none">Satisfacción de Empleados</p>
          <p className="text-slate-600 text-[10px] mt-0.5">Glassdoor</p>
        </div>
      </div>

      {loading
        ? <div className="h-8 bg-slate-700/40 rounded-lg animate-pulse mb-4" />
        : rating !== null
          ? <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-800/50">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <span key={i} className={`text-lg leading-none ${i < Math.round(rating) ? "text-[#f59e0b]" : "text-slate-700"}`}>★</span>
                ))}
              </div>
              <span className="text-white font-bold text-lg">{rating.toFixed(1)}</span>
              <span className="text-slate-500 text-xs">/ 5.0</span>
              {ok && d!.descripcionRating && d!.descripcionRating !== NA && (
                <span className="ml-auto text-slate-400 text-xs italic truncate max-w-[45%]">{d!.descripcionRating}</span>
              )}
            </div>
          : <div className="mb-4 pb-3 border-b border-slate-800/50">
              <span className="text-slate-600 text-xs italic">{NA}</span>
            </div>
      }

      <Row label="Nº de reseñas"            val={ok ? n(d!.numeroResenas) : NA} />
      <Row label="Recomendarían la empresa"  val={ok ? s(d!.recomendarian) : NA} />
      <Row label="Aprobación del CEO"        val={ok ? s(d!.aprobacionCEO) : NA} />
      <Row label="CEO"                       val={ok ? s(d!.nombreCEO) : NA} />
      <Row label="Industria"                 val={ok ? s(d!.industria) : NA} />
    </div>
  );
}

// ── Resúmenes por Bloque ──────────────────────────────────────────────────────

const BLOQUES_RESUMEN = [
  { key: "bloqueA" as const, letra: "A", titulo: "El Negocio",           color: "text-[#f59e0b]",   bg: "bg-[#f59e0b]/10",   border: "border-[#f59e0b]/30"   },
  { key: "bloqueB" as const, letra: "B", titulo: "Gobierno Corporativo", color: "text-blue-400",    bg: "bg-blue-400/10",    border: "border-blue-400/30"    },
  { key: "bloqueC" as const, letra: "C", titulo: "Mercado y Sociedad",   color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" },
] as const;

function SeccionResumenesBloques({ resumen, loading }: { resumen: ResumenEjecutivo | null; loading: boolean }) {
  if (!loading && (!resumen || resumen.error)) return null;

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">📝</span>
        <div>
          <p className="text-white font-bold text-sm leading-none">Resumen por Bloque</p>
          <p className="text-slate-600 text-[10px] mt-0.5">Groq · llama-3.3-70b-versatile</p>
        </div>
      </div>
      <div className="space-y-3">
        {BLOQUES_RESUMEN.map(b => (
          <div key={b.key} className={`bg-[#1e293b] rounded-xl border ${b.border} p-5`}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${b.bg} ${b.color} border ${b.border}`}>
                Bloque {b.letra}
              </span>
              <span className={`text-sm font-semibold ${b.color}`}>{b.titulo}</span>
            </div>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-3 bg-slate-700/60 rounded animate-pulse" style={{ width: `${96 - i * 9}%` }} />
                ))}
              </div>
            ) : (
              <p className="text-slate-200 text-xs leading-relaxed">
                {resumen?.resumenBloques?.[b.key] ?? "Informacion no disponible"}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function Modulo1() {
  const [ticker, setTicker]                         = useState("");
  const [cargando, setCargando]                     = useState(false);
  const [estado, setEstado]                         = useState("");
  const [error, setError]                           = useState("");
  const [datos, setDatos]                           = useState<DatosAnalisis | null>(null);
  const [tabActiva, setTabActiva]                   = useState<"item1" | "item1a" | "item7">("item1");
  const [datosYahoo, setDatosYahoo]                 = useState<DatosYahoo | null>(null);
  const [cargandoYahoo, setCargandoYahoo]           = useState(false);
  const [datosGlassdoor, setDatosGlassdoor]         = useState<DatosGlassdoor | null>(null);
  const [cargandoGlassdoor, setCargandoGlassdoor]   = useState(false);
  const [datosSEC, setDatosSEC]                     = useState<DatosSEC | null>(null);
  const [cargandoSEC, setCargandoSEC]               = useState(false);
  const [respuestas, setRespuestas]                 = useState<Respuestas | null>(null);
  const [fuentes, setFuentes]                       = useState<Fuentes>({});
  const [resumen, setResumen]                       = useState<ResumenEjecutivo | null>(null);
  const [cargandoResumen, setCargandoResumen]       = useState(false);
  const [itemsEs, setItemsEs]                       = useState<ItemsEs | null>(null);
  const [cargandoTraduccion, setCargandoTraduccion] = useState(false);
  const [ultimaDescarga, setUltimaDescarga]         = useState<{ ticker: string; empresa: string; fechaHora: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("mr_ultima_descarga_m1");
      if (raw) setUltimaDescarga(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  // Cuando llega la traduccion, recalcular respuestas si el analisis ya fue generado
  useEffect(() => {
    if (itemsEs && datos && respuestas) {
      const { respuestas: r, fuentes: f } = calcularRespuestas(datos, datosYahoo, datosGlassdoor, datosSEC, itemsEs);
      setRespuestas(r);
      setFuentes(f);
    }
  }, [itemsEs]); // eslint-disable-line react-hooks/exhaustive-deps

  function analizar() {
    const tick = ticker.trim().toUpperCase();
    if (!tick || cargando) return;

    setCargando(true);
    setEstado("Iniciando...");
    setError("");
    setDatos(null);
    setDatosYahoo(null);
    setDatosGlassdoor(null);
    setDatosSEC(null);
    setRespuestas(null);
    setFuentes({});
    setResumen(null);
    setCargandoResumen(false);
    setItemsEs(null);
    setCargandoTraduccion(false);
    setCargandoYahoo(true);
    setCargandoGlassdoor(false);
    setCargandoSEC(true);

    // Yahoo Finance en paralelo
    fetch(`/api/yahoo?ticker=${tick}`)
      .then(r => r.json())
      .then(d => { setDatosYahoo(d); setCargandoYahoo(false); })
      .catch(() => { setDatosYahoo({ error: "sin datos" }); setCargandoYahoo(false); });

    // SEC DEF 14A + 13F-HR en paralelo
    fetch(`/api/sec?ticker=${tick}`)
      .then(r => r.json())
      .then(d => { setDatosSEC(d); setCargandoSEC(false); })
      .catch(() => { setDatosSEC({ error: "sin datos" }); setCargandoSEC(false); });

    // SEC EDGAR vía SSE
    const temp: Partial<DatosAnalisis> = {};
    const es = new EventSource(`/api/analizar?ticker=${tick}`);

    es.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);

      if (msg.tipo === "estado") {
        setEstado(msg.mensaje);

      } else if (msg.tipo === "empresa") {
        temp.nombre = msg.nombre;
        temp.cik    = msg.cik;
        setCargandoGlassdoor(true);
        fetch(`/api/glassdoor?ticker=${tick}&empresa=${encodeURIComponent(msg.nombre)}`)
          .then(r => r.json())
          .then(d => { setDatosGlassdoor(d); setCargandoGlassdoor(false); })
          .catch(() => { setDatosGlassdoor({ error: "sin datos" }); setCargandoGlassdoor(false); });

      } else if (msg.tipo === "filing") {
        temp.filing = { accession: msg.accession, fecha: msg.fecha };

      } else if (msg.tipo === "documento") {
        temp.documento = { url: msg.url, nombre: msg.nombre };

      } else if (msg.tipo === "items") {
        temp.items = msg.items;

      } else if (msg.tipo === "completo") {
        const datosFinales = temp as DatosAnalisis;
        setDatos(datosFinales);
        setCargando(false);
        setEstado("");
        es.close();

        // Traducir los 3 items al espanol en paralelo con el resto
        setCargandoTraduccion(true);
        fetch("/api/traducir", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            item1:  datosFinales.items.item1.contenido,
            item1a: datosFinales.items.item1a.contenido,
            item7:  datosFinales.items.item7.contenido,
          }),
        })
          .then(r => r.json())
          .then((d: ItemsEs) => { if (d.item1_es) { setItemsEs(d); } setCargandoTraduccion(false); })
          .catch(() => setCargandoTraduccion(false));

      } else if (msg.tipo === "error") {
        setError(msg.mensaje);
        setCargando(false);
        setEstado("");
        es.close();
      }
    };

    es.onerror = () => {
      setError("Error de conexión con el servidor. Intenta de nuevo.");
      setCargando(false);
      setEstado("");
      es.close();
    };
  }

  function generarPreguntas() {
    if (!datos) return;
    const { respuestas: r, fuentes: f } = calcularRespuestas(datos, datosYahoo, datosGlassdoor, datosSEC, itemsEs);
    setRespuestas(r);
    setFuentes(f);

    const tick    = ticker.trim().toUpperCase();
    const empresa = datos.nombre;

    // Groq: traducciones + resumen ejecutivo
    setCargandoResumen(true);
    setResumen(null);
    fetch("/api/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker: tick, empresa, respuestas: r }),
    })
      .then(res => res.json())
      .then(d => { setResumen(d as ResumenEjecutivo); setCargandoResumen(false); })
      .catch(() => {
        setResumen({ error: "No se pudo conectar con Groq. Verifica que GROQ_API_KEY esté configurada en .env.local." });
        setCargandoResumen(false);
      });

    // DuckDuckGo: fallback para secciones vacías (en paralelo con Groq)
    fetch(`/api/ddg?ticker=${tick}&empresa=${encodeURIComponent(empresa)}`)
      .then(res => res.json())
      .then((ddg: Record<string, string>) => {
        const NA_STR  = "Informacion no disponible";
        const DDG_SRC = "DuckDuckGo";
        const respUpdate: Record<string, string> = {};
        const fuUpdate: Record<string, string>   = {};

        // Preguntas específicas
        for (const k of ["p9", "p16", "p17", "p18"] as const) {
          if (ddg[k] && r[k] === NA_STR) { respUpdate[k] = ddg[k]; fuUpdate[k] = DDG_SRC; }
        }
        // Sección mercado → p20, p21
        if (ddg.mercado) {
          if (r.p20 === NA_STR) { respUpdate.p20 = ddg.mercado; fuUpdate.p20 = DDG_SRC; }
          if (r.p21 === NA_STR) { respUpdate.p21 = ddg.mercado; fuUpdate.p21 = DDG_SRC; }
        }
        // Sección empleados → p22
        if (ddg.empleados && r.p22 === NA_STR) { respUpdate.p22 = ddg.empleados; fuUpdate.p22 = DDG_SRC; }
        // Sección gobierno → p10, p12, p13, p14, p15
        if (ddg.gobierno) {
          for (const k of ["p10", "p12", "p13", "p14", "p15"]) {
            if (r[k] === NA_STR) { respUpdate[k] = ddg.gobierno; fuUpdate[k] = DDG_SRC; }
          }
        }
        // Sección accionistas → p11
        if (ddg.accionistas && r.p11 === NA_STR) { respUpdate.p11 = ddg.accionistas; fuUpdate.p11 = DDG_SRC; }

        if (Object.keys(respUpdate).length > 0) {
          setRespuestas(prev => prev ? { ...prev, ...respUpdate } : prev);
          setFuentes(prev => ({ ...prev, ...fuUpdate }));
        }
      })
      .catch(() => {});
  }

  const haStarted = cargando || cargandoYahoo || cargandoSEC || datos !== null || datosYahoo !== null || datosSEC !== null;
  const gdLoading  = cargandoGlassdoor || (datosGlassdoor === null && cargando);

  return (
    <main className="min-h-screen bg-[#0f172a] flex flex-col">

      {/* Header */}
      <header className="w-full border-b border-slate-800 bg-[#0d1526]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#f59e0b] flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-[#0f172a]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-8 4 5 3-3 4 6" />
              </svg>
            </div>
            <Link href="/" className="text-xl font-bold tracking-wide text-white font-serif hover:text-[#f59e0b] transition-colors">
              Master<span className="text-[#f59e0b]">Research</span>
            </Link>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-400">
            <Link href="/" className="hover:text-[#f59e0b] transition-colors">Inicio</Link>
            <span className="text-[#f59e0b] font-medium">Módulos</span>
          </nav>
        </div>
      </header>

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 w-full">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/" className="hover:text-[#f59e0b] transition-colors">Inicio</Link>
          <span>/</span>
          <span className="text-[#f59e0b]">Módulo 1 — Análisis Cualitativo</span>
        </div>
      </div>

      {/* Contenido */}
      <section className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-8 w-full">

        {/* Título */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">📊</span>
            <span className="px-2 py-0.5 rounded bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-bold uppercase tracking-widest">
              Módulo 1
            </span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold text-white mb-2">Análisis Cualitativo</h1>
          <p className="text-slate-400 text-sm sm:text-base max-w-2xl">
            SEC EDGAR (10-K) · Yahoo Finance · Glassdoor
          </p>
        </div>

        {/* Input */}
        <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-6 sm:p-8 mb-8">
          <div className="flex flex-col sm:flex-row gap-3 max-w-lg">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">$</span>
              <input
                type="text"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === "Enter") analizar(); }}
                placeholder="AAPL, MSFT, TSLA..."
                maxLength={10}
                disabled={cargando}
                className="w-full pl-8 pr-4 py-4 rounded-xl bg-[#0f172a] border border-slate-700 text-white
                           placeholder-slate-600 focus:outline-none focus:border-[#f59e0b] focus:ring-2
                           focus:ring-[#f59e0b]/20 text-base font-mono tracking-widest uppercase
                           transition-all disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={analizar}
              disabled={ticker.trim().length === 0 || cargando}
              className="px-8 py-4 rounded-xl bg-[#f59e0b] text-[#0f172a] font-bold text-sm
                         hover:bg-[#fbbf24] active:bg-[#d97706] transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed
                         shadow-lg shadow-[#f59e0b]/20 whitespace-nowrap"
            >
              {cargando ? "Analizando..." : "Analizar empresa"}
            </button>
          </div>
        </div>

        {/* Spinner SEC */}
        {cargando && (
          <div className="flex flex-col items-center justify-center py-12 gap-6 mb-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-slate-700" />
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#f59e0b] animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-[#f59e0b] font-semibold text-lg mb-1">{estado}</p>
              <p className="text-slate-500 text-sm">Consultando SEC EDGAR — puede tardar unos segundos</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {["Buscando empresa...", "Buscando 10-K más reciente...", "Descargando 10-K más reciente...", "Extrayendo información..."].map(paso => (
                <div key={paso} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  ${estado === paso
                    ? "bg-[#f59e0b]/20 border border-[#f59e0b]/50 text-[#f59e0b]"
                    : "bg-slate-800/50 border border-slate-700 text-slate-600"}`}>
                  {paso}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tarjetas Yahoo + Glassdoor */}
        {haStarted && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            <TarjetaYahoo     d={datosYahoo}     loading={cargandoYahoo} />
            <TarjetaGlassdoor d={datosGlassdoor} loading={gdLoading} />
          </div>
        )}

        {/* Tarjetas Gobierno Corporativo + Accionistas Institucionales */}
        {haStarted && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            <TarjetaGobierno       d={datosSEC} loading={cargandoSEC} />
            <TarjetaAccionistas13F d={datosSEC} loading={cargandoSEC} />
          </div>
        )}

        {/* Error */}
        {error && !cargando && (
          <div className="rounded-xl bg-red-950/40 border border-red-700/50 p-5 text-red-400 flex gap-3 items-start mb-8">
            <span className="text-xl mt-0.5">⚠️</span>
            <div>
              <p className="font-semibold text-sm mb-1">Error al analizar</p>
              <p className="text-xs text-red-500">{error}</p>
            </div>
          </div>
        )}

        {/* Resultados SEC */}
        {datos && !cargando && (
          <div className="space-y-6">

            {/* Cabecera empresa */}
            <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-white font-bold text-xl font-serif">{datos.nombre}</h2>
                <div className="flex flex-wrap gap-3 mt-2">
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                    CIK: <span className="text-slate-200 font-mono">{datos.cik}</span>
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
                    10-K: <span className="text-slate-200 font-mono">{datos.filing.fecha}</span>
                  </span>
                  <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded font-mono">
                    {datos.filing.accession}
                  </span>
                </div>
              </div>
              <a href={datos.documento.url} target="_blank" rel="noopener noreferrer"
                className="shrink-0 px-4 py-2 rounded-lg border border-[#f59e0b]/40 text-[#f59e0b] text-xs font-semibold
                           hover:bg-[#f59e0b]/10 transition-colors whitespace-nowrap">
                Ver 10-K original →
              </a>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[#1e293b] rounded-xl p-1 border border-slate-700 w-fit">
              {(["item1", "item1a", "item7"] as const).map(tab => (
                <button key={tab} type="button" onClick={() => setTabActiva(tab)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all
                    ${tabActiva === tab ? "bg-[#f59e0b] text-[#0f172a]" : "text-slate-400 hover:text-white"}`}>
                  {tab === "item1" ? "Item 1" : tab === "item1a" ? "Item 1A" : "Item 7"}
                </button>
              ))}
            </div>

            {/* Contenido tab */}
            <div className="bg-[#1e293b] rounded-2xl border border-slate-700 p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[#f59e0b] font-bold text-sm uppercase tracking-widest">
                  {datos.items[tabActiva].titulo}
                </h3>
                {cargandoTraduccion && (
                  <span className="text-xs text-amber-400 animate-pulse flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    Traduciendo al espanol...
                  </span>
                )}
                {itemsEs && !cargandoTraduccion && (
                  <span className="text-xs text-emerald-400 px-2 py-0.5 rounded bg-emerald-400/10 border border-emerald-400/20">
                    Traducido al espanol
                  </span>
                )}
              </div>
              <div className="bg-[#0f172a] rounded-xl border border-slate-800 p-5">
                <pre className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap font-mono break-words">
                  {tabActiva === "item1"
                    ? (itemsEs?.item1_es  ?? datos.items.item1.contenido)
                    : tabActiva === "item1a"
                    ? (itemsEs?.item1a_es ?? datos.items.item1a.contenido)
                    : (itemsEs?.item7_es  ?? datos.items.item7.contenido)}
                </pre>
              </div>
              <p className="text-slate-600 text-xs mt-3">
                {datos.items[tabActiva].contenido.length.toLocaleString()} caracteres extraídos del 10-K
              </p>
            </div>

          </div>
        )}

        {/* Botón + Sección de 22 preguntas */}
        {datos && !cargando && (
          <div className="mt-8">
            {!respuestas ? (
              <button
                type="button"
                onClick={generarPreguntas}
                className="w-full py-4 rounded-xl border-2 border-dashed border-[#f59e0b]/40 text-[#f59e0b]
                           text-sm font-semibold hover:border-[#f59e0b]/70 hover:bg-[#f59e0b]/5
                           transition-all flex items-center justify-center gap-2"
              >
                <span className="text-lg">🔍</span>
                Generar análisis de 22 preguntas
              </button>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔍</span>
                    <div>
                      <h2 className="text-white font-bold text-lg font-serif">Análisis de 22 Preguntas</h2>
                      <p className="text-slate-500 text-xs">Basado en SEC EDGAR · Yahoo Finance · Glassdoor</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (!respuestas) return;
                          const tick = ticker.trim().toUpperCase();
                          const empresa = datos?.nombre ?? tick;
                          exportarWord({ ticker: tick, empresa, respuestas, resumen: resumen && !resumen.error ? resumen : null });
                          const fechaHora = new Date().toLocaleString("es-ES", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          });
                          const data = { ticker: tick, empresa, fechaHora };
                          localStorage.setItem("mr_ultima_descarga_m1", JSON.stringify(data));
                          setUltimaDescarga(data);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#f59e0b]/10
                                   border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-semibold
                                   hover:bg-[#f59e0b]/20 hover:border-[#f59e0b]/60 transition-all"
                      >
                        <span>📄</span>
                        Exportar a Word
                      </button>
                      {ultimaDescarga && (
                        <p className="text-slate-500 text-[10px]">
                          Último reporte descargado: {ultimaDescarga.fechaHora}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setRespuestas(null)}
                      className="text-slate-500 hover:text-slate-300 text-xs transition-colors"
                    >
                      Cerrar ✕
                    </button>
                  </div>
                </div>
                <SeccionPreguntas respuestas={respuestas} respuestasEsp={resumen?.respuestasEsp} fuentes={fuentes} />
                <SeccionResumenesBloques resumen={resumen} loading={cargandoResumen} />
                <TarjetaResumen d={resumen} loading={cargandoResumen} />
              </div>
            )}
          </div>
        )}

        {/* Placeholder inicial */}
        {!haStarted && !error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icono: "🏭", titulo: "Modelo de Negocio" },
              { icono: "🛡️", titulo: "Ventaja Competitiva (Moat)" },
              { icono: "🌍", titulo: "Posición en el Mercado" },
              { icono: "👔", titulo: "Calidad de la Gestión" },
              { icono: "⚠️", titulo: "Factores de Riesgo" },
              { icono: "🔮", titulo: "Perspectivas de Crecimiento" },
            ].map(item => (
              <div key={item.titulo} className="p-5 rounded-xl bg-[#1e293b] border border-slate-700/50 opacity-50">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xl">{item.icono}</span>
                  <h3 className="text-slate-300 font-semibold text-sm">{item.titulo}</h3>
                </div>
                <div className="mt-4 h-2 bg-slate-700/50 rounded-full">
                  <div className="h-2 w-1/3 bg-slate-600 rounded-full" />
                </div>
                <p className="text-slate-600 text-xs mt-2">Ingresa un ticker para ver datos</p>
              </div>
            ))}
          </div>
        )}

      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-5 text-center text-slate-600 text-xs mt-8">
        © {new Date().getFullYear()} MasterResearch · Análisis Fundamental Profesional
      </footer>
    </main>
  );
}
