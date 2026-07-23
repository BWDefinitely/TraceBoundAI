"use client";

import { useMemo, useState, useTransition } from "react";
import type { MaterialWithBody } from "../../lib/types";
import {
  createMaterialAction,
  deleteMaterialAction,
  updateMaterialAction,
} from "../_actions";
import { Drawer } from "./Drawer";
import type { HandoffTarget } from "./AppShell";

const KINDS = ["观察", "感受", "想法", "对话", "声音", "画面"] as const;
type Kind = (typeof KINDS)[number];

interface Props {
  open: boolean;
  onClose: () => void;
  materials: MaterialWithBody[];
  handoff: HandoffTarget | null;
}

export function MaterialsDrawer({ open, onClose, materials, handoff }: Props) {
  const [tab, setTab] = useState<"capture" | "review">("capture");
  const [flash, setFlash] = useState<string | null>(null);

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 1800);
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="素材采集与回顾"
      subtitle="随时记下一小片生活，或翻看之前采集的素材"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <TabButton active={tab === "capture"} onClick={() => setTab("capture")}>
            采集新素材
          </TabButton>
          <TabButton active={tab === "review"} onClick={() => setTab("review")}>
            回顾已有（{materials.length}）
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
          <CaptureBlock onSaved={() => showFlash("已加到素材库")} onSwitch={() => setTab("review")} />
        ) : (
          <ReviewBlock
            materials={materials}
            handoff={handoff}
            onAttached={(title) => {
              showFlash(`「${title}」已加到故事`);
              handoff?.label && onClose();
            }}
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

// ---------- 采集 ----------

function CaptureBlock({ onSaved, onSwitch }: { onSaved: () => void; onSwitch: () => void }) {
  const [kind, setKind] = useState<Kind>("观察");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div>
        <label>这是一份什么样的素材？</label>
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

      <div>
        <label htmlFor="mat-title">给它起个小名字（可选）</label>
        <input
          id="mat-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="例：奶奶阳台上的橘子树"
        />
      </div>

      <div>
        <label htmlFor="mat-body">你想记下什么？</label>
        <textarea
          id="mat-body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={"今天风把树叶吹得沙沙响，我觉得像有人在耳边说悄悄话。"}
        />
      </div>

      <div>
        <label htmlFor="mat-tags">小标签（可选，用空格或逗号隔开）</label>
        <input
          id="mat-tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="秋天 阳台 橘子"
        />
      </div>

      {error && <div style={{ fontSize: "0.85rem", color: "var(--danger)" }}>{error}</div>}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "var(--space-2)" }}>
        <button className="btn-ghost" type="button" onClick={onSwitch}>
          去回顾 →
        </button>
        <button
          type="button"
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res = await createMaterialAction({ title, kind, body, tags });
              if (res.ok) {
                setTitle("");
                setBody("");
                setTags("");
                setError(null);
                onSaved();
              } else {
                setError(res.message);
              }
            })
          }
        >
          {pending ? "保存中…" : "保存这份素材"}
        </button>
      </div>
    </div>
  );
}

// ---------- 回顾 ----------

function ReviewBlock({
  materials,
  handoff,
  onAttached,
}: {
  materials: MaterialWithBody[];
  handoff: HandoffTarget | null;
  onAttached: (title: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"全部" | Kind>("全部");
  const [favOnly, setFavOnly] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return materials.filter((m) => {
      if (kind !== "全部" && m.kind !== kind) return false;
      if (favOnly && !m.favorite) return false;
      if (!q) return true;
      return `${m.title} ${m.body} ${m.tags.join(" ")}`.toLowerCase().includes(q);
    });
  }, [materials, query, kind, favOnly]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          alignItems: "center",
          flexWrap: "wrap",
          padding: "var(--space-3)",
          background: "var(--card)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
        }}
      >
        <input
          type="search"
          placeholder="搜标题、正文或标签…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 220px", minWidth: 0 }}
        />
        <select value={kind} onChange={(e) => setKind(e.target.value as any)} style={{ width: "auto" }}>
          {(["全部", ...KINDS] as const).map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <button
          onClick={() => setFavOnly((v) => !v)}
          aria-pressed={favOnly}
          className={favOnly ? "btn-amber" : ""}
        >
          {favOnly ? "★ 只看收藏" : "☆ 只看收藏"}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "var(--space-6)" }}>
          <p className="muted">这里空空的。切到「采集新素材」加一份吧。</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {filtered.map((m) =>
            editing === m.id ? (
              <EditCard key={m.id} m={m} onDone={() => setEditing(null)} />
            ) : (
              <MaterialCard
                key={m.id}
                m={m}
                onEdit={() => setEditing(m.id)}
                onAttach={
                  handoff?.onAttachMaterial
                    ? () => {
                        handoff.onAttachMaterial!(m.id);
                        onAttached(m.title);
                      }
                    : undefined
                }
              />
            )
          )}
        </div>
      )}
    </div>
  );
}

function MaterialCard({
  m,
  onEdit,
  onAttach,
}: {
  m: MaterialWithBody;
  onEdit: () => void;
  onAttach?: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <article
      className="card fade-in"
      style={{
        padding: "var(--space-4)",
        borderColor: m.favorite ? "var(--amber-soft)" : "var(--line)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-2)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
            <span className="tag tag-accent">{m.kind}</span>
            <span style={{ fontWeight: 700, fontSize: "1rem" }}>{m.title}</span>
          </div>
          <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
            {new Date(m.updatedAt).toLocaleDateString("zh-CN")}
          </span>
        </div>
        <button
          className="btn-ghost"
          onClick={() =>
            startTransition(async () => {
              await updateMaterialAction(m.id, { favorite: !m.favorite });
            })
          }
          disabled={pending}
          aria-label={m.favorite ? "取消收藏" : "收藏"}
          style={{ color: m.favorite ? "var(--amber)" : "var(--ink-soft)", padding: "0.15rem 0.6rem" }}
        >
          {m.favorite ? "★" : "☆"}
        </button>
      </div>

      <p
        style={{
          fontSize: "0.9rem",
          lineHeight: 1.7,
          color: "var(--ink)",
          whiteSpace: "pre-wrap",
          maxHeight: "8rem",
          overflow: "hidden",
        }}
      >
        {m.body || "（这份素材还没有正文）"}
      </p>

      {m.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
          {m.tags.map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "var(--space-2)",
          borderTop: "1px dashed var(--line)",
        }}
      >
        <div style={{ display: "flex", gap: "var(--space-2)" }}>
          <button className="btn-ghost" onClick={onEdit} disabled={pending}>
            编辑
          </button>
          <button
            className="btn-ghost"
            style={{ color: "var(--danger)" }}
            disabled={pending}
            onClick={() => {
              if (!confirm(`删除「${m.title}」？`)) return;
              startTransition(async () => {
                await deleteMaterialAction(m.id);
              });
            }}
          >
            删除
          </button>
        </div>
        {onAttach && (
          <button
            className="btn-primary"
            onClick={onAttach}
            style={{ padding: "0.35rem 0.9rem", fontSize: "0.9rem" }}
          >
            加到当前故事 →
          </button>
        )}
      </div>
    </article>
  );
}

function EditCard({ m, onDone }: { m: MaterialWithBody; onDone: () => void }) {
  const [title, setTitle] = useState(m.title);
  const [kind, setKind] = useState<Kind>(m.kind as Kind);
  const [body, setBody] = useState(m.body);
  const [tags, setTags] = useState(m.tags.join(" "));
  const [pending, startTransition] = useTransition();

  return (
    <article className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" />
      <select value={kind} onChange={(e) => setKind(e.target.value as Kind)}>
        {KINDS.map((k) => (
          <option key={k} value={k}>
            {k}
          </option>
        ))}
      </select>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} />
      <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-2)" }}>
        <button className="btn-ghost" onClick={onDone} disabled={pending}>
          取消
        </button>
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await updateMaterialAction(m.id, { title, kind, body, tags });
              onDone();
            })
          }
        >
          {pending ? "保存中…" : "保存"}
        </button>
      </div>
    </article>
  );
}
