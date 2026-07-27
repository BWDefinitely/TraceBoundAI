import type { ReactNode } from "react";
import "./globals.css";
import { AppShell } from "./_components/AppShell";
import { listAlchemy, listFirstThoughts, listMaterials, readMaterialBody } from "../lib/store";
import { currentModelLabel, currentProvider } from "../lib/ai";

export const metadata = {
  title: "Trace-Bound · 我的写作工作室",
  description: "把生活的碎片慢慢写成属于你自己的故事。",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [materials, alchemyHistory, firstThoughts] = await Promise.all([
    listMaterials(),
    listAlchemy(),
    listFirstThoughts(),
  ]);
  const materialsWithBody = await Promise.all(
    materials.map(async (m) => ({ ...m, body: await readMaterialBody(m.id) }))
  );
  const [provider, modelLabel] = await Promise.all([currentProvider(), currentModelLabel()]);
  const providerLabel = `${provider} · ${modelLabel}`;

  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700&family=Noto+Serif+SC:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        <AppShell
          materials={materialsWithBody}
          alchemyHistory={alchemyHistory}
          firstThoughts={firstThoughts}
          providerLabel={providerLabel}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
