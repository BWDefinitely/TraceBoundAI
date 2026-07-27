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
          <div className="eyebrow" style={{ marginBottom: "var(--space-2)" }}>
            {eyebrow}
          </div>
        )}
        <h1 style={{ marginBottom: intro ? "var(--space-2)" : 0 }}>
          <span className="underline-brush">{title}</span>
        </h1>
        {intro && (
          <p className="muted" style={{ maxWidth: 660, fontSize: "1rem", lineHeight: 1.75 }}>
            {intro}
          </p>
        )}
      </div>
      {right && <div>{right}</div>}
    </header>
  );
}
