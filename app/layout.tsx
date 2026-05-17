import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MasterResearch — Análisis Fundamental de Acciones",
  description: "Plataforma profesional de análisis fundamental de acciones bursátiles",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased bg-[#0f172a] text-slate-200">
        {children}
      </body>
    </html>
  );
}
