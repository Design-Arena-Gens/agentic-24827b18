import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Terminal Mentor | Asistente de Ciberseguridad",
  description:
    "Asistente interactivo estilo terminal para aprender ciberseguridad con laboratorios, quizzes y rutas de estudio.",
  keywords: [
    "ciberseguridad",
    "terminal",
    "mentor virtual",
    "aprendizaje interactivo",
    "laboratorios",
  ],
  authors: [{ name: "Terminal Mentor" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
