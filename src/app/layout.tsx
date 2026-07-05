/* eslint-disable @next/next/no-css-tags */
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RateScope — мониторинг обменников",
  description: "Сравнение курсов, резервов и репутации обменных пунктов"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <head>
        <link rel="stylesheet" href="/theme-orange.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
