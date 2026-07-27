"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FirstThought, IdeaCard, Material, Story, StoryShelf, StoryShelfSlot } from "../../../lib/store";
import {
  appendDecisionAction,
  askAgentAction,
  completeStoryAction,
  saveStoryAction,
} from "../../_actions";
import { useDrawers } from "../../_components/AppShell";

type SlotKey = keyof StoryShelf;
type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

interface Props {
  story: Story & { body: string };
  materials: Material[];
  ideas: IdeaCard[];
  firstThoughts: FirstThought[];
}

interface SlotConfig {
  key: SlotKey;
  index: number;
  label: string;
  question: string;
  hint: string;
  accent: string;
  wash: string;
}

// 6 槽位配置（对应需求文档 3.6 Story Shelf）
const SLOTS: SlotConfig[] = [
  {
    key: "protagonist",
    index: 1,
    label: "主人公",
    question: "主人公是谁？",
    hint: "TA 是什么样的角色？可以是人、动物、也可以是一朵云、一块石头。",
    accent: "var(--accent)",
    wash: "var(--accent-wash)",
  },
  {
    key: "goal",
    index: 2,
    label: "目标",
    question: "主人公想做什么？",
    hint: "TA 心里想着什么、想去哪里、想要谁？",
    accent: "var(--accent)",
    wash: "var(--accent-wash)",
  },
  {
    key: "event",
    index: 3,
    label: "发生",
    question: "发生了什么事？",
    hint: "故事从哪件小事开始动起来的？",
    accent: "var(--accent)",
    wash: "var(--accent-wash)",
  },
  {
    key: "difficulty",
    index: 4,
    label: "困难",
    question: "遇到了什么困难？",
    hint: "什么挡在了主人公前面？可以是外面的，也可以是心里的。",
    accent: "var(--amber)",
    wash: "var(--amber-wash)",
  },
  {
    key: "turn",
    index: 5,
    label: "转折",
    question: "什么改变了局面？",
    hint: "一个意外、一个发现、一个决定——让故事拐了个弯。",
    accent: "var(--amber)",
    wash: "var(--amber-wash)",
  },
  {
    key: "ending",
    index: 6,
    label: "结局",
    question: "结局如何？",
    hint: "最后停在哪里？可以是圆满，也可以是留一个念头。",
    accent: "var(--accent)",
    wash: "var(--accent-wash)",
  },
];

const AUTOSAVE_MS = 900;

// 6 槽位映射需要哪些原来的 storyline 里没有的字段，用来判断"迁移后需要补充"
const MIGRATED_EMPTY_SLOTS: SlotKey[] = ["goal", "turn"];

export function StoryEditor({ story, materials, ideas, firstThoughts }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(story.title);
  const [body, setBody] = useState(story.body);
  const [shelf, setShelf] = useState<StoryShelf>(story.shelf);
  const [linkedTraceIds, setLinkedTraceIds] = useState<string[]>(story.linkedMaterialIds);
  const [linkedIdeaIds, setLinkedIdeaIds] = useState<string[]>(story.linkedIdeaIds);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [completing, setCompleting] = useState(false);
  const [showMigrationHint, setShowMigrationHint] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const { openDrawer, registerHandoff } = useDrawers();
  const completed = Boolean(story.completedAt);

  // 检测迁移后需要补充的槽位
  useEffect(() => {
    const needs = MIGRATED_EMPTY_SLOTS.some((k) => !shelf[k]?.text.trim());
    // 只有当故事有其它字段已填、但目标/转折为空时，才提示（避免全新故事也弹）
    const hasSomething = SLOTS.some(
      (s) => !MIGRATED_EMPTY_SLOTS.includes(s.key) && shelf[s.key]?.text.trim()
    );
    setShowMigrationHint(needs && hasSomething);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  // handoff 引用
  const setLinkedTraceIdsRef = useRef(setLinkedTraceIds);
  const markRef = useRef<() => void>(() => {});
  useEffect(() => {
    setLinkedTraceIdsRef.current = setLinkedTraceIds;
  });

  const persist = useCallback(async () => {
    setSaveState("saving");
    try {
      await saveStoryAction(story.id, {
        title,
        body,
        shelf,
        linkedMaterialIds: linkedTraceIds,
        linkedIdeaIds,
      });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [story.id, title, body, shelf, linkedTraceIds, linkedIdeaIds]);

  useEffect(() => {
    if (saveState !== "unsaved") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void persist(), AUTOSAVE_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [saveState, persist]);

  function mark() {
    if (saveState !== "saving") setSaveState("unsaved");
  }
  markRef.current = mark;

  // 注册抽屉 handoff：素材抽屉「加到当前故事」→ 加到 linkedTraceIds
  useEffect(() => {
    registerHandoff({
      label: story.title,
      onAttachMaterial: (mid: string) => {
        setLinkedTraceIdsRef.current((prev) => (prev.includes(mid) ? prev : [...prev, mid]));
        markRef.current();
      },
    });
    return () => {
      registerHandoff(null);
    };
  }, [registerHandoff, story.title]);

  function updateSlotText(key: SlotKey, text: string) {
    setShelf((prev) => ({ ...prev, [key]: { ...prev[key], text } }));
    mark();
  }

  function addSourceToSlot(key: SlotKey, source: StoryShelfSlot["sources"][number]) {
    setShelf((prev) => {
      const cur = prev[key];
      if (cur.sources.some((s) => s.kind === source.kind && s.id === source.id)) return prev;
      return { ...prev, [key]: { ...cur, sources: [...cur.sources, source] } };
    });
    mark();
  }

  function removeSourceFromSlot(key: SlotKey, index: number) {
    setShelf((prev) => ({
      ...prev,
      [key]: { ...prev[key], sources: prev[key].sources.filter((_, i) => i !== index) },
    }));
    mark();
  }

  function attachIdeaToStory(ideaId: string) {
    setLinkedIdeaIds((prev) => (prev.includes(ideaId) ? prev : [...prev, ideaId]));
    mark();
  }

  const wordCount = body.replace(/\s/g, "").length;
  const filledSlots = SLOTS.filter((s) => shelf[s.key].text.trim().length > 0).length;

  const linkedTraces = useMemo(
    () => materials.filter((m) => linkedTraceIds.includes(m.id)),
    [materials, linkedTraceIds]
  );
  const linkedIdeas = useMemo(
    () => ideas.filter((i) => linkedIdeaIds.includes(i.id)),
    [ideas, linkedIdeaIds]
  );
  const firstThoughtsByTrace = useMemo(() => {
    const m = new Map<string, FirstThought>();
    for (const f of firstThoughts) m.set(f.traceId, f);
    return m;
  }, [firstThoughts]);

  async function onComplete() {
    if (!confirm(`将「${title}」标记为完成？完成后可以在反思回顾里写下感受。`)) return;
    setCompleting(true);
    await persist();
    await completeStoryAction(story.id);
    router.push(`/reflect?story=${story.id}`);
  }

  return (
    <div className="fade-in">
      <TopBar
        completed={completed}
        storyId={story.id}
        saveState={saveState}
        onSaveNow={() => void persist()}
        onComplete={onComplete}
        completing={completing}
        onOpenDrawer={openDrawer}
      />

      {showMigrationHint && (
        <MigrationHint onDismiss={() => setShowMigrationHint(false)} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-6)" }}>
        <MainColumn
          title={title}
          setTitle={(v) => {
            setTitle(v);
            mark();
          }}
          body={body}
          setBody={(v) => {
            setBody(v);
            mark();
          }}
          bodyRef={bodyRef}
          wordCount={wordCount}
          filledSlots={filledSlots}
          linkedTraces={linkedTraces}
          linkedIdeas={linkedIdeas}
        />

        <SideColumn
          storyId={story.id}
          shelf={shelf}
          onUpdateSlot={updateSlotText}
          onRemoveSource={removeSourceFromSlot}
          linkedTraces={linkedTraces}
          linkedIdeas={linkedIdeas}
          allIdeas={ideas}
          firstThoughtsByTrace={firstThoughtsByTrace}
          onOpenMaterials={() => openDrawer("materials")}
          onOpenAlchemy={() => openDrawer("alchemy")}
          onAttachIdea={attachIdeaToStory}
          onAskAgent={(mode, prompt) => askAgent(story.id, mode, prompt, linkedTraceIds, linkedIdeaIds)}
        />
      </div>
    </div>
  );
}

// ---------- Ask Agent 逻辑（提出/展示/采纳/修改/拒绝） ----------

import { CREATIVE_MODES, NARRATIVE_MOVES, type CreativeMode, type CreativeModeInfo, type NarrativeMove } from "../../../lib/ai-modes";

// 这个函数返回一个 Promise，让 SideColumn 的 AgentPanel 消费
async function askAgent(
  storyId: string,
  mode: CreativeMode,
  userPrompt: string,
  traceIds: string[],
  ideaIds: string[]
): Promise<{ reply: string; persona: "world-witness" | "story-coach" }> {
  const info = CREATIVE_MODES.find((m) => m.mode === mode)!;
  const res = await askAgentAction({
    persona: info.persona,
    mode,
    userPrompt,
    storyId,
    traceIds,
    ideaIds,
    includeShelf: true,
    includeStoryBody: mode === "look-again",
  });
  return { reply: res.reply, persona: info.persona as "world-witness" | "story-coach" };
}

// ---------- TopBar ----------

function TopBar({
  completed,
  storyId,
  saveState,
  onSaveNow,
  onComplete,
  completing,
  onOpenDrawer,
}: {
  completed: boolean;
  storyId: string;
  saveState: SaveState;
  onSaveNow: () => void;
  onComplete: () => void;
  completing: boolean;
  onOpenDrawer: (k: "materials" | "alchemy") => void;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
        marginBottom: "var(--space-5)",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
        <Link href="/write" className="btn-ghost">
          ← 全部故事
        </Link>
        {completed && <span className="tag tag-amber">已完成</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <button className="btn-ghost" onClick={() => onOpenDrawer("materials")}>
          ◑ Trace 抽屉
        </button>
        <button
          className="btn-ghost"
          onClick={() => onOpenDrawer("alchemy")}
          style={{ color: "var(--amber)" }}
        >
          ✦ 灵感炼金
        </button>
        <SaveBadge state={saveState} />
        <button className="btn-ghost" onClick={onSaveNow} disabled={saveState === "saving"}>
          立即保存
        </button>
        {completed ? (
          <Link href={`/reflect?story=${storyId}`} className="btn-primary">
            去写反思 →
          </Link>
        ) : (
          <button className="btn-primary" onClick={onComplete} disabled={completing}>
            {completing ? "完成中…" : "写完了 · 去反思"}
          </button>
        )}
      </div>
    </header>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const map: Record<SaveState, { text: string; color: string }> = {
    idle: { text: "", color: "var(--ink-soft)" },
    unsaved: { text: "· 有改动", color: "var(--amber)" },
    saving: { text: "· 保存中", color: "var(--ink-soft)" },
    saved: { text: "· 已保存", color: "var(--accent)" },
    error: { text: "· 保存失败", color: "var(--danger)" },
  };
  const { text, color } = map[state];
  if (!text) return null;
  return (
    <span style={{ fontSize: "0.8rem", color }}>{text}</span>
  );
}

// ---------- MigrationHint ----------

function MigrationHint({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="fade-in"
      style={{
        marginBottom: "var(--space-5)",
        padding: "var(--space-3) var(--space-4)",
        background: "var(--amber-wash)",
        border: "1px solid var(--amber-soft)",
        borderRadius: "var(--radius)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-3)",
      }}
    >
      <div style={{ fontSize: "0.9rem", color: "var(--ink)" }}>
        <strong style={{ color: "var(--amber)" }}>故事结构已升级到 6 个部分：</strong>
        主人公、目标、发生、困难、转折、结局。看起来这篇故事的<strong>目标</strong>和<strong>转折</strong>还是空的——可以在右侧补充一下，让故事更完整。
      </div>
      <button className="btn-ghost" onClick={onDismiss} style={{ fontSize: "0.85rem" }}>
        知道了
      </button>
    </div>
  );
}

// ---------- Main column（title + body） ----------

function MainColumn({
  title,
  setTitle,
  body,
  setBody,
  bodyRef,
  wordCount,
  filledSlots,
  linkedTraces,
  linkedIdeas,
}: {
  title: string;
  setTitle: (v: string) => void;
  body: string;
  setBody: (v: string) => void;
  bodyRef: React.RefObject<HTMLTextAreaElement | null>;
  wordCount: number;
  filledSlots: number;
  linkedTraces: Material[];
  linkedIdeas: IdeaCard[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div className="card" style={{ padding: "var(--space-3) var(--space-4)" }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="给这个故事起个名字…"
          style={{
            fontSize: "1.2rem",
            fontFamily: "var(--font-serif)",
            fontWeight: 700,
            border: "none",
            background: "transparent",
            padding: 0,
          }}
        />
      </div>

      <StoryWorldPreview traces={linkedTraces} ideas={linkedIdeas} />

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <textarea
          ref={bodyRef}
          aria-label="故事正文"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"在这里慢慢写…\n\n可以先照着右边的六个部分写，也可以先写你最想写的一段。"}
          style={{
            border: "none",
            borderRadius: 0,
            minHeight: 520,
            padding: "var(--space-5)",
            fontFamily: "var(--font-serif)",
            fontSize: "1.05rem",
            lineHeight: 2,
            background: "var(--card)",
            resize: "vertical",
          }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            padding: "var(--space-2) var(--space-4)",
            borderTop: "1px solid var(--line)",
            background: "var(--paper-soft)",
            fontSize: "0.8rem",
            color: "var(--ink-soft)",
          }}
        >
          <span>{wordCount} 字</span>
          <span>故事线已填 {filledSlots} / 6 段</span>
        </div>
      </div>
    </div>
  );
}

// ---------- Side column（Story Shelf + Idea 面板 + Agent 面板） ----------

function SideColumn({
  storyId,
  shelf,
  onUpdateSlot,
  onRemoveSource,
  linkedTraces,
  linkedIdeas,
  allIdeas,
  firstThoughtsByTrace,
  onOpenMaterials,
  onOpenAlchemy,
  onAttachIdea,
  onAskAgent,
}: {
  storyId: string;
  shelf: StoryShelf;
  onUpdateSlot: (key: SlotKey, text: string) => void;
  onRemoveSource: (key: SlotKey, index: number) => void;
  linkedTraces: Material[];
  linkedIdeas: IdeaCard[];
  allIdeas: IdeaCard[];
  firstThoughtsByTrace: Map<string, FirstThought>;
  onOpenMaterials: () => void;
  onOpenAlchemy: () => void;
  onAttachIdea: (id: string) => void;
  onAskAgent: (
    mode: CreativeMode,
    userPrompt: string
  ) => Promise<{ reply: string; persona: "world-witness" | "story-coach" }>;
}) {
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <section>
        <SectionTitle>Story Shelf · 故事的 6 个部分</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {SLOTS.map((cfg) => (
            <ShelfSlotEditor
              key={cfg.key}
              config={cfg}
              slot={shelf[cfg.key]}
              linkedTraces={linkedTraces}
              linkedIdeas={linkedIdeas}
              onUpdateText={(t) => onUpdateSlot(cfg.key, t)}
              onRemoveSource={(i) => onRemoveSource(cfg.key, i)}
            />
          ))}
        </div>
      </section>

      <IdeaCardsPanel
        allIdeas={allIdeas}
        linkedIdeas={linkedIdeas}
        onOpenAlchemy={onOpenAlchemy}
        onAttach={onAttachIdea}
      />

      <TracesPanel
        linkedTraces={linkedTraces}
        firstThoughtsByTrace={firstThoughtsByTrace}
        onOpenMaterials={onOpenMaterials}
      />

      <AgentPanel onAsk={onAskAgent} storyId={storyId} />
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "0.75rem",
        letterSpacing: "0.14em",
        fontWeight: 700,
        color: "var(--ink-soft)",
        marginBottom: "var(--space-3)",
      }}
    >
      {children}
    </div>
  );
}

// ---------- 单个 Shelf 槽位编辑器 ----------

function ShelfSlotEditor({
  config,
  slot,
  linkedTraces,
  linkedIdeas,
  onUpdateText,
  onRemoveSource,
}: {
  config: SlotConfig;
  slot: StoryShelfSlot;
  linkedTraces: Material[];
  linkedIdeas: IdeaCard[];
  onUpdateText: (text: string) => void;
  onRemoveSource: (index: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasText = slot.text.trim().length > 0;

  return (
    <div
      className="card"
      style={{
        padding: "var(--space-3) var(--space-4)",
        borderLeft: `3px solid ${config.accent}`,
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          background: "transparent",
          border: "none",
          padding: 0,
          textAlign: "left",
          boxShadow: "none",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
        }}
      >
        <span
          style={{
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: config.wash,
            color: config.accent,
            fontFamily: "var(--font-serif)",
            fontWeight: 700,
            display: "grid",
            placeItems: "center",
            fontSize: "0.85rem",
            flexShrink: 0,
          }}
        >
          {config.index}
        </span>
        <span style={{ flex: 1 }}>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", fontFamily: "var(--font-serif)" }}>
            {config.label}
          </span>
          <span style={{ marginLeft: 6, fontSize: "0.85rem", color: "var(--ink-soft)" }}>
            {hasText ? slot.text.slice(0, 32) + (slot.text.length > 32 ? "…" : "") : config.question}
          </span>
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={{ marginTop: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div style={{ fontSize: "0.8rem", color: "var(--ink-soft)", lineHeight: 1.6 }}>{config.hint}</div>
          <textarea
            value={slot.text}
            onChange={(e) => onUpdateText(e.target.value)}
            rows={3}
            placeholder={config.question}
            style={{ fontSize: "0.95rem" }}
          />
          <SourceChain
            sources={slot.sources}
            linkedTraces={linkedTraces}
            linkedIdeas={linkedIdeas}
            onRemove={onRemoveSource}
          />
        </div>
      )}
    </div>
  );
}

function SourceChain({
  sources,
  linkedTraces,
  linkedIdeas,
  onRemove,
}: {
  sources: StoryShelfSlot["sources"];
  linkedTraces: Material[];
  linkedIdeas: IdeaCard[];
  onRemove: (index: number) => void;
}) {
  if (sources.length === 0) {
    return (
      <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontStyle: "italic" }}>
        （还没关联 Trace 或 Idea Card。可以在下面的 Idea Cards / Traces 里挑一个"用作这个部分"。）
      </div>
    );
  }
  return (
    <div>
      <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginBottom: 4 }}>Source Chain</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
        {sources.map((s, i) => {
          const label =
            s.kind === "trace"
              ? linkedTraces.find((t) => t.id === s.id)?.title || "(Trace)"
              : "Idea: " + (linkedIdeas.find((idea) => idea.id === s.id)?.content.slice(0, 24) || "…");
          const color = s.kind === "idea" ? "var(--amber)" : "var(--accent)";
          const wash = s.kind === "idea" ? "var(--amber-wash)" : "var(--accent-wash)";
          return (
            <span
              key={`${s.kind}-${s.id}-${i}`}
              className="tag"
              style={{
                background: wash,
                color,
                borderColor: `${color}55`,
                gap: "0.3rem",
              }}
            >
              {s.kind === "idea" ? "✦" : "◑"} {label}
              <button
                onClick={() => onRemove(i)}
                aria-label="移除来源"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  color,
                  fontSize: "0.7rem",
                  boxShadow: "none",
                  cursor: "pointer",
                  minHeight: 0,
                }}
              >
                ×
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Idea Cards 面板 ----------

function IdeaCardsPanel({
  allIdeas,
  linkedIdeas,
  onOpenAlchemy,
  onAttach,
}: {
  allIdeas: IdeaCard[];
  linkedIdeas: IdeaCard[];
  onOpenAlchemy: () => void;
  onAttach: (id: string) => void;
}) {
  const linkedIds = new Set(linkedIdeas.map((i) => i.id));
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <SectionTitle>Idea Cards · 灵感火花</SectionTitle>
        <button className="btn-ghost" onClick={onOpenAlchemy} style={{ fontSize: "0.8rem", color: "var(--amber)" }}>
          ✦ 再炼一次
        </button>
      </div>
      {allIdeas.length === 0 ? (
        <div className="card" style={{ padding: "var(--space-3)", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          还没有 Idea Card。到「灵感炼金」把两份 Trace 联想成一个 Idea。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 320, overflow: "auto" }}>
          {allIdeas.map((idea) => {
            const linked = linkedIds.has(idea.id);
            return (
              <div
                key={idea.id}
                style={{
                  padding: "var(--space-3)",
                  background: linked ? "var(--amber-wash)" : "var(--card)",
                  border: `1px solid ${linked ? "var(--amber-soft)" : "var(--line)"}`,
                  borderRadius: "var(--radius)",
                  fontSize: "0.85rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.3rem" }}>
                  <span style={{ color: "var(--amber)" }}>✦</span>
                  <span className="tag tag-amber" style={{ fontSize: "0.7rem" }}>
                    {ideaSourceLabel(idea.sourceKind)}
                  </span>
                </div>
                <p style={{ fontSize: "0.85rem", lineHeight: 1.6, marginBottom: "0.4rem", whiteSpace: "pre-wrap" }}>
                  {idea.content.slice(0, 160)}
                  {idea.content.length > 160 ? "…" : ""}
                </p>
                {!linked && (
                  <button
                    className="btn-ghost"
                    style={{ fontSize: "0.75rem", padding: "0.25rem 0.6rem" }}
                    onClick={() => onAttach(idea.id)}
                  >
                    + 关联到当前故事
                  </button>
                )}
                {linked && (
                  <span style={{ fontSize: "0.75rem", color: "var(--amber)" }}>已关联</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ideaSourceLabel(k: IdeaCard["sourceKind"]) {
  if (k === "ai-inspired") return "AI 启发";
  if (k === "child-edited") return "我改过了";
  return "组合";
}

// ---------- Traces 面板 ----------

function TracesPanel({
  linkedTraces,
  firstThoughtsByTrace,
  onOpenMaterials,
}: {
  linkedTraces: Material[];
  firstThoughtsByTrace: Map<string, FirstThought>;
  onOpenMaterials: () => void;
}) {
  const withFT = linkedTraces.filter((t) => firstThoughtsByTrace.has(t.id)).length;
  return (
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <SectionTitle>关联的 Traces</SectionTitle>
        <button className="btn-ghost" onClick={onOpenMaterials} style={{ fontSize: "0.8rem" }}>
          ◑ 从抽屉挑
        </button>
      </div>
      {linkedTraces.length === 0 ? (
        <div className="card" style={{ padding: "var(--space-3)", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          还没有关联的 Trace。从素材抽屉里"加到当前故事"。
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
            {linkedTraces.map((t) => {
              const hasFT = firstThoughtsByTrace.has(t.id);
              return (
                <span
                  key={t.id}
                  className="tag tag-accent"
                  title={
                    hasFT
                      ? `${t.title} · 有 Pre-AI 想法`
                      : `${t.title} · 建议先记录 Pre-AI 想法`
                  }
                  style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  ◑ {t.title || "(未命名)"}
                  {hasFT && <span style={{ marginLeft: 4, color: "var(--accent)" }}>🎯</span>}
                  {!t.aiAllowed && <span style={{ marginLeft: 4, opacity: 0.6 }}>· 私有</span>}
                </span>
              );
            })}
          </div>
          {withFT < linkedTraces.length && (
            <div
              style={{
                marginTop: "var(--space-2)",
                fontSize: "0.75rem",
                color: "var(--ink-soft)",
                padding: "0.4rem 0.6rem",
                background: "var(--paper-soft)",
                border: "1px dashed var(--line)",
                borderRadius: "var(--radius)",
              }}
            >
              💡 有 {linkedTraces.length - withFT} 份 Trace 还没记录 Pre-AI 想法。
              研究建议：在打开 AI 前，先在素材抽屉里写下你的初始联想。
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ---------- Agent 面板（三种创意模式） ----------
// 需求文档 §3.5.2：孩子按困难场景选模式（Open Up / Build On / Look Again），
// 不直接选 Agent。模式在内部映射到 Persona。

function AgentPanel({
  onAsk,
  storyId,
}: {
  onAsk: (
    mode: CreativeMode,
    userPrompt: string
  ) => Promise<{ reply: string; persona: "world-witness" | "story-coach" }>;
  storyId: string;
}) {
  const [mode, setMode] = useState<CreativeMode>("open-up");
  const [userPrompt, setUserPrompt] = useState("");
  const [reply, setReply] = useState<{ text: string; mode: CreativeMode; persona: "world-witness" | "story-coach" } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const modeInfo = CREATIVE_MODES.find((m) => m.mode === mode)!;

  const suggestionsByMode: Record<CreativeMode, string[]> = {
    "open-up": [
      "我想不到怎么开始故事",
      "帮我从 Traces 里再挖 2-3 种解读",
      "如果这个角色其实来自另一个地方呢？",
    ],
    "build-on": [
      "开头写完了但不知道往下写什么",
      "现在缺一个转折，能给我几个方向吗？",
      "我的主人公卡住了，可以怎么让 TA 动起来？",
    ],
    "look-again": [
      "感觉写着写着离 Traces 越来越远了",
      "帮我看看正文里哪些是真的、哪些是我瞎编的",
      "我的 Trace 里还有哪些细节我没用上？",
    ],
  };

  async function submit(text: string) {
    if (!text.trim() || pending) return;
    setPending(true);
    setError(null);
    setReply(null);
    try {
      const r = await onAsk(mode, text.trim());
      setReply({ text: r.reply, mode, persona: r.persona });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPending(false);
    }
  }

  const primaryColor = modeInfo.persona === "story-coach" ? "var(--amber)" : "var(--accent)";

  return (
    <section>
      <SectionTitle>AI 伙伴 · 按困难场景选模式</SectionTitle>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "0.4rem",
          marginBottom: "var(--space-3)",
        }}
      >
        {CREATIVE_MODES.map((info) => (
          <ModeCard
            key={info.mode}
            info={info}
            active={mode === info.mode}
            onClick={() => setMode(info.mode)}
          />
        ))}
      </div>

      {mode === "build-on" && (
        <NarrativeMoveLibrary
          onPickMove={(m) => setUserPrompt(`我想在故事里试一个「${m.label}」——${m.question}`)}
        />
      )}

      <div
        className="card"
        style={{
          padding: "var(--space-3)",
          borderLeft: `3px solid ${primaryColor}`,
        }}
      >
        <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginBottom: "0.4rem", lineHeight: 1.6 }}>
          {modeInfo.focusHint} 背后是 <strong style={{ color: primaryColor }}>{modeInfo.personaLabel}</strong>。
        </div>
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          rows={2}
          placeholder={`告诉 ${modeInfo.personaLabel} 你现在卡在哪里……`}
          style={{ fontSize: "0.9rem" }}
        />

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.4rem" }}>
          {suggestionsByMode[mode].map((s) => (
            <button
              key={s}
              className="btn-ghost"
              style={{ fontSize: "0.75rem", padding: "0.2rem 0.6rem" }}
              onClick={() => setUserPrompt(s)}
              type="button"
            >
              {s}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
          <button
            className="btn-primary"
            disabled={pending || !userPrompt.trim()}
            onClick={() => submit(userPrompt)}
            style={{
              background: primaryColor,
              borderColor: primaryColor,
              fontSize: "0.85rem",
              padding: "0.4rem 0.9rem",
            }}
          >
            {pending ? "召唤中…" : `启动 ${modeInfo.label.split(" · ")[0]}`}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginTop: "var(--space-2)", fontSize: "0.85rem", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      {reply && (
        <AgentReplyCard
          mode={reply.mode}
          persona={reply.persona}
          reply={reply.text}
          onDismiss={() => setReply(null)}
          storyId={storyId}
        />
      )}
    </section>
  );
}

function ModeCard({
  info,
  active,
  onClick,
}: {
  info: CreativeModeInfo;
  active: boolean;
  onClick: () => void;
}) {
  const color = info.persona === "story-coach" ? "var(--amber)" : "var(--accent)";
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        width: "100%",
        padding: "var(--space-2) var(--space-3)",
        background: active ? color : "var(--card)",
        color: active ? "white" : "var(--ink)",
        borderColor: active ? color : "var(--line)",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 2,
        borderRadius: "var(--radius)",
        textAlign: "left",
        fontWeight: 400,
      }}
    >
      <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>{info.label}</span>
      <span style={{ fontSize: "0.72rem", opacity: 0.85 }}>
        适合：{info.scenario} · 由 {info.personaLabel} 回应
      </span>
    </button>
  );
}

function AgentReplyCard({
  mode,
  persona,
  reply,
  onDismiss,
  storyId,
}: {
  mode: CreativeMode;
  persona: "world-witness" | "story-coach";
  reply: string;
  onDismiss: () => void;
  storyId: string;
}) {
  const color = persona === "story-coach" ? "var(--amber)" : "var(--accent)";
  const wash = persona === "story-coach" ? "var(--amber-wash)" : "var(--accent-wash)";
  const modeInfo = CREATIVE_MODES.find((m) => m.mode === mode)!;

  return (
    <div
      className="card fade-in"
      style={{
        marginTop: "var(--space-3)",
        padding: "var(--space-3)",
        background: wash,
        borderColor: `${color}44`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
        <span style={{ fontSize: "0.8rem", fontWeight: 700, color }}>
          {modeInfo.label.split(" · ")[0]} · {modeInfo.personaLabel}
        </span>
        <span style={{ fontSize: "0.7rem", color: "var(--ink-soft)" }}>
          你可以采纳、修改、组合，或拒绝
        </span>
      </div>
      <p
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: "0.9rem",
          lineHeight: 1.85,
          whiteSpace: "pre-wrap",
          color: "var(--ink)",
        }}
      >
        {reply}
      </p>
      <DecisionActions
        mode={mode}
        persona={persona}
        reply={reply}
        onDismiss={onDismiss}
        storyId={storyId}
      />
    </div>
  );
}

function DecisionActions({
  mode,
  persona,
  reply,
  onDismiss,
  storyId,
}: {
  mode: CreativeMode;
  persona: "world-witness" | "story-coach";
  reply: string;
  onDismiss: () => void;
  storyId: string;
}) {
  // 采纳、修改、组合、拒绝——需求文档 4.2 追踪的四种 action
  const [pending, setPending] = useState<null | string>(null);
  const modeInfo = CREATIVE_MODES.find((m) => m.mode === mode)!;

  async function record(action: "adopted" | "modified" | "combined" | "rejected", childReason?: string) {
    setPending(action);
    // reason 里带上 mode 名，方便反思页里区分是哪个模式下的决策
    const reasonParts = [`[mode:${mode}]`];
    if (childReason) reasonParts.push(childReason);
    await appendDecisionAction(storyId, {
      slotKey: "protagonist", // 默认挂在 protagonist，用户可以后期在反思页调整
      proposer: "ai",
      aiPersona: persona,
      fromTrace: true,
      action,
      reason: reasonParts.join(" "),
    });
    setPending(null);
    onDismiss();
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "var(--space-2)" }}>
      <button
        className="btn-primary"
        style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}
        disabled={pending !== null}
        onClick={() => record("adopted", `直接采纳（${modeInfo.label.split(" · ")[0]}）`)}
      >
        采纳 ✓
      </button>
      <button
        className="btn-ghost"
        style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}
        disabled={pending !== null}
        onClick={() => record("modified", `在 AI 基础上修改（${modeInfo.label.split(" · ")[0]}）`)}
      >
        我改一改
      </button>
      <button
        className="btn-ghost"
        style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem" }}
        disabled={pending !== null}
        onClick={() => record("combined", `与自己想法组合（${modeInfo.label.split(" · ")[0]}）`)}
      >
        组合
      </button>
      <button
        className="btn-ghost"
        style={{ fontSize: "0.8rem", padding: "0.3rem 0.7rem", color: "var(--danger)" }}
        disabled={pending !== null}
        onClick={() => {
          const reasonInput = prompt("为什么拒绝这个建议？（帮助你之后回顾）") || undefined;
          record("rejected", reasonInput);
        }}
      >
        拒绝 ✗
      </button>
    </div>
  );
}

// ---------- Narrative Move Library ----------
// 设计文档 §"Narrative Move Library"：Build On 模式下的抽象叙事动作参考。
// 每个 move 是一个 8-15 秒的抽象小片段，帮助儿童"看到一次变化"，然后由儿童把
// 这个动作接回自己的 traces。这里以文字面板呈现（视频可作为下一阶段扩展）。
function NarrativeMoveLibrary({ onPickMove }: { onPickMove: (m: NarrativeMove) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        marginBottom: "var(--space-3)",
        border: "1px dashed var(--amber-soft)",
        borderRadius: "var(--radius)",
        background: "var(--amber-wash)",
        padding: "var(--space-3)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost"
        style={{
          width: "100%",
          justifyContent: "space-between",
          display: "flex",
          padding: "0.25rem 0.4rem",
          fontSize: "0.85rem",
          color: "var(--amber)",
        }}
      >
        <span>叙事动作参考 · Narrative Move Library</span>
        <span aria-hidden style={{ fontSize: "0.9rem" }}>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ marginTop: "var(--space-2)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", lineHeight: 1.6 }}>
            这里的每个动作不是要抄进故事，而是让你想想：<em>你的 trace 里，哪一条可以做出类似的一次变化？</em>
          </div>
          {NARRATIVE_MOVES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onPickMove(m)}
              style={{
                textAlign: "left",
                padding: "var(--space-3)",
                background: "var(--card)",
                border: "1px solid var(--amber-soft)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                gap: "0.3rem",
              }}
            >
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--amber)" }}>{m.label}</div>
              <div style={{ fontSize: "0.82rem", lineHeight: 1.6, color: "var(--ink)" }}>{m.scenario}</div>
              <div style={{ fontSize: "0.78rem", color: "var(--ink-soft)", fontStyle: "italic" }}>
                思考：{m.question}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Story World Preview ----------
// 设计文档 §12：Writing Studio 里的可折叠场景预览，分两层：
//   - World Layer：真实痕迹（照片、声音、语音观察）
//   - Imagination Layer：儿童确认后的 Idea Cards（虚构角色/地点/变化）
// 应由儿童主动触发，不自动占据页面。
function StoryWorldPreview({ traces, ideas }: { traces: Material[]; ideas: IdeaCard[] }) {
  const [open, setOpen] = useState(false);
  const hasContent = traces.length > 0 || ideas.length > 0;
  return (
    <div
      className="card"
      style={{
        padding: 0,
        overflow: "hidden",
        borderColor: open ? "var(--accent-soft)" : "var(--line)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost"
        style={{
          width: "100%",
          justifyContent: "space-between",
          display: "flex",
          padding: "var(--space-3) var(--space-4)",
          fontSize: "0.85rem",
          borderRadius: 0,
          background: open ? "var(--accent-wash)" : "transparent",
          color: open ? "var(--accent)" : "var(--ink-soft)",
        }}
      >
        <span>
          <span style={{ marginRight: "0.4rem" }} aria-hidden>◐</span>
          Story World · 让这一幕出现（真实层 + 想象层）
        </span>
        <span aria-hidden>{open ? "▾" : "▸"}</span>
      </button>
      {open && (
        <div style={{ padding: "var(--space-4)", background: "var(--paper-soft)" }}>
          {!hasContent && (
            <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
              先在右边关联一些 Trace 或 Idea Card，再回来这里就能看到你的故事世界了。
            </p>
          )}
          {traces.length > 0 && (
            <div style={{ marginBottom: "var(--space-3)" }}>
              <div style={{ fontSize: "0.72rem", letterSpacing: "0.14em", color: "var(--ink-soft)", fontWeight: 700, marginBottom: "0.4rem" }}>
                真实层 · WORLD LAYER
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                {traces.map((t, i) => {
                  const code =
                    t.mediaKind === "photo" ? `P${i + 1}` :
                    t.mediaKind === "audio" ? `S${i + 1}` : `R${i + 1}`;
                  return (
                    <span
                      key={t.id}
                      title={t.iNoticed || t.title}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        padding: "0.25rem 0.6rem",
                        fontSize: "0.78rem",
                        background: "var(--card)",
                        border: "1px solid var(--accent-soft)",
                        borderRadius: "var(--radius-pill)",
                        color: "var(--accent)",
                      }}
                    >
                      <strong>{code}</strong>
                      <span style={{ color: "var(--ink)" }}>{t.title}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {ideas.length > 0 && (
            <div>
              <div style={{ fontSize: "0.72rem", letterSpacing: "0.14em", color: "var(--ink-soft)", fontWeight: 700, marginBottom: "0.4rem" }}>
                想象层 · IMAGINATION LAYER
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {ideas.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      padding: "0.5rem 0.7rem",
                      background: "var(--card)",
                      border: "1px dashed var(--amber-soft)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.85rem",
                      lineHeight: 1.65,
                    }}
                  >
                    <div style={{ color: "var(--ink)" }}>{c.content}</div>
                    {c.relationship && (
                      <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: "0.2rem" }}>
                        关系：{c.relationship}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}