"use client";

import { useState, useTransition } from "react";
import type { Reflection, Story } from "../../lib/store";
import { deleteReflectionAction, saveReflectionAction } from "../_actions";

const PROMPTS = [
  "这次写作里，我最喜欢的一段是……",
  "有一个瞬间我很想放弃，那是……",
  "如果再写一次，我会……",
  "这次的故事让我更想去了解……",
  "我最想把这个故事分享给……，因为……",
];

interface Props {
  stories: Story[];
  reflections: Reflection[];
  initialStoryId: string;
}

export function ReflectForm({ stories, reflections, initialStoryId }: Props) {
  // 优先默认选中传进来的故事，其次刚完成的故事，最后第一个进行中的
  const defaultId = (() => {
    if (initialStoryId && stories.some((s) => s.id === initialStoryId)) return initialStoryId;
    const done = stories.find((s) => s.completedAt);
    if (done) return done.id;
    return stories[0]?.id ?? "";
  })();

  const [storyId, setStoryId] = useState<string>(defaultId);
  const [prompt, setPrompt] = useState<string>(PROMPTS[0]);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [answer, setAnswer] = useState("");
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  const storyMap = new Map(stories.map((s) => [s.id, s.title]));
  const selectedStory = storyId ? stories.find((s) => s.id === storyId) : null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: "var(--space-6)" }}>
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div>
          <label htmlFor="ref-story">这次反思是关于哪一篇故事？</label>
          <select id="ref-story" value={storyId} onChange={(e) => setStoryId(e.target.value)}>
            <option value="">（不指定 · 只记录写作旅程的感觉）</option>
            {stories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.completedAt ? "✓ " : ""}
                {s.title}
              </option>
            ))}
          </select>
          {selectedStory?.completedAt && (
            <div style={{ fontSize: "0.8rem", color: "var(--accent)", marginTop: 4 }}>
              这篇故事已完成 · {new Date(selectedStory.completedAt).toLocaleDateString("zh-CN")}
            </div>
          )}
        </div>

        <div>
          <label>挑一个提示（也可以自己写一个）</label>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {PROMPTS.map((p) => (
              <label
                key={p}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-2)",
                  padding: "var(--space-2) var(--space-3)",
                  borderRadius: "var(--radius)",
                  background: prompt === p && !customPrompt ? "var(--accent-wash)" : "var(--paper-soft)",
                  cursor: "pointer",
                  fontSize: "0.95rem",
                  fontWeight: 500,
                  border: `1px solid ${prompt === p && !customPrompt ? "var(--accent-soft)" : "var(--line)"}`,
                }}
              >
                <input
                  type="radio"
                  name="prompt"
                  checked={prompt === p && !customPrompt}
                  onChange={() => {
                    setPrompt(p);
                    setCustomPrompt("");
                  }}
                />
                {p}
              </label>
            ))}
            <input
              type="text"
              placeholder="或者自己写一个提示…"
              value={customPrompt}
              onChange={(e) => {
                setCustomPrompt(e.target.value);
                if (e.target.value.trim()) setPrompt(e.target.value);
              }}
            />
          </div>
        </div>

        <div>
          <label htmlFor="ref-answer">写下你的答案</label>
          <textarea
            id="ref-answer"
            rows={7}
            placeholder="慢慢地写，没什么标准答案。"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "var(--space-3)" }}>
          {flash && <span style={{ fontSize: "0.9rem", color: "var(--accent)" }}>{flash}</span>}
          <button
            className="btn-primary"
            disabled={pending}
            onClick={() => {
              const finalPrompt = customPrompt.trim() || prompt;
              startTransition(async () => {
                const res = await saveReflectionAction({
                  storyId: storyId || null,
                  prompt: finalPrompt,
                  answer,
                });
                if (res.ok) {
                  setAnswer("");
                  setFlash("反思已收好");
                  setTimeout(() => setFlash(null), 1800);
                } else {
                  setFlash(res.message);
                  setTimeout(() => setFlash(null), 1800);
                }
              });
            }}
          >
            {pending ? "保存中…" : "把这段反思留下"}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ fontSize: "0.75rem", letterSpacing: "0.14em", fontWeight: 700, color: "var(--ink-soft)" }}>
          之前的反思
        </div>
        {reflections.length === 0 ? (
          <div className="card">
            <p className="muted" style={{ fontSize: "0.9rem" }}>还没有反思记录。写下第一条吧。</p>
          </div>
        ) : (
          reflections.map((r) => (
            <ReflectionCard key={r.id} r={r} storyTitle={r.storyId ? storyMap.get(r.storyId) : undefined} />
          ))
        )}
      </div>
    </div>
  );
}

function ReflectionCard({ r, storyTitle }: { r: Reflection; storyTitle?: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <article className="card fade-in" style={{ padding: "var(--space-4)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--space-2)",
          fontSize: "0.8rem",
          color: "var(--ink-soft)",
        }}
      >
        <span>
          {storyTitle ? (
            <>关于 <strong style={{ color: "var(--ink)" }}>{storyTitle}</strong></>
          ) : (
            "写作旅程"
          )}
        </span>
        <span>{new Date(r.createdAt).toLocaleString("zh-CN")}</span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "0.95rem",
          color: "var(--ink-soft)",
          marginBottom: "var(--space-2)",
        }}
      >
        · {r.prompt}
      </div>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "1rem",
          lineHeight: 1.9,
          whiteSpace: "pre-wrap",
        }}
      >
        {r.answer}
      </p>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
        <button
          className="btn-ghost"
          style={{ color: "var(--danger)" }}
          disabled={pending}
          onClick={() => {
            if (!confirm("删除这段反思？")) return;
            startTransition(async () => {
              await deleteReflectionAction(r.id);
            });
          }}
        >
          删除
        </button>
      </div>
    </article>
  );
}
