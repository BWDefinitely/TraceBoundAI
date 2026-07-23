"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Material, Story } from "../../../lib/store";
import { completeStoryAction, saveStoryAction } from "../../_actions";
import { useDrawers } from "../../_components/AppShell";

type Storyline = Story["storyline"];
type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

interface Props {
  story: Story & { body: string };
  materials: Material[];
}

const BEATS: Array<{ key: keyof Storyline; label: string; hint: string; color: string; wash: string }> = [
  { key: "qi", label: "起", hint: "故事从哪里开始？谁、在哪里、发生了什么小事？", color: "var(--accent)", wash: "var(--accent-wash)" },
  { key: "cheng", label: "承", hint: "顺着这件事，接下来发生了什么？把它慢慢展开。", color: "var(--accent)", wash: "var(--accent-wash)" },
  { key: "zhuan", label: "转", hint: "有什么让人意外的事？让故事拐一个弯。", color: "var(--amber)", wash: "var(--amber-wash)" },
  { key: "he", label: "合", hint: "最后停在哪里？留下一个感觉或一个念头。", color: "var(--accent)", wash: "var(--accent-wash)" },
];

const AUTOSAVE_MS = 900;

export function StoryEditor({ story, materials }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(story.title);
  const [body, setBody] = useState(story.body);
  const [beats, setBeats] = useState<Storyline>(story.storyline);
  const [linked, setLinked] = useState<string[]>(story.linkedMaterialIds);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [completing, setCompleting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  const { openDrawer, registerHandoff } = useDrawers();
  const completed = Boolean(story.completedAt);

  // 把最新的 setter 引用暴露给抽屉 handoff 回调（handoff 只在挂载时注册一次）
  const setLinkedRef = useRef(setLinked);
  const setBodyRef = useRef(setBody);
  useEffect(() => {
    setLinkedRef.current = setLinked;
    setBodyRef.current = setBody;
  });
  const markRef = useRef<() => void>(() => {});
  const bodyRefCurrent = useRef(body);
  useEffect(() => {
    bodyRefCurrent.current = body;
  });

  const persist = useCallback(async () => {
    setSaveState("saving");
    try {
      await saveStoryAction(story.id, { title, body, storyline: beats, linkedMaterialIds: linked });
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }, [story.id, title, body, beats, linked]);

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

  // 注册 handoff：让抽屉知道当前是故事编辑器
  useEffect(() => {
    registerHandoff({
      label: story.title,
      onAttachMaterial: (mid: string) => {
        setLinkedRef.current((prev) => (prev.includes(mid) ? prev : [...prev, mid]));
        markRef.current();
      },
      onInsertAlchemy: (text: string) => {
        const insertion = `\n\n【灵感火花】\n${text}\n\n`;
        setBodyRef.current(bodyRefCurrent.current + insertion);
        markRef.current();
        // 聚焦到正文末尾
        setTimeout(() => {
          const el = bodyRef.current;
          if (el) {
            el.focus();
            el.selectionStart = el.selectionEnd = el.value.length;
            el.scrollTop = el.scrollHeight;
          }
        }, 60);
      },
    });
    return () => {
      registerHandoff(null);
    };
  }, [registerHandoff, story.title]);

  const wordCount = body.replace(/\s/g, "").length;
  const filledBeats = BEATS.filter((b) => beats[b.key].trim().length > 0).length;

  async function onComplete() {
    if (!confirm(`将「${title}」标记为完成？完成后可以在反思回顾里写下感受。`)) return;
    // 先把当前编辑保存下来
    setCompleting(true);
    await persist();
    await completeStoryAction(story.id);
    router.push(`/reflect?story=${story.id}`);
  }

  return (
    <div className="fade-in">
      {/* 顶部操作条 */}
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
          <button className="btn-ghost" onClick={() => openDrawer("materials")}>
            ◑ 素材抽屉
          </button>
          <button className="btn-ghost" onClick={() => openDrawer("alchemy")} style={{ color: "var(--amber)" }}>
            ✦ 灵感炼金
          </button>
          <SaveBadge state={saveState} />
          <button className="btn-ghost" onClick={() => void persist()} disabled={saveState === "saving"}>
            立即保存
          </button>
          {completed ? (
            <Link href={`/reflect?story=${story.id}`} className="btn-primary">
              去写反思 →
            </Link>
          ) : (
            <button
              className="btn-primary"
              onClick={onComplete}
              disabled={completing}
              title="标记完成并跳转到反思回顾"
            >
              {completing ? "完成中…" : "写完了 · 去反思"}
            </button>
          )}
        </div>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "var(--space-6)" }}>
        {/* 主编辑区 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div className="card" style={{ padding: "var(--space-3) var(--space-4)" }}>
            <input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                mark();
              }}
              placeholder="给这个故事起个名字…"
              readOnly={completed}
              style={{
                fontSize: "1.3rem",
                fontFamily: "var(--font-serif)",
                fontWeight: 700,
                border: "none",
                background: "transparent",
                padding: 0,
              }}
            />
          </div>

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <textarea
              ref={bodyRef}
              aria-label="故事正文"
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                mark();
              }}
              readOnly={completed}
              placeholder={"在这里慢慢写…\n\n可以先照着右边的“起承转合”写，也可以先写你最想写的一段。"}
              style={{
                border: "none",
                borderRadius: 0,
                minHeight: 540,
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
              <span>故事线已填 {filledBeats} / 4 段</span>
            </div>
          </div>
        </div>

        {/* 故事线 + 关联素材 */}
        <aside style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div>
            <div
              style={{
                fontSize: "0.75rem",
                letterSpacing: "0.14em",
                fontWeight: 700,
                color: "var(--ink-soft)",
                marginBottom: "var(--space-3)",
              }}
            >
              故事线 · 起承转合
            </div>

            <Timeline beats={beats} />

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", marginTop: "var(--space-4)" }}>
              {BEATS.map((b) => (
                <div
                  key={b.key}
                  className="card"
                  style={{ padding: "var(--space-3) var(--space-4)", borderLeft: `4px solid ${b.color}` }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-1)" }}>
                    <span
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: "50%",
                        background: b.wash,
                        color: b.color,
                        fontFamily: "var(--font-serif)",
                        fontWeight: 700,
                        display: "grid",
                        placeItems: "center",
                        fontSize: "0.9rem",
                      }}
                    >
                      {b.label}
                    </span>
                    <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>{b.hint}</span>
                  </div>
                  <textarea
                    value={beats[b.key]}
                    readOnly={completed}
                    onChange={(e) => {
                      setBeats((prev) => ({ ...prev, [b.key]: e.target.value }));
                      mark();
                    }}
                    rows={2}
                    placeholder={`用一两句话写下「${b.label}」…`}
                    style={{
                      minHeight: 60,
                      fontSize: "0.95rem",
                      lineHeight: 1.7,
                      fontFamily: "var(--font-sans)",
                      background: "var(--paper-soft)",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "var(--space-3)",
              }}
            >
              <div
                style={{
                  fontSize: "0.75rem",
                  letterSpacing: "0.14em",
                  fontWeight: 700,
                  color: "var(--ink-soft)",
                }}
              >
                关联的素材 · {linked.length}
              </div>
              <button className="btn-ghost" onClick={() => openDrawer("materials")}>
                打开素材抽屉 →
              </button>
            </div>

            <div
              className="card"
              style={{
                padding: "var(--space-3)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
                minHeight: 80,
              }}
            >
              {linked.length === 0 ? (
                <p className="muted" style={{ fontSize: "0.9rem" }}>
                  还没有关联任何素材。打开右上角的「素材抽屉」，在素材卡片上点「加到当前故事」。
                </p>
              ) : (
                linked.map((id) => {
                  const m = materials.find((x) => x.id === id);
                  if (!m) return null;
                  return (
                    <div
                      key={id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "var(--space-2) var(--space-3)",
                        background: "var(--paper-soft)",
                        borderRadius: "var(--radius)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", minWidth: 0 }}>
                        <span className="tag tag-accent">{m.kind}</span>
                        <span style={{ fontWeight: 600, fontSize: "0.9rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {m.title}
                        </span>
                      </div>
                      {!completed && (
                        <button
                          className="btn-ghost"
                          style={{ padding: "0.15rem 0.5rem", color: "var(--ink-soft)" }}
                          onClick={() => {
                            setLinked((prev) => prev.filter((x) => x !== id));
                            mark();
                          }}
                          aria-label={`移除 ${m.title}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Timeline({ beats }: { beats: Storyline }) {
  const filled = [beats.qi, beats.cheng, beats.zhuan, beats.he].map((v) => v.trim().length > 0);
  return (
    <div style={{ position: "relative", padding: "var(--space-3) 0" }}>
      <div
        style={{
          position: "absolute",
          left: 12,
          right: 12,
          top: "50%",
          height: 3,
          background: "var(--line)",
          borderRadius: 2,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 12,
          top: "50%",
          height: 3,
          width: `calc((100% - 24px) * ${filled.filter(Boolean).length / 4})`,
          background: "linear-gradient(90deg, var(--accent) 0%, var(--amber) 100%)",
          borderRadius: 2,
          transition: "width 0.3s ease",
        }}
      />
      <div style={{ position: "relative", display: "flex", justifyContent: "space-between" }}>
        {["起", "承", "转", "合"].map((label, i) => (
          <div
            key={label}
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: filled[i] ? (i === 2 ? "var(--amber)" : "var(--accent)") : "var(--card)",
              color: filled[i] ? "white" : "var(--ink-soft)",
              border: `2px solid ${filled[i] ? "transparent" : "var(--line)"}`,
              fontFamily: "var(--font-serif)",
              fontWeight: 700,
              display: "grid",
              placeItems: "center",
              boxShadow: filled[i] ? "var(--shadow-1)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function SaveBadge({ state }: { state: SaveState }) {
  const meta: Record<SaveState, { text: string; bg: string; color: string }> = {
    idle: { text: "已保存", bg: "var(--accent-wash)", color: "var(--accent)" },
    unsaved: { text: "待保存…", bg: "var(--amber-wash)", color: "var(--amber)" },
    saving: { text: "保存中", bg: "var(--amber-wash)", color: "var(--amber)" },
    saved: { text: "已保存", bg: "var(--accent-wash)", color: "var(--accent)" },
    error: { text: "保存失败", bg: "var(--danger-wash)", color: "var(--danger)" },
  };
  const m = meta[state];
  return (
    <span
      role="status"
      aria-live="polite"
      style={{
        padding: "0.25rem 0.7rem",
        borderRadius: "var(--radius-pill)",
        background: m.bg,
        color: m.color,
        fontSize: "0.8rem",
        fontWeight: 600,
      }}
    >
      {m.text}
    </span>
  );
}
