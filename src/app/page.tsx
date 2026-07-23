import Link from "next/link";
import { listAlchemy, listMaterials, listReflections, listStories, homeRoot } from "../lib/store";
import { currentModelLabel, currentProvider } from "../lib/ai";
import { HomeShortcuts } from "./_components/HomeShortcuts";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [materials, stories, alchemy, reflections] = await Promise.all([
    listMaterials(),
    listStories(),
    listAlchemy(),
    listReflections(),
  ]);
  const active = stories.filter((s) => !s.completedAt);
  const done = stories.filter((s) => s.completedAt);

  return (
    <div className="fade-in">
      <header style={{ marginBottom: "var(--space-8)" }}>
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
          写作工作室
        </div>
        <h1 style={{ fontSize: "2.4rem", marginBottom: "var(--space-3)" }}>
          今天，我们想写一点什么？
        </h1>
        <p className="muted" style={{ maxWidth: 640, fontSize: "1.05rem", lineHeight: 1.8 }}>
          「故事创作」是主舞台。写到需要的时候，从左侧唤出「素材」或「灵感炼金」抽屉——它们不会打断你正在写的故事。
          写完之后，再回到「反思回顾」慢慢回望。
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-8)",
        }}
      >
        <Stat label="素材" value={materials.length} unit="份" />
        <Stat label="进行中的故事" value={active.length} unit="篇" />
        <Stat label="炼金记录" value={alchemy.length} unit="次" />
        <Stat label="已完成 & 反思" value={done.length + reflections.length} unit="项" />
      </section>

      <HomeShortcuts />

      <section style={{ marginTop: "var(--space-8)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: "var(--space-4)",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", margin: 0 }}>进行中的故事</h2>
          <Link href="/write" style={{ fontSize: "0.9rem" }}>
            全部故事 →
          </Link>
        </div>
        {active.length === 0 ? (
          <div className="card" style={{ padding: "var(--space-5)" }}>
            <p className="muted">还没有进行中的故事。到「故事创作」开一个新故事吧。</p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            {active.slice(0, 6).map((s) => (
              <Link
                key={s.id}
                href={`/write/${s.id}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                  padding: "var(--space-4)",
                  background: "var(--card)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius-lg)",
                  color: "var(--ink)",
                  textDecoration: "none",
                  boxShadow: "var(--shadow-1)",
                }}
              >
                <span className="tag tag-accent">故事</span>
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                  }}
                >
                  {s.title}
                </span>
                <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                  更新于 {new Date(s.updatedAt).toLocaleDateString("zh-CN")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section
        className="card"
        style={{
          marginTop: "var(--space-8)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        <div>
          <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "var(--space-1)" }}>
            数据存放
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>{homeRoot()}</div>
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          AI 引擎：
          <strong style={{ color: "var(--ink)", marginLeft: 4 }}>{currentProvider()}</strong>
          <span className="muted" style={{ marginLeft: 6 }}>· {currentModelLabel()}</span>
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="card" style={{ padding: "var(--space-4)" }}>
      <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "var(--space-2)" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2rem",
            fontWeight: 700,
            color: "var(--ink)",
          }}
        >
          {value}
        </span>
        <span style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>{unit}</span>
      </div>
    </div>
  );
}
