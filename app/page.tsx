"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [ticker, setTicker] = useState("");
  const router = useRouter();

  return (
    <main className="min-h-screen bg-[#0f172a] flex flex-col">
      {/* ── Header ── */}
      <header className="w-full border-b border-slate-800 bg-[#0d1526]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#f59e0b] flex items-center justify-center flex-shrink-0">
              <svg
                className="w-5 h-5 text-[#0f172a]"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l4-8 4 5 3-3 4 6" />
              </svg>
            </div>
            <span className="text-xl font-bold tracking-wide text-white font-serif">
              Master<span className="text-[#f59e0b]">Research</span>
            </span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm text-slate-400">
            <a href="/" className="hover:text-[#f59e0b] transition-colors">Inicio</a>
            <a href="/modulo1" className="hover:text-[#f59e0b] transition-colors">Módulos</a>
            <a href="#" className="hover:text-[#f59e0b] transition-colors">Acerca de</a>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-16 sm:py-24 relative overflow-hidden">
        {/* Glow decorativo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[#f59e0b]/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-2xl text-center">
          {/* Badge */}
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-[#f59e0b] text-xs font-semibold uppercase tracking-widest mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b] animate-pulse" />
            Análisis Profesional
          </span>

          {/* Título */}
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-4">
            Análisis{" "}
            <span className="text-[#f59e0b]">Fundamental</span>
            <br />
            de Acciones
          </h1>

          <p className="text-slate-400 text-base sm:text-lg leading-relaxed mb-12 max-w-xl mx-auto">
            Ingresa el ticker de una empresa y obtén un análisis completo:
            ratios financieros, valoración, tendencias y mucho más.
          </p>

          {/* Input + Botón */}
          <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg mx-auto">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">
                $
              </span>
              <input
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL, MSFT, TSLA..."
                maxLength={10}
                className="w-full pl-8 pr-4 py-4 rounded-xl bg-[#1e293b] border border-slate-700 text-white placeholder-slate-500
                           focus:outline-none focus:border-[#f59e0b] focus:ring-2 focus:ring-[#f59e0b]/20
                           text-base font-mono tracking-wider uppercase transition-all"
              />
            </div>
            <button
              type="button"
              disabled={ticker.trim().length === 0}
              onClick={() => router.push(`/modulo1?ticker=${ticker.trim()}`)}
              className="px-8 py-4 rounded-xl bg-[#f59e0b] text-[#0f172a] font-bold text-base
                         hover:bg-[#fbbf24] active:bg-[#d97706] transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed
                         shadow-lg shadow-[#f59e0b]/20 whitespace-nowrap"
            >
              Analizar
            </button>
          </div>

          <p className="mt-4 text-slate-600 text-xs">
            Ingresa el símbolo bursátil en inglés — ej: AAPL para Apple Inc.
          </p>
        </div>

        {/* Tarjetas de módulos */}
        <div className="relative z-10 w-full max-w-4xl mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: "📊",
              titulo: "Análisis Cualitativo",
              desc: "Modelo de negocio, ventajas competitivas y posición en el mercado.",
              href: "/modulo1",
              activo: true,
            },
            {
              icon: "📈",
              titulo: "Ratios Financieros",
              desc: "P/E, EV/EBITDA, ROE, márgenes y métricas de deuda.",
              href: "#",
              activo: false,
            },
            {
              icon: "💰",
              titulo: "Valoración DCF",
              desc: "Flujos descontados, precio objetivo y margen de seguridad.",
              href: "#",
              activo: false,
            },
          ].map((mod) => (
            <a
              key={mod.titulo}
              href={mod.href}
              className={`group p-5 rounded-xl border transition-all duration-200 text-left
                ${mod.activo
                  ? "bg-[#1e293b] border-[#f59e0b]/40 hover:border-[#f59e0b]"
                  : "bg-[#1e293b] border-slate-700/60 hover:border-slate-600 cursor-not-allowed opacity-60"
                }`}
            >
              <div className="text-2xl mb-3">{mod.icon}</div>
              <h3 className={`font-semibold text-sm mb-1 transition-colors
                ${mod.activo ? "text-white group-hover:text-[#f59e0b]" : "text-slate-400"}`}>
                {mod.titulo}
              </h3>
              <p className="text-slate-500 text-xs leading-relaxed">{mod.desc}</p>
              {mod.activo && (
                <span className="inline-block mt-3 text-[#f59e0b] text-xs font-semibold">
                  Disponible →
                </span>
              )}
              {!mod.activo && (
                <span className="inline-block mt-3 text-slate-600 text-xs">
                  Próximamente
                </span>
              )}
            </a>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-5 text-center text-slate-600 text-xs">
        © {new Date().getFullYear()} MasterResearch · Análisis Fundamental Profesional
      </footer>
    </main>
  );
}
