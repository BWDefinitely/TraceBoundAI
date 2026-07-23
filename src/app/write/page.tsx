import Link from "next/link";
import { listStories, readStoryBody, type Story, type StorylineBeat } from "../../lib/store";
import { PageHeader } from "../_components/PageHeader";
import { DeleteStoryButton, NewStoryButton, ReopenStoryButton } from "./ClientBits";

export const dynamic = "force-dynamic";

export default async function WritePage() {
  const stories = await listStories();
  const withBody = await Promise.all(
    stories.map(async (s) => ({ ...s, preview: (await readStoryBody(s.id)).slice(0, 140) }))
  );
  const active = withBody.filter((s) => !s.completedAt);
  const completed = withBody.filter((s) => s.completedAt);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="故事创作"
        title="慢慢地写下你的故事"
        intro="这是主舞台。每一篇故事都会先给你一条“起承转合”的故事线做路标。写累了，随时从左边打开素材或炼金抽屉——不会打断当前正文。"
        right={<NewStoryButton />}
      />

      {active.length === 0 && completed.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-8)" }}>
          <p className="muted" style={{ marginBottom: "var(--space-4)" }}>
            还没有故事。开一个新故事吧。
          </p>
          <NewStoryButton />
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <StoriesSection title="进行中" subtitle={`${active.length} 篇正在写`}>
              <StoriesGrid items={active} />
            </StoriesSection>
          )}
          {completed.length > 0 && (
            <StoriesSection title="已完成" subtitle={`${completed.length} 篇 · 可去反思回顾`}>
              <StoriesGrid items={completed} completed />
            </StoriesSection>
          )}
        </>
      )}
    </div>
  );
}

function StoriesSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section style={{ marginBottom: "var(--space-8)" }}>
      <div style={{ marginBottom: "var(--space-4)" }}>
        <h2 style={{ fontSize: "1.2rem", margin: 0 }}>{title}</h2>
        {subtitle && (
          <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginTop: 2 }}>{subtitle}</div>
        )}
      </div>
      {children}
    </section>
  );
}

function StoriesGrid({
  items,
  completed = false,
}: {
  items: Array<Story & { preview: string }>;
  completed?: boolean;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: "var(--space-4)",
      }}
    >
      {items.map((s) => (
        <article
          key={s.id}
          className="card"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-3)",
            opacity: completed ? 0.94 : 1,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className={completed ? "tag tag-amber" : "tag tag-accent"}>
              {completed ? "已完成" : "写作中"}
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
              {completed && s.completedAt
                ? `完成于 ${new Date(s.completedAt).toLocaleDateString("zh-CN")}`
                : `更新于 ${new Date(s.updatedAt).toLocaleDateString("zh-CN")}`}
            </span>
          </div>
          <h3
            style={{
              fontFamily: "var(--font-serif)",
              fontSize: "1.15rem",
              fontWeight: 700,
              margin: 0,
            }}
          >
            {s.title}
          </h3>
          <p
            className="muted"
            style={{ fontSize: "0.9rem", lineHeight: 1.7, whiteSpace: "pre-wrap", minHeight: "3rem" }}
          >
            {s.preview || "（还没有正文）"}
            {s.preview.length >= 140 ? "…" : ""}
          </p>
          <StorylineMini beats={s.storyline} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto" }}>
            {completed ? (
              <>
                <Link href={`/reflect?story=${s.id}`} className="btn-primary">
                  写反思 →
                </Link>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  <ReopenStoryButton id={s.id} />
                  <DeleteStoryButton id={s.id} title={s.title} />
                </div>
              </>
            ) : (
              <>
                <Link href={`/write/${s.id}`} className="btn-primary">
                  继续写 →
                </Link>
                <DeleteStoryButton id={s.id} title={s.title} />
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

function StorylineMini({ beats }: { beats: StorylineBeat }) {
  const items = [
    { key: "起", v: beats.qi },
    { key: "承", v: beats.cheng },
    { key: "转", v: beats.zhuan },
    { key: "合", v: beats.he },
  ];
  return (
    <div style={{ display: "flex", gap: "0.4rem" }}>
      {items.map((it) => (
        <div
          key={it.key}
          title={it.v || `${it.key}（还没填）`}
          style={{
            flex: 1,
            padding: "0.35rem 0",
            borderRadius: "var(--radius-sm)",
            background: it.v ? "var(--accent-wash)" : "var(--paper-soft)",
            color: it.v ? "var(--accent)" : "var(--ink-soft)",
            border: `1px solid ${it.v ? "var(--accent-soft)" : "var(--line)"}`,
            fontSize: "0.75rem",
            fontWeight: 700,
            textAlign: "center",
            fontFamily: "var(--font-serif)",
          }}
        >
          {it.key}
        </div>
      ))}
    </div>
  );
}
