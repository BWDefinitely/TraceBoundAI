"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useDrawers } from "./AppShell";

export function Sidebar() {
  const pathname = usePathname();
  const { open, openDrawer } = useDrawers();

  const drawerActive = (k: "materials" | "alchemy") => open === k;
  const routeActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      style={{
        borderRight: "1px solid var(--line)",
        background: "var(--paper-soft)",
        padding: "var(--space-6) var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-5)",
        position: "sticky",
        top: 0,
        height: "100vh",
        overflow: "auto",
      }}
    >
      <Link
        href="/"
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.2rem",
          fontWeight: 700,
          color: "var(--ink)",
          textDecoration: "none",
          display: "flex",
          alignItems: "baseline",
          gap: "0.4rem",
          padding: "0 var(--space-2)",
        }}
      >
        <span style={{ color: "var(--accent)", fontSize: "1.4rem" }}>❋</span>
        Trace-Bound
      </Link>

      <nav style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <NavSection title="写作工作台">
          <NavLink
            href="/write"
            active={routeActive("/write")}
            index={1}
            label="故事创作"
            hint="主舞台：故事线与正文"
            variant="primary"
          />
        </NavSection>

        <NavSection title="随时打开 · 不打断当前故事">
          <DrawerButton
            active={drawerActive("materials")}
            onClick={() => openDrawer("materials")}
            index="◑"
            label="素材采集与回顾"
            hint="记录、翻看、编辑素材"
          />
          <DrawerButton
            active={drawerActive("alchemy")}
            onClick={() => openDrawer("alchemy")}
            index="✦"
            label="灵感炼金"
            hint="两份素材 → 一段联想"
            variant="amber"
          />
        </NavSection>

        <NavSection title="写完之后">
          <NavLink
            href="/reflect"
            active={routeActive("/reflect")}
            index={2}
            label="反思回顾"
            hint="回望这次写作旅程"
          />
        </NavSection>
      </nav>

      <div style={{ marginTop: "auto", padding: "0 var(--space-2)" }}>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--ink-soft)",
            lineHeight: 1.6,
            padding: "var(--space-3)",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
          }}
        >
          写作没有对错。
          <br />
          今天写一点点，也很棒。
        </div>
      </div>
    </aside>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-2)" }}>
      <div
        style={{
          fontSize: "0.7rem",
          fontWeight: 700,
          color: "var(--ink-soft)",
          letterSpacing: "0.1em",
          padding: "0 var(--space-2)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function NavLink({
  href,
  active,
  index,
  label,
  hint,
  variant = "default",
}: {
  href: string;
  active: boolean;
  index: number | string;
  label: string;
  hint: string;
  variant?: "default" | "primary";
}) {
  const accent = variant === "primary" ? "var(--accent)" : "var(--accent)";
  return (
    <Link
      href={href}
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        borderRadius: "var(--radius)",
        background: active ? "var(--card)" : "transparent",
        boxShadow: active ? "var(--shadow-1)" : "none",
        border: active ? "1px solid var(--line)" : "1px solid transparent",
        color: active ? "var(--ink)" : "var(--ink-soft)",
        textDecoration: "none",
      }}
    >
      <Chip active={active} color={accent}>
        {index}
      </Chip>
      <TextBlock label={label} hint={hint} />
    </Link>
  );
}

function DrawerButton({
  active,
  onClick,
  index,
  label,
  hint,
  variant = "default",
}: {
  active: boolean;
  onClick: () => void;
  index: string;
  label: string;
  hint: string;
  variant?: "default" | "amber";
}) {
  const color = variant === "amber" ? "var(--amber)" : "var(--accent)";
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        display: "grid",
        gridTemplateColumns: "28px 1fr",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        borderRadius: "var(--radius)",
        background: active ? "var(--card)" : "transparent",
        boxShadow: active ? "var(--shadow-1)" : "none",
        border: active ? `1px solid ${color}` : "1px solid transparent",
        color: active ? "var(--ink)" : "var(--ink-soft)",
        textAlign: "left",
        cursor: "pointer",
        fontWeight: 400,
        transition: "border-color 0.15s ease, background 0.15s ease",
      }}
    >
      <Chip active={active} color={color}>
        {index}
      </Chip>
      <TextBlock label={label} hint={hint} />
    </button>
  );
}

function Chip({ active, color, children }: { active: boolean; color: string; children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      style={{
        width: 28,
        height: 28,
        borderRadius: "50%",
        background: active ? color : "var(--paper)",
        color: active ? "white" : "var(--ink-soft)",
        fontFamily: "var(--font-serif)",
        fontSize: "0.85rem",
        fontWeight: 700,
        display: "grid",
        placeItems: "center",
        border: active ? "none" : "1px solid var(--line)",
      }}
    >
      {children}
    </span>
  );
}

function TextBlock({ label, hint }: { label: string; hint: string }) {
  return (
    <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.25 }}>
      <span style={{ fontWeight: 600, fontSize: "0.95rem" }}>{label}</span>
      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>{hint}</span>
    </span>
  );
}
