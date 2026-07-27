"use client";

import { useMemo, useState, useTransition } from "react";
import type { DecisionEntry, Material, Reflection, Story } from "../../lib/store";
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
  materials: Material[];
  initialStoryId: string;
}

export function ReflectForm({ stories, reflections, materials, initialStoryId }: Props) {
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
  const ledger = selectedStory?.decisionLedger ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {selectedStory && (
        <StoryJourneyPanel
          story={selectedStory}
          onSaved={() => setFlash("已保存 Story Journey 回顾")}
        />
      )}
      {selectedStory && ledger.length > 0 && (
        <DecisionLedgerPanel entries={ledger} />
      )}
      {selectedStory && (
        <TraceStoryMappingPanel story={selectedStory} materials={materials} />
      )}
      {selectedStory && ledger.some((e) => e.action === "rejected") && (
        <RejectedSuggestionsPanel entries={ledger.filter((e) => e.action === "rejected")} />
      )}
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

// ---------- Decision Ledger 可视化 ----------
// 需求文档 3.8：回顾 5 个关键决定 + AI 建议处理方式

function DecisionLedgerPanel({ entries }: { entries: DecisionEntry[] }) {
  const summary = useMemo(() => {
    const s = { adopted: 0, modified: 0, combined: 0, rejected: 0 };
    for (const e of entries) s[e.action]++;
    return s;
  }, [entries]);
  const total = entries.length;

  return (
    <section
      className="card fade-in"
      style={{
        padding: "var(--space-5)",
        background: "var(--paper-soft)",
        borderColor: "var(--line)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "var(--space-3)" }}>
        <div>
          <div style={{ fontSize: "0.75rem", letterSpacing: "0.14em", fontWeight: 700, color: "var(--accent)", marginBottom: 2 }}>
            NARRATIVE DECISION LEDGER
          </div>
          <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem", margin: 0 }}>
            叙事决定账本
          </h3>
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          与 AI 的 {total} 次交互
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "var(--space-2)",
          marginBottom: "var(--space-4)",
        }}
      >
        <SummaryCell label="采纳" value={summary.adopted} color="var(--accent)" />
        <SummaryCell label="修改后采纳" value={summary.modified} color="var(--accent)" />
        <SummaryCell label="组合" value={summary.combined} color="var(--amber)" />
        <SummaryCell label="拒绝" value={summary.rejected} color="var(--danger)" />
      </div>

      <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginBottom: "var(--space-2)" }}>
        每一条记录
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 320, overflow: "auto" }}>
        {entries.slice().reverse().map((e, i) => (
          <DecisionRow key={i} entry={e} />
        ))}
      </div>
    </section>
  );
}

function SummaryCell({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div
      style={{
        padding: "var(--space-3)",
        background: "var(--card)",
        borderRadius: "var(--radius)",
        border: "1px solid var(--line)",
        textAlign: "center",
      }}
    >
      <div style={{ fontFamily: "var(--font-serif)", fontSize: "1.6rem", fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function DecisionRow({ entry }: { entry: DecisionEntry }) {
  const actionMap: Record<DecisionEntry["action"], { text: string; color: string; wash: string }> = {
    adopted: { text: "采纳", color: "var(--accent)", wash: "var(--accent-wash)" },
    modified: { text: "改后采纳", color: "var(--accent)", wash: "var(--accent-wash)" },
    combined: { text: "组合", color: "var(--amber)", wash: "var(--amber-wash)" },
    rejected: { text: "拒绝", color: "var(--danger)", wash: "var(--danger-wash)" },
  };
  const a = actionMap[entry.action];
  const slotLabels: Record<DecisionEntry["slotKey"], string> = {
    protagonist: "主人公",
    goal: "目标",
    event: "发生",
    difficulty: "困难",
    turn: "转折",
    ending: "结局",
  };
  const personaLabel = entry.aiPersona === "story-coach" ? "Story Coach" : "World Witness";
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: "var(--space-3)",
        alignItems: "center",
        padding: "var(--space-2) var(--space-3)",
        background: "var(--card)",
        border: "1px solid var(--line)",
        borderRadius: "var(--radius)",
        fontSize: "0.85rem",
      }}
    >
      <span
        style={{
          padding: "0.15rem 0.6rem",
          background: a.wash,
          color: a.color,
          borderRadius: "var(--radius-pill)",
          border: `1px solid ${a.color}44`,
          fontSize: "0.75rem",
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        {a.text}
      </span>
      <div>
        <span style={{ color: "var(--ink)" }}>
          {personaLabel} · <strong>{slotLabels[entry.slotKey]}</strong>
        </span>
        {entry.reason && (
          <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: 2 }}>
            "{entry.reason}"
          </div>
        )}
      </div>
      <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
        {new Date(entry.timestamp).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

// ---------- Trace-Story Mapping ----------
// 需求文档 §3.8：可视化"哪些段落引用了哪些户外痕迹"。
// 我们从 story.shelf 里读每个槽位的 sources.kind === 'trace' 集合，
// 加上 story.linkedMaterialIds（整体关联的 Trace）。

const SLOT_LABELS: Record<string, string> = {
  protagonist: "主人公",
  goal: "目标",
  event: "发生",
  difficulty: "困难",
  turn: "转折",
  ending: "结局",
};

function TraceStoryMappingPanel({ story, materials }: { story: Story; materials: Material[] }) {
  const traceMap = useMemo(() => {
    const m = new Map<string, Material>();
    for (const t of materials) m.set(t.id, t);
    return m;
  }, [materials]);

  // 收集所有出现在 shelf 或 linked 里的 traceId
  const usage = useMemo(() => {
    // traceId -> { title, slots: [slotKey], onlyLinked: boolean }
    const acc = new Map<string, { title: string; slots: string[]; onlyLinked: boolean }>();
    for (const key of Object.keys(SLOT_LABELS)) {
      const slot = story.shelf[key as keyof typeof story.shelf];
      for (const s of slot.sources) {
        if (s.kind !== "trace") continue;
        const t = traceMap.get(s.id);
        if (!t) continue;
        const entry = acc.get(s.id) ?? { title: t.title, slots: [], onlyLinked: false };
        entry.slots.push(SLOT_LABELS[key]);
        acc.set(s.id, entry);
      }
    }
    for (const tid of story.linkedMaterialIds) {
      if (acc.has(tid)) continue;
      const t = traceMap.get(tid);
      if (!t) continue;
      acc.set(tid, { title: t.title, slots: [], onlyLinked: true });
    }
    return Array.from(acc.entries()).map(([id, v]) => ({ id, ...v }));
  }, [story, traceMap]);

  if (usage.length === 0) return null;

  return (
    <section
      className="card fade-in"
      style={{
        padding: "var(--space-5)",
        background: "var(--paper-soft)",
        borderColor: "var(--line)",
      }}
    >
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div
          style={{
            fontSize: "0.75rem",
            letterSpacing: "0.14em",
            fontWeight: 700,
            color: "var(--accent)",
            marginBottom: 2,
          }}
        >
          TRACE-STORY MAPPING
        </div>
        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem", margin: 0 }}>
          你的 Traces 走进了故事的哪里
        </h3>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {usage.map((u) => (
          <div
            key={u.id}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: "var(--space-3)",
              padding: "var(--space-2) var(--space-3)",
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              alignItems: "center",
            }}
          >
            <span className="tag tag-accent" style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              ◑ {u.title || "(未命名)"}
            </span>
            {u.slots.length === 0 ? (
              <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)", fontStyle: "italic" }}>
                关联到故事，但还没挂到具体槽位
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {u.slots.map((s, i) => (
                  <span
                    key={`${u.id}-${s}-${i}`}
                    style={{
                      fontSize: "0.75rem",
                      padding: "0.15rem 0.5rem",
                      background: "var(--accent-wash)",
                      color: "var(--accent)",
                      borderRadius: "var(--radius-pill)",
                      border: "1px solid var(--accent-soft)",
                    }}
                  >
                    → {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: "var(--space-3)",
          fontSize: "0.75rem",
          color: "var(--ink-soft)",
          padding: "0.4rem 0.6rem",
          background: "var(--paper-soft)",
          borderRadius: "var(--radius)",
        }}
      >
        每一条 Trace 都在讲你亲历过的事——它们在故事里出现的位置，就是你把真实世界带进故事的方式。
      </div>
    </section>
  );
}

// ---------- 拒绝记录 ----------
// 需求文档 §3.8：专门记录"未采用的 AI 建议"及原因，强化主体性。

function RejectedSuggestionsPanel({ entries }: { entries: DecisionEntry[] }) {
  return (
    <section
      className="card fade-in"
      style={{
        padding: "var(--space-5)",
        background: "var(--danger-wash)",
        borderColor: "var(--danger)",
      }}
    >
      <div style={{ marginBottom: "var(--space-3)" }}>
        <div
          style={{
            fontSize: "0.75rem",
            letterSpacing: "0.14em",
            fontWeight: 700,
            color: "var(--danger)",
            marginBottom: 2,
          }}
        >
          REJECTED SUGGESTIONS
        </div>
        <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "1.2rem", margin: 0 }}>
          你说「不」的那些时刻
        </h3>
        <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginTop: 4 }}>
          你拒绝 AI 建议的次数：<strong style={{ color: "var(--danger)" }}>{entries.length}</strong>——
          每一次拒绝都是你在守住这是「你自己的」故事。
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        {entries.slice().reverse().map((e, i) => {
          const personaLabel = e.aiPersona === "story-coach" ? "Story Coach" : "World Witness";
          // reason 里可能带有 [mode:xxx]，提取出来
          const rawReason = e.reason ?? "";
          const modeMatch = rawReason.match(/\[mode:([\w-]+)\]/);
          const modeTag = modeMatch ? modeMatch[1] : null;
          const cleanReason = rawReason.replace(/\[mode:[\w-]+\]\s*/, "");
          return (
            <div
              key={i}
              style={{
                padding: "var(--space-3)",
                background: "var(--card)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--danger)" }}>
                  ✗ 拒绝
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>
                  来自 {personaLabel}
                </span>
                {modeTag && (
                  <span
                    style={{
                      fontSize: "0.7rem",
                      padding: "0.1rem 0.4rem",
                      background: "var(--paper-soft)",
                      color: "var(--ink-soft)",
                      borderRadius: "var(--radius-pill)",
                    }}
                  >
                    {modeTag}
                  </span>
                )}
                <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "var(--ink-soft)" }}>
                  {new Date(e.timestamp).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {cleanReason ? (
                <div style={{ fontSize: "0.85rem", color: "var(--ink)", lineHeight: 1.6 }}>
                  「{cleanReason}」
                </div>
              ) : (
                <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)", fontStyle: "italic" }}>
                  （没有留下原因）
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------- Story Journey Panel ----------
// 设计文档 §13：为 5 个关键叙事决定（主人公 / 目标 / 困难 / 转折 / 结局）
// 逐一询问「这个想法最早从哪里出现？」— 6 个来源关系选项。
// 保存为若干条 Reflection，prompt 前缀「Story Journey · <决定>」，answer 存所选来源关系。
const JOURNEY_STEPS: Array<{
  key: "protagonist" | "goal" | "difficulty" | "turn" | "ending";
  question: string;
}> = [
  { key: "protagonist", question: "主人公是谁？这个想法最早从哪里出现？" },
  { key: "goal", question: "主人公的目标——这个想法最早从哪里出现？" },
  { key: "difficulty", question: "核心困难——这个想法最早从哪里出现？" },
  { key: "turn", question: "主要转折——这个想法最早从哪里出现？" },
  { key: "ending", question: "结局——这个决定最早从哪里出现？" },
];

const JOURNEY_ORIGINS: Array<{ id: string; label: string }> = [
  { id: "outdoors", label: "我在户外已经想到" },
  { id: "trace-relook", label: "看照片或听声音后想到" },
  { id: "ai-question", label: "AI 的问题帮助我想到" },
  { id: "ai-adopted", label: "AI 提出后我采用" },
  { id: "ai-modified", label: "我修改了 AI 的建议" },
  { id: "combined", label: "我把多个想法组合起来" },
];

function StoryJourneyPanel({
  story,
  onSaved,
}: {
  story: Story;
  onSaved: () => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function saveStep(stepKey: string, question: string) {
    const originId = answers[stepKey];
    if (!originId) return;
    const originLabel = JOURNEY_ORIGINS.find((o) => o.id === originId)?.label ?? originId;
    const extra = note[stepKey]?.trim();
    const answerText = extra ? `${originLabel} · ${extra}` : originLabel;
    startTransition(async () => {
      await saveReflectionAction({
        storyId: story.id,
        prompt: `Story Journey · ${question}`,
        answer: answerText,
      });
      onSaved();
    });
  }

  return (
    <section
      className="card fade-in"
      style={{
        padding: "var(--space-5)",
        background: "linear-gradient(180deg, var(--paper-soft) 0%, var(--card) 100%)",
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          letterSpacing: "0.14em",
          fontWeight: 700,
          color: "var(--accent)",
          marginBottom: "var(--space-2)",
        }}
      >
        STORY JOURNEY · 创作来源回顾
      </div>
      <h2 style={{ fontSize: "1.2rem", marginBottom: "var(--space-4)" }}>
        你的五个关键决定，最早从哪里出现？
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {JOURNEY_STEPS.map((step) => (
          <div
            key={step.key}
            style={{
              padding: "var(--space-3) var(--space-4)",
              background: "var(--card)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
            }}
          >
            <div style={{ fontSize: "0.92rem", fontWeight: 600, marginBottom: "var(--space-2)" }}>
              {step.question}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
              {JOURNEY_ORIGINS.map((o) => {
                const active = answers[step.key] === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setAnswers((prev) => ({ ...prev, [step.key]: o.id }))}
                    aria-pressed={active}
                    style={{
                      fontSize: "0.78rem",
                      padding: "0.3rem 0.7rem",
                      background: active ? "var(--accent)" : "var(--paper-soft)",
                      color: active ? "white" : "var(--ink)",
                      borderColor: active ? "var(--accent)" : "var(--line)",
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              placeholder="想再补一句为什么吗？（可留空）"
              value={note[step.key] ?? ""}
              onChange={(e) => setNote((prev) => ({ ...prev, [step.key]: e.target.value }))}
              style={{ marginTop: "var(--space-2)", fontSize: "0.85rem" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
              <button
                className="btn-primary"
                disabled={pending || !answers[step.key]}
                onClick={() => saveStep(step.key, step.question)}
                style={{ fontSize: "0.8rem", padding: "0.35rem 0.8rem" }}
              >
                {pending ? "保存中…" : "记下这一步"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
