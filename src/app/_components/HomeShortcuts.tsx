"use client";

import Link from "next/link";
import { useDrawers } from "./AppShell";

export function HomeShortcuts() {
  const { openDrawer } = useDrawers();

  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        gap: "var(--space-4)",
      }}
    >
      <ShortcutCard
        as="link"
        href="/outdoor"
        title="户外任务"
        chip="阶段 1"
        emoji="🤖"
        color="var(--green)"
        wash="var(--green-wash)"
        desc="跟着机器人小伙伴去校园里慢观察，找一个容易被忽略的地方，带回值得写的线索。"
        cta="出发去观察"
      />
      <ShortcutCard
        as="link"
        href="/write"
        title="故事创作"
        chip="主舞台"
        emoji="✏️"
        color="var(--accent)"
        wash="var(--accent-wash)"
        desc="按 6 个部分搭好故事线，慢慢写下正文。系统自动保存。"
        cta="打开故事列表"
      />
      <ShortcutCard
        as="button"
        onClick={() => openDrawer("materials")}
        title="素材采集与回顾"
        chip="侧边抽屉"
        emoji="🌿"
        color="var(--green)"
        wash="var(--green-wash)"
        desc="随时记下一小片生活，或翻看之前采集的素材。不打断当前故事。"
        cta="打开素材抽屉"
      />
      <ShortcutCard
        as="button"
        onClick={() => openDrawer("alchemy")}
        title="灵感炼金"
        chip="侧边抽屉"
        emoji="✨"
        color="var(--accent)"
        wash="var(--accent-wash)"
        desc="把两份素材放进炼金釜。AI 会给出一段联想火花。不打断当前故事。"
        cta="打开炼金釜"
      />
      <ShortcutCard
        as="link"
        href="/reflect"
        title="创作旅程回顾"
        chip="写完之后"
        emoji="🌈"
        color="var(--amber)"
        wash="var(--amber-wash)"
        desc="回望这次写作旅程，看看想法怎么一步步变成故事。"
        cta="去写反思"
      />
    </section>
  );
}

interface CardBase {
  title: string;
  chip: string;
  emoji: string;
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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "var(--space-3)",
          gap: "var(--space-2)",
        }}
      >
        <div
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: 52,
            height: 52,
            borderRadius: 18,
            background: props.wash,
            fontSize: "1.7rem",
            border: `1.5px solid ${props.color}30`,
          }}
          aria-hidden
        >
          {props.emoji}
        </div>
        <span
          style={{
            padding: "0.25rem 0.75rem",
            borderRadius: "var(--radius-pill)",
            background: props.wash,
            color: props.color,
            fontSize: "0.72rem",
            fontWeight: 800,
            letterSpacing: "0.06em",
            border: `1px solid ${props.color}30`,
          }}
        >
          {props.chip}
        </span>
      </div>
      <h3
        style={{
          fontFamily: "var(--font-round)",
          fontSize: "1.25rem",
          fontWeight: 900,
          margin: 0,
        }}
      >
        {props.title}
      </h3>
      <p style={{ fontSize: "0.92rem", color: "var(--ink-soft)", lineHeight: 1.7, marginTop: "var(--space-2)" }}>
        {props.desc}
      </p>
      <div
        style={{
          marginTop: "var(--space-4)",
          fontSize: "0.9rem",
          color: props.color,
          fontWeight: 800,
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
    border: "1px solid var(--line-soft)",
    borderRadius: "var(--radius-xl)",
    padding: "var(--space-5)",
    color: "var(--ink)",
    textDecoration: "none",
    boxShadow: "var(--shadow-1)",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "transform 0.18s ease, box-shadow 0.18s ease",
  };

  if (props.as === "link") {
    return (
      <Link href={props.href} style={style} className="card">
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={props.onClick} style={style} className="card">
      {inner}
    </button>
  );
}
