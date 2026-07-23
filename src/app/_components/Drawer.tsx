"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number;
  color?: "accent" | "amber";
  children: ReactNode;
}

export function Drawer({ open, onClose, title, subtitle, width = 640, color = "accent", children }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const accent = color === "amber" ? "var(--amber)" : "var(--accent)";

  return (
    <>
      {/* 遮罩 */}
      <div
        aria-hidden={!open}
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(31, 22, 8, 0.28)",
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: "opacity 0.2s ease",
          zIndex: 40,
        }}
      />
      {/* 抽屉本体 */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
        aria-label={title}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: `min(${width}px, 96vw)`,
          background: "var(--paper)",
          borderLeft: `4px solid ${accent}`,
          boxShadow: "var(--shadow-3)",
          transform: open ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.25s cubic-bezier(0.22, 1, 0.36, 1)",
          zIndex: 41,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--line)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.7rem",
                letterSpacing: "0.14em",
                fontWeight: 700,
                color: accent,
                textTransform: "uppercase",
                marginBottom: 2,
              }}
            >
              侧边工具 · 不会打断正文
            </div>
            <h2
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1.3rem",
                margin: 0,
              }}
            >
              {title}
            </h2>
            {subtitle && (
              <div className="muted" style={{ fontSize: "0.85rem", marginTop: 2 }}>
                {subtitle}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn-ghost"
            aria-label="关闭"
            style={{ fontSize: "1.4rem", padding: "0.2rem 0.7rem" }}
          >
            ×
          </button>
        </header>
        <div style={{ flex: 1, overflow: "auto", padding: "var(--space-5)" }}>{children}</div>
      </aside>
    </>
  );
}
