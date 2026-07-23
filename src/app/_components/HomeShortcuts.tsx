"use client";

import Link from "next/link";
import { useDrawers } from "./AppShell";

export function HomeShortcuts() {
  const { openDrawer } = useDrawers();

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "var(--space-4)",
      }}
    >
      <ShortcutCard
        as="link"
        href="/write"
        title="故事创作"
        chip="主舞台"
        color="var(--accent)"
        wash="var(--accent-wash)"
        desc="按“起承转合”搭好故事线，慢慢写下正文。系统自动保存。"
        cta="打开故事列表"
      />
      <ShortcutCard
        as="button"
        onClick={() => openDrawer("materials")}
        title="素材采集与回顾"
        chip="侧边抽屉"
        color="var(--accent)"
        wash="var(--accent-wash)"
        desc="随时记下一小片生活，或翻看之前采集的素材。不打断当前故事。"
        cta="打开素材抽屉"
      />
      <ShortcutCard
        as="button"
        onClick={() => openDrawer("alchemy")}
        title="灵感炼金"
        chip="侧边抽屉"
        color="var(--amber)"
        wash="var(--amber-wash)"
        desc="把两份素材放进炼金釜。AI 会给出一段联想火花。不打断当前故事。"
        cta="打开炼金釜"
      />
      <ShortcutCard
        as="link"
        href="/reflect"
        title="反思回顾"
        chip="写完之后"
        color="var(--accent)"
        wash="var(--accent-wash)"
        desc="回望这次写作的旅程，把感受留下来，让下一次更好。"
        cta="去写反思"
      />
    </section>
  );
}

interface CardBase {
  title: string;
  chip: string;
  desc: string;
  color: string;
  wash: string;
  cta: string;
}
type CardProps =
  | (CardBase & { as: "link"; href: string })
  | (CardBase & { as: "button"; onClick: () => void });

function ShortcutCard(props: CardProps) {
  const inner = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <span
          style={{
            padding: "0.2rem 0.7rem",
            borderRadius: "var(--radius-pill)",
            background: props.wash,
            color: props.color,
            fontSize: "0.75rem",
            fontWeight: 700,
            border: `1px solid ${props.color}22`,
          }}
        >
          {props.chip}
        </span>
      </div>
      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1.15rem",
          marginBottom: "var(--space-2)",
          margin: 0,
        }}
      >
        {props.title}
      </h3>
      <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", lineHeight: 1.7, marginTop: "var(--space-2)" }}>
        {props.desc}
      </p>
      <div
        style={{
          marginTop: "var(--space-4)",
          fontSize: "0.85rem",
          color: props.color,
          fontWeight: 700,
        }}
      >
        {props.cta} →
      </div>
    </>
  );

  const style: React.CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    background: "var(--card)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-5)",
    color: "var(--ink)",
    textDecoration: "none",
    boxShadow: "var(--shadow-1)",
    cursor: "pointer",
    fontFamily: "inherit",
  };

  if (props.as === "link") {
    return (
      <Link href={props.href} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={props.onClick} style={style}>
      {inner}
    </button>
  );
}
