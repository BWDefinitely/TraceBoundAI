import type { ReactNode } from "react";

interface Props {
  eyebrow?: string;
  title: string;
  intro?: string;
  right?: ReactNode;
}

export function PageHeader({ eyebrow, title, intro, right }: Props) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: "var(--space-5)",
        marginBottom: "var(--space-6)",
      }}
    >
      <div style={{ minWidth: 0 }}>
        {eyebrow && (
          <div
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.14em",
              fontWeight: 700,
              color: "var(--accent)",
              textTransform: "uppercase",
              marginBottom: "var(--space-2)",
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1 style={{ marginBottom: intro ? "var(--space-2)" : 0 }}>{title}</h1>
        {intro && (
          <p className="muted" style={{ maxWidth: 640, fontSize: "1rem", lineHeight: 1.7 }}>
            {intro}
          </p>
        )}
      </div>
      {right && <div>{right}</div>}
    </header>
  );
}
