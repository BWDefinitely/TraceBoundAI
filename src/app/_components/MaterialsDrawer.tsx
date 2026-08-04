"use client";

import { useMemo, useState, useTransition } from "react";
import type { FirstThought, MaterialWithBody } from "../../lib/types";
import {
  createMaterialAction,
  deleteMaterialAction,
  saveFirstThoughtAction,
  updateMaterialAction,
} from "../_actions";
import { Drawer } from "./Drawer";
import type { HandoffTarget } from "./AppShell";

const KINDS = ["观察", "想法", "时间", "地点", "人物", "物品"] as const;
type Kind = (typeof KINDS)[number];
type MediaKind = "text" | "photo" | "audio";

interface Props {
  open: boolean;
  onClose: () => void;
  materials: MaterialWithBody[];
  firstThoughts: FirstThought[];
  handoff: HandoffTarget | null;
  userId?: string;
}

export function MaterialsDrawer({ open, onClose, materials, firstThoughts, handoff, userId }: Props) {
  const [tab, setTab] = useState<"capture" | "review">("capture");
  const [flash, setFlash] = useState<string | null>(null);

  const firstThoughtsByTrace = useMemo(() => {
    const m = new Map<string, FirstThought>();
    for (const f of firstThoughts) m.set(f.traceId, f);
    return m;
  }, [firstThoughts]);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1800);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Trace 采集与回顾"
      subtitle="用「三问」把一小片生活变成可用的痕迹（Trace）"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <TabButton active={tab === "capture"} onClick={() => setTab("capture")}>
            采集新 Trace
          </TabButton>
          <TabButton active={tab === "review"} onClick={() => setTab("review")}>
            回顾（{materials.length}）
          </TabButton>
        </div>

        {flash && (
          <div
            role="status"
            style={{
              padding: "0.5rem 0.9rem",
              background: "var(--accent-wash)",
              color: "var(--accent)",
              borderRadius: "var(--radius)",
              fontSize: "0.9rem",
              border: "1px solid var(--accent-soft)",
            }}
          >
            {flash}
          </div>
        )}

        {tab === "capture" ? (
          <CaptureBlock onSaved={() => showFlash("已加到 Trace 库")} onSwitch={() => setTab("review")} />
        ) : (
          <ReviewBlock
            materials={materials}
            firstThoughtsByTrace={firstThoughtsByTrace}
            handoff={handoff}
            onAttached={(title) => {
              showFlash(`「${title}」已加到故事`);
              if (handoff?.label) onClose();
            }}
            onFirstThoughtSaved={() => showFlash("Pre-AI 想法已记录")}
          />
        )}
      </div>
    </Drawer>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        background: active ? "var(--accent)" : "transparent",
        borderColor: active ? "var(--accent)" : "var(--line)",
        color: active ? "white" : "var(--ink)",
        padding: "0.45rem 1rem",
      }}
    >
      {children}
    </button>
  );
}

// ---------- 采集：三问表单 ----------

function CaptureBlock({ onSaved, onSwitch, userId }: { onSaved: () => void; onSwitch: () => void; userId?: string }) {
  const [kind, setKind] = useState<Kind>("观察");
  const [mediaKind, setMediaKind] = useState<MediaKind>("text");
  const [title, setTitle] = useState("");
  const [iNoticed, setINoticed] = useState("");
  const [itRemindsMe, setItRemindsMe] = useState("");
  const [stillUnsure, setStillUnsure] = useState("");
  const [tags, setTags] = useState("");
  const [aiAllowed, setAiAllowed] = useState(true);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setINoticed("");
    setItRemindsMe("");
    setStillUnsure("");
    setTags("");
    setMediaPreview(null);
    setMediaKind("text");
    setAiAllowed(true);
    setError(null);
  }

  function pickPhoto(file: File | null) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMediaPreview(url);
    setMediaKind("photo");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    pickPhoto(file || null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {!userId && (
        <div style={{ padding: "var(--space-3)", background: "var(--accent-wash)", borderRadius: "var(--radius)", fontSize: "0.85rem" }}>
          ⚠️ 请先创建故事以获取用户ID
        </div>
      )}
      {error && (
        <div style={{ padding: "var(--space-3)", background: "var(--accent-wash)", borderRadius: "var(--radius)", fontSize: "0.85rem" }}>
          ⚠️ {error}
        </div>
      )}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div>
        <label>这是一份什么样的痕迹？</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          {KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              style={{
                padding: "0.35rem 0.8rem",
                fontSize: "0.85rem",
                background: kind === k ? "var(--accent)" : "var(--card)",
                color: kind === k ? "white" : "var(--ink)",
                borderColor: kind === k ? "var(--accent)" : "var(--line)",
              }}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <MediaPicker
        mediaKind={mediaKind}
        preview={mediaPreview}
        onText={() => {
          setMediaKind("text");
          setMediaPreview(null);
        }}
        onPickPhoto={pickPhoto}
        onMockAudio={() => {
          setMediaKind("audio");
          setMediaPreview(null);
        }}
      />

      <div>
        <label htmlFor="mat-title">给它起个小名字（可选）</label>
        <input
          id="mat-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：奶奶阳台上的橘子树"
        />
      </div>

      <ThreeQuestions
        iNoticed={iNoticed}
        itRemindsMe={itRemindsMe}
        stillUnsure={stillUnsure}
        onChange={(f, v) => {
          if (f === "iNoticed") setINoticed(v);
          if (f === "itRemindsMe") setItRemindsMe(v);
          if (f === "stillUnsure") setStillUnsure(v);
        }}
      />

      <div>
        <label htmlFor="mat-tags">小标签（可选，用空格或逗号隔开）</label>
        <input
          id="mat-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="秋天 阳台 橘子"
        />
      </div>

      <AiAllowedToggle value={aiAllowed} onChange={setAiAllowed} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" }}>
        <button className="btn-ghost" type="button" onClick={onSwitch}>
          去回顾 →
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={pending || !userId}
          onClick={() =>
            startTransition(async () => {
              const res = await createMaterialAction({
                userId: userId || "",
                title,
                kind,
                tags,
                iNoticed,
                itRemindsMe,
                stillUnsure,
                aiAllowed,
                mediaKind,
              });
              if (res.ok) {
                reset();
                setError(null);
                onSaved();
              } else {
                setError(res.message);
              }
            })
          }
        >
          {pending ? "保存中…" : !userId ? "请先创建故事获取用户ID" : "保存这份 Trace"}
        </button>
      </div>
      </div>
    </div>
  );
}

// ---------- Three-Question 表单 ----------

function ThreeQuestions({
  iNoticed,
  itRemindsMe,
  stillUnsure,
  onChange,
}: {
  iNoticed: string;
  itRemindsMe: string;
  stillUnsure: string;
  onChange: (field: "iNoticed" | "itRemindsMe" | "stillUnsure", value: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <QuestionField
        label="我注意到"
        emoji="👀"
        placeholder="今天风把树叶吹得沙沙响…"
        value={iNoticed}
        onChange={(v) => onChange("iNoticed", v)}
      />
      <QuestionField
        label="它让我想到"
        emoji="💭"
        placeholder="像有人在耳边说悄悄话…"
        value={itRemindsMe}
        onChange={(v) => onChange("itRemindsMe", v)}
      />
      <QuestionField
        label="还不确定"
        emoji="❓"
        placeholder="不知道那是谁在说话…"
        value={stillUnsure}
        onChange={(v) => onChange("stillUnsure", v)}
      />
    </div>
  );
}

function QuestionField({
  label,
  emoji,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  emoji: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <span style={{ fontSize: "1.1rem" }}>{emoji}</span>
        {label}
      </label>
      <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

// ---------- MediaPicker (Mock 多模态) ----------

function MediaPicker({
  mediaKind,
  preview,
  onText,
  onPickPhoto,
  onMockAudio,
}: {
  mediaKind: MediaKind;
  preview: string | null;
  onText: () => void;
  onPickPhoto: (f: File | null) => void;
  onMockAudio: () => void;
}) {
  return (
    <div>
      <label>媒介类型</label>
      <div style={{ display: "flex", gap: "0.4rem", marginBottom: "var(--space-2)" }}>
        <MediaButton active={mediaKind === "text"} onClick={onText}>
          📝 文字
        </MediaButton>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "0.35rem 0.8rem",
            fontSize: "0.85rem",
            borderRadius: "var(--radius-pill)",
            background: mediaKind === "photo" ? "var(--accent)" : "var(--card)",
            color: mediaKind === "photo" ? "white" : "var(--ink)",
            border: `1px solid ${mediaKind === "photo" ? "var(--accent)" : "var(--line)"}`,
            cursor: "pointer",
            margin: 0,
          }}
        >
          📷 拍照
          <input
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: "none" }}
            onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
          />
        </label>
        <MediaButton active={mediaKind === "audio"} onClick={onMockAudio}>
          🎤 录音
        </MediaButton>
      </div>
      {mediaKind === "photo" && preview && (
        <div
          style={{
            padding: "var(--space-2)",
            background: "var(--paper-soft)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)",
            marginBottom: "var(--space-2)",
          }}
        >
          <img
            src={preview}
            alt="照片预览"
            style={{ maxWidth: "100%", maxHeight: 200, borderRadius: "var(--radius-sm)", display: "block" }}
          />
          <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: 4 }}>
            预览仅本地显示 · 当前版本不会保存图片文件，只保留「文字三问」内容
          </div>
        </div>
      )}
      {mediaKind === "audio" && (
        <div
          style={{
            padding: "var(--space-3)",
            background: "var(--amber-wash)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--amber-soft)",
            fontSize: "0.85rem",
            color: "var(--amber)",
            marginBottom: "var(--space-2)",
          }}
        >
          🎙️ 录音功能即将上线。现在先用文字把你听到的声音描述在下面。
        </div>
      )}
    </div>
  );
}

function MediaButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "0.35rem 0.8rem",
        fontSize: "0.85rem",
        background: active ? "var(--accent)" : "var(--card)",
        color: active ? "white" : "var(--ink)",
        borderColor: active ? "var(--accent)" : "var(--line)",
      }}
    >
      {children}
    </button>
  );
}

// ---------- AI Allowed Toggle ----------

function AiAllowedToggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-3)",
        padding: "var(--space-3)",
        background: value ? "var(--accent-wash)" : "var(--paper-soft)",
        borderRadius: "var(--radius)",
        border: `1px solid ${value ? "var(--accent-soft)" : "var(--line)"}`,
        cursor: "pointer",
        margin: 0,
      }}
    >
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        style={{ margin: 0 }}
      />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{value ? "🔓 允许 AI 读取这份 Trace" : "🔒 不让 AI 看这份 Trace"}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", marginTop: 2 }}>
          {value
            ? "AI 才能在灵感炼金和写作辅助里用到它"
            : "AI 完全看不到，只有你自己能看到"}
        </div>
      </div>
    </label>
  );
}

// ---------- 回顾：Trace Card 列表 ----------

function ReviewBlock({
  materials,
  firstThoughtsByTrace,
  handoff,
  onAttached,
  onFirstThoughtSaved,
}: {
  materials: MaterialWithBody[];
  firstThoughtsByTrace: Map<string, FirstThought>;
  handoff: HandoffTarget | null;
  onAttached: (title: string) => void;
  onFirstThoughtSaved: () => void;
}) {
  const [query, setQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<"全部" | Kind>("全部");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((m) => {
      if (kindFilter !== "全部" && m.kind !== kindFilter) return false;
      if (!q) return true;
      const hay = [m.title, m.iNoticed, m.itRemindsMe, m.stillUnsure, ...m.tags].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [materials, query, kindFilter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <input
          type="search"
          placeholder="搜标题、三问、标签…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 200px" }}
        />
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as any)} style={{ width: "auto" }}>
          <option value="全部">全部类型</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="muted" style={{ padding: "var(--space-5)", textAlign: "center" }}>
          {materials.length === 0 ? "还没有 Trace，去采集第一份。" : "没有匹配的 Trace。"}
        </p>
      ) : (
        filtered.map((m) => (
          <TraceCard
            key={m.id}
            m={m}
            firstThought={firstThoughtsByTrace.get(m.id) ?? null}
            expanded={expandedId === m.id}
            onToggle={() => setExpandedId(expandedId === m.id ? null : m.id)}
            handoff={handoff}
            onAttached={() => onAttached(m.title)}
            onFirstThoughtSaved={onFirstThoughtSaved}
          />
        ))
      )}
    </div>
  );
}

function TraceCard({
  m,
  firstThought,
  expanded,
  onToggle,
  handoff,
  onAttached,
  onFirstThoughtSaved,
}: {
  m: MaterialWithBody;
  firstThought: FirstThought | null;
  expanded: boolean;
  onToggle: () => void;
  handoff: HandoffTarget | null;
  onAttached: () => void;
  onFirstThoughtSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();

  const mediaEmoji = m.mediaKind === "photo" ? "🖼️" : m.mediaKind === "audio" ? "🔊" : "🎙️";
  const chipClass =
    m.mediaKind === "photo"
      ? "icon-chip-accent"
      : m.mediaKind === "audio"
        ? "icon-chip-green"
        : "icon-chip-amber";

  return (
    <div
      className="card"
      style={{
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
        borderColor: m.favorite ? "var(--amber-soft)" : "var(--line-soft)",
        borderWidth: m.favorite ? 2 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flex: 1, minWidth: 0 }}>
          <span className={`icon-chip ${chipClass}`} style={{ width: 34, height: 34, fontSize: "0.95rem" }} aria-hidden>
            {mediaEmoji}
          </span>
          <span
            className={
              m.mediaKind === "photo" ? "tag tag-accent" :
              m.mediaKind === "audio" ? "tag tag-green" :
              "tag tag-amber"
            }
          >
            {m.kind}
          </span>
          <span
            style={{
              fontWeight: 700,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
            onClick={onToggle}
          >
            {m.title || "未命名"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <button
            className="btn-ghost"
            style={{ padding: "0.2rem 0.5rem", color: m.favorite ? "var(--amber)" : "var(--ink-soft)" }}
            onClick={() =>
              startTransition(async () => {
                await updateMaterialAction(m.id, { favorite: !m.favorite });
              })
            }
            aria-label={m.favorite ? "取消收藏" : "收藏"}
          >
            {m.favorite ? "★" : "☆"}
          </button>
          <button
            className="btn-ghost"
            style={{
              padding: "0.2rem 0.5rem",
              color: m.aiAllowed ? "var(--accent)" : "var(--ink-soft)",
              fontSize: "0.85rem",
            }}
            onClick={() =>
              startTransition(async () => {
                await updateMaterialAction(m.id, { aiAllowed: !m.aiAllowed });
              })
            }
            aria-label={m.aiAllowed ? "关闭 AI 读取" : "开启 AI 读取"}
            title={m.aiAllowed ? "AI 可读取（点击关闭）" : "AI 不可读取（点击开启）"}
          >
            {m.aiAllowed ? "🔓" : "🔒"}
          </button>
        </div>
      </div>

      {(m.iNoticed || m.itRemindsMe || m.stillUnsure) && (
        <div
          onClick={onToggle}
          style={{
            fontSize: "0.85rem",
            color: "var(--ink-soft)",
            lineHeight: 1.6,
            cursor: "pointer",
            overflow: "hidden",
            maxHeight: expanded ? "none" : "3rem",
          }}
        >
          {m.iNoticed && (
            <div>
              <span style={{ color: "var(--accent)" }}>👀 我注意到：</span>
              {m.iNoticed}
            </div>
          )}
          {expanded && m.itRemindsMe && (
            <div>
              <span style={{ color: "var(--accent)" }}>💭 它让我想到：</span>
              {m.itRemindsMe}
            </div>
          )}
          {expanded && m.stillUnsure && (
            <div>
              <span style={{ color: "var(--accent)" }}>❓ 还不确定：</span>
              {m.stillUnsure}
            </div>
          )}
          {!expanded && (m.itRemindsMe || m.stillUnsure) && (
            <div style={{ color: "var(--ink-soft)", fontSize: "0.75rem", marginTop: 2 }}>
              点击展开更多…
            </div>
          )}
        </div>
      )}

      {m.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
          {m.tags.map((t) => (
            <span key={t} style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>
              #{t}
            </span>
          ))}
        </div>
      )}

      {expanded && (
        <FirstThoughtBlock
          traceId={m.id}
          firstThought={firstThought}
          onSaved={onFirstThoughtSaved}
        />
      )}
      {!expanded && firstThought && (
        <div
          onClick={onToggle}
          style={{
            fontSize: "0.72rem",
            color: "var(--accent)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          🎯 Pre-AI 想法已记录 · 点击查看
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)", paddingTop: "var(--space-2)", borderTop: "1px dashed var(--line)" }}>
        <span style={{ fontSize: "0.72rem", color: "var(--ink-soft)" }}>
          {new Date(m.updatedAt).toLocaleDateString("zh-CN")}
        </span>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {handoff?.onAttachMaterial && (
            <button
              className="btn-primary"
              style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
              onClick={() => {
                handoff.onAttachMaterial!(m.id);
                onAttached();
              }}
            >
              加到当前故事 →
            </button>
          )}
          <button
            className="btn-ghost"
            style={{ padding: "0.3rem 0.6rem", fontSize: "0.8rem", color: "var(--danger)" }}
            onClick={() => {
              if (!confirm(`删掉「${m.title || "这份 Trace"}」？`)) return;
              startTransition(async () => {
                await deleteMaterialAction(m.id);
              });
            }}
            disabled={pending}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- First Thoughts (Pre-AI Baseline) 表单 ----------
// 需求文档 §3.4：AI 介入前的初始联想。整个组件里刻意不引用任何 AI 相关 UI。

function FirstThoughtBlock({
  traceId,
  firstThought,
  onSaved,
}: {
  traceId: string;
  firstThought: FirstThought | null;
  onSaved: () => void;
}) {
  const [actuallySawHeard, setSawHeard] = useState(firstThought?.actuallySawHeard ?? "");
  const [guessed, setGuessed] = useState(firstThought?.guessed ?? "");
  const [couldBecome, setCouldBecome] = useState(firstThought?.couldBecome ?? "");
  const [editing, setEditing] = useState(!firstThought);
  const [pending, startTransition] = useTransition();

  const hasAny = actuallySawHeard || guessed || couldBecome;

  if (!editing && firstThought) {
    return (
      <div
        style={{
          padding: "var(--space-3)",
          background: "var(--accent-wash)",
          border: "1px solid var(--accent-soft)",
          borderRadius: "var(--radius)",
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ color: "var(--accent)", fontSize: "0.9rem" }}>🎯</span>
            <strong style={{ fontSize: "0.85rem", color: "var(--accent)" }}>
              Pre-AI 想法（记录于 AI 介入前）
            </strong>
          </div>
          <button
            className="btn-ghost"
            style={{ padding: "0.2rem 0.6rem", fontSize: "0.75rem" }}
            onClick={() => setEditing(true)}
          >
            编辑
          </button>
        </div>
        {firstThought.actuallySawHeard && (
          <FirstThoughtLine emoji="👁" label="实际看到/听到" value={firstThought.actuallySawHeard} />
        )}
        {firstThought.guessed && (
          <FirstThoughtLine emoji="💡" label="猜测是什么" value={firstThought.guessed} />
        )}
        {firstThought.couldBecome && (
          <FirstThoughtLine emoji="✨" label="故事中可能变成" value={firstThought.couldBecome} />
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "var(--space-3)",
        background: "var(--paper-soft)",
        border: "1px dashed var(--accent-soft)",
        borderRadius: "var(--radius)",
        display: "flex",
        flexDirection: "column",
        gap: "0.5rem",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: 2 }}>
        <span style={{ color: "var(--accent)" }}>🎯</span>
        <strong style={{ fontSize: "0.85rem", color: "var(--accent)" }}>
          First Thoughts · 先想一想，再让 AI 参与
        </strong>
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)", lineHeight: 1.6, marginBottom: 4 }}>
        这里只属于你——记完之前，不要打开炼金釜或 AI 伙伴。
      </div>
      <FirstThoughtField
        label="实际看到/听到什么？"
        placeholder="用你自己的话描述看到、听到、闻到、感觉到的"
        value={actuallySawHeard}
        onChange={setSawHeard}
      />
      <FirstThoughtField
        label="你猜是什么？"
        placeholder="不用担心猜错，写下你的第一个念头"
        value={guessed}
        onChange={setGuessed}
      />
      <FirstThoughtField
        label="故事中它可能变成什么？"
        placeholder="想象一下，它可以变成什么角色、场景、道具？"
        value={couldBecome}
        onChange={setCouldBecome}
      />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem", marginTop: 4 }}>
        {firstThought && (
          <button
            className="btn-ghost"
            style={{ padding: "0.25rem 0.7rem", fontSize: "0.8rem" }}
            onClick={() => {
              setSawHeard(firstThought.actuallySawHeard);
              setGuessed(firstThought.guessed);
              setCouldBecome(firstThought.couldBecome);
              setEditing(false);
            }}
          >
            取消
          </button>
        )}
        <button
          className="btn-primary"
          style={{ padding: "0.3rem 0.8rem", fontSize: "0.8rem" }}
          disabled={pending || !hasAny}
          onClick={() =>
            startTransition(async () => {
              const res = await saveFirstThoughtAction({
                traceId,
                actuallySawHeard,
                guessed,
                couldBecome,
              });
              if (res.ok) {
                setEditing(false);
                onSaved();
              }
            })
          }
        >
          {pending ? "保存中…" : firstThought ? "更新想法" : "记下我的 Pre-AI 想法"}
        </button>
      </div>
    </div>
  );
}

function FirstThoughtLine({ emoji, label, value }: { emoji: string; label: string; value: string }) {
  return (
    <div style={{ fontSize: "0.8rem", lineHeight: 1.6 }}>
      <span style={{ color: "var(--accent)" }}>
        {emoji} {label}：
      </span>
      <span style={{ color: "var(--ink)" }}>{value}</span>
    </div>
  );
}

function FirstThoughtField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label style={{ fontSize: "0.75rem", marginBottom: 3 }}>{label}</label>
      <textarea
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: "0.85rem", minHeight: 50 }}
      />
    </div>
  );
}
