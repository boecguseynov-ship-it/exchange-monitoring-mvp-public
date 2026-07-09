/* eslint-disable @next/next/no-css-tags */
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { Analytics } from "@/components/analytics";
import "./globals.css";

const manrope = Manrope({
  subsets: ["cyrillic", "latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700", "800"]
});

export const metadata: Metadata = {
  metadataBase: new URL("https://monik.exchange"),
  title: "monik exchange — мониторинг обменников",
  description: "Сравнение курсов, резервов и репутации обменных пунктов",
  alternates: {
    canonical: "/"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <head>
        <link rel="stylesheet" href="/theme-orange.css?v=29" />
        <meta name="yandex-verification" content="a5282f7a0264422" />
      </head>
      <body className={manrope.variable}>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
