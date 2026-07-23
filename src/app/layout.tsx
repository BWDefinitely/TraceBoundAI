import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "我的轨迹故事 | Trace-Bound AI",
  description: "收集你的轨迹,反思你的想法,写下属于你自己的故事。",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
