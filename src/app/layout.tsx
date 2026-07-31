"use client";

import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "./_components/AppShell";
import { DataProvider } from "./_components/DataProvider";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <title>Trace-Bound · 我的写作工作室</title>
        <meta name="description" content="把生活的碎片慢慢写成属于你自己的故事。" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Noto+Serif+SC:wght@500;600;700&display=swap"
        />
      </head>
      <body suppressHydrationWarning>
        <DataProvider>
          <AppShell>{children}</AppShell>
        </DataProvider>
      </body>
    </html>
  );
}
