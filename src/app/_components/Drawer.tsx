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
          background: "rgba(30, 20, 60, 0.32)",
          backdropFilter: "blur(2px)",
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
          top: "var(--space-3)",
          right: "var(--space-3)",
          bottom: "var(--space-3)",
          width: `min(${width}px, 96vw)`,
          background: "linear-gradient(180deg, #FFFFFF 0%, #FBFAFF 100%)",
          borderRadius: "var(--radius-xl)",
          border: "1px solid var(--line-soft)",
          boxShadow: "var(--shadow-3)",
          transform: open ? "translateX(0)" : "translateX(110%)",
          transition: "transform 0.28s cubic-bezier(0.22, 1, 0.36, 1)",
          zIndex: 41,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <header
          style={{
            padding: "var(--space-4) var(--space-5)",
            borderBottom: "1px solid var(--line-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-3)",
            background: `linear-gradient(135deg, ${accent}18 0%, transparent 60%)`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              className="eyebrow"
              style={{ color: accent, marginBottom: 2 }}
            >
              侧边工具 · 不会打断正文
            </div>
            <h2
              style={{
                fontFamily: "var(--font-round)",
                fontSize: "1.35rem",
                fontWeight: 900,
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
            style={{
              fontSize: "1.3rem",
              padding: "0.1rem 0.7rem",
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "white",
              boxShadow: "var(--shadow-1)",
            }}
          >
            ×
          </button>
        </header>
        <div style={{ flex: 1, overflow: "auto", padding: "var(--space-5)" }}>{children}</div>
      </aside>
    </>
  );
}
