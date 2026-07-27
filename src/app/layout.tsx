import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";

import "./globals.css";

// Playfair para lo que se lee una vez y tiene que quedar; Montserrat para
// todo lo que se usa. La combinación viene de la guía de marca.
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

// Genérico a propósito: el título de cada barbería se resuelve por página, a
// partir de sus datos.
export const metadata: Metadata = {
  title: "Reservá tu turno",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-UY"
      className={`${playfair.variable} ${montserrat.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
