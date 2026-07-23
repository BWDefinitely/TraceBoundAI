"use client";

import { useMemo, useState, useTransition } from "react";
import type { AlchemyRecord, Material } from "../../lib/store";
import { brewAction, deleteAlchemyAction } from "../_actions";
import { Drawer } from "./Drawer";
import type { HandoffTarget } from "./AppShell";

interface Props {
  open: boolean;
  onClose: () => void;
  materials: Material[];
  history: AlchemyRecord[];
  providerLabel: string;
  handoff: HandoffTarget | null;
}

type Slot = "A" | "B";

export function AlchemyDrawer({ open, onClose, materials, history, providerLabel, handoff }: Props) {
  const [slotA, setSlotA] = useState<Material | null>(null);
  const [slotB, setSlotB] = useState<Material | null>(null);
  const [dragOver, setDragOver] = useState<Slot | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return materials;
    return materials.filter(
      (m) => m.title.toLowerCase().includes(q) || m.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [materials, query]);

  const inUse = new Set<string>();
  if (slotA) inUse.add(slotA.id);
  if (slotB) inUse.add(slotB.id);

  function place(slot: Slot, m: Material) {
    if (slot === "A") {
      if (slotB?.id === m.id) setSlotB(null);
      setSlotA(m);
    } else {
      if (slotA?.id === m.id) setSlotA(null);
      setSlotB(m);
    }
    setError(null);
    setResult(null);
  }

  function clearSlot(s: Slot) {
    if (s === "A") setSlotA(null);
    else setSlotB(null);
    setResult(null);
  }

  function placeAuto(m: Material) {
    if (!slotA) return place("A", m);
    if (!slotB) return place("B", m);
    place("A", m);
  }

  function onBrew() {
    if (!slotA || !slotB) {
      setError("先往炼金釜里放两份素材。");
      return;
    }
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await brewAction({ aId: slotA.id, bId: slotB.id });
      if (res.ok) setResult(res.record.result);
      else setError(res.message);
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="灵感炼金"
      subtitle={`两份素材 → 一段联想 · 当前引擎：${providerLabel}`}
      color="amber"
      width={720}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <section
          className="card"
          style={{
            padding: "var(--space-5)",
            background: "linear-gradient(180deg, var(--paper-soft) 0%, var(--card) 60%)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "var(--space-4)",
          }}
        >
          <div style={{ display: "flex", gap: "var(--space-5)", alignItems: "center" }}>
            <SlotChip
              slot="A"
              value={slotA}
              highlighted={dragOver === "A"}
              onDragEnter={() => setDragOver("A")}
              onDragLeave={() => setDragOver((s) => (s === "A" ? null : s))}
              onDrop={(id) => {
                const m = materials.find((x) => x.id === id);
                if (m) place("A", m);
              }}
              onClear={() => clearSlot("A")}
            />
            <span
              aria-hidden
              style={{ fontFamily: "var(--font-serif)", fontSize: "1.5rem", color: "var(--amber)", fontWeight: 700 }}
            >
              +
            </span>
            <SlotChip
              slot="B"
              value={slotB}
              highlighted={dragOver === "B"}
              onDragEnter={() => setDragOver("B")}
              onDragLeave={() => setDragOver((s) => (s === "B" ? null : s))}
              onDrop={(id) => {
                const m = materials.find((x) => x.id === id);
                if (m) place("B", m);
              }}
              onClear={() => clearSlot("B")}
            />
          </div>

          <CauldronSVG working={pending} filled={Boolean(slotA) && Boolean(slotB)} />

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <button
              type="button"
              className="btn-amber"
              onClick={onBrew}
              disabled={pending || !slotA || !slotB}
              style={{ fontSize: "1rem", padding: "0.7rem 1.6rem" }}
            >
              {pending ? "炼金中…" : "开始炼金"}
            </button>
            {error && <span style={{ fontSize: "0.9rem", color: "var(--danger)" }}>{error}</span>}
          </div>
        </section>

        {result && (
          <section
            className="card fade-in"
            style={{
              padding: "var(--space-5)",
              background: "var(--amber-wash)",
              borderColor: "var(--amber-soft)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span style={{ color: "var(--amber)", fontSize: "1.1rem" }}>✦</span>
                <div style={{ fontWeight: 700, color: "var(--amber)" }}>炼金火花</div>
              </div>
              {handoff?.onInsertAlchemy && (
                <button
                  className="btn-amber"
                  style={{ padding: "0.35rem 0.9rem", fontSize: "0.9rem" }}
                  onClick={() => {
                    handoff.onInsertAlchemy!(result);
                    onClose();
                  }}
                >
                  作为灵感放进正文 →
                </button>
              )}
            </div>
            <p
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: "1rem",
                lineHeight: 1.85,
                color: "var(--ink)",
                whiteSpace: "pre-wrap",
              }}
            >
              {result}
            </p>
          </section>
        )}

        <section>
          <div
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.14em",
              fontWeight: 700,
              color: "var(--ink-soft)",
              marginBottom: "var(--space-3)",
            }}
          >
            素材架 · 拖到炼金釜（或点击自动放入）
          </div>
          <input
            type="search"
            placeholder="搜标题或标签"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ marginBottom: "var(--space-3)" }}
          />
          {filtered.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              还没有可炼金的素材。先在「素材采集与回顾」加两份不一样的素材。
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "var(--space-2)",
              }}
            >
              {filtered.map((m) => {
                const used = inUse.has(m.id);
                const isDragging = dragging === m.id;
                return (
                  <div
                    key={m.id}
                    draggable={!used}
                    onDragStart={(e) => {
                      if (used) return e.preventDefault();
                      e.dataTransfer.setData("text/plain", m.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragging(m.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                    onClick={() => !used && placeAuto(m)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if ((e.key === "Enter" || e.key === " ") && !used) {
                        e.preventDefault();
                        placeAuto(m);
                      }
                    }}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                      padding: "var(--space-3)",
                      borderRadius: "var(--radius)",
                      background: used ? "var(--paper-soft)" : "var(--card)",
                      border: "1px solid var(--line)",
                      cursor: used ? "not-allowed" : "grab",
                      opacity: used ? 0.5 : isDragging ? 0.4 : 1,
                      transition: "transform 0.12s ease, box-shadow 0.12s ease",
                      boxShadow: isDragging ? "var(--shadow-2)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <span className="tag tag-accent">{m.kind}</span>
                      {used && <span className="tag">已在釜内</span>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", lineHeight: 1.35 }}>{m.title}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <div
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.14em",
              fontWeight: 700,
              color: "var(--ink-soft)",
              marginBottom: "var(--space-3)",
            }}
          >
            过往炼金
          </div>
          {history.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.9rem" }}>
              还没有过炼金记录。第一次会记在这里。
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {history.slice(0, 8).map((h) => (
                <HistoryItem key={h.id} record={h} onInsert={handoff?.onInsertAlchemy} onCloseDrawer={onClose} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Drawer>
  );

  function SlotChip({
    slot,
    value,
    onDrop,
    onClear,
    highlighted,
    onDragEnter,
    onDragLeave,
  }: {
    slot: Slot;
    value: Material | null;
    onDrop: (id: string) => void;
    onClear: () => void;
    highlighted: boolean;
    onDragEnter: () => void;
    onDragLeave: () => void;
  }) {
    const empty = !value;
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          onDragEnter();
        }}
        onDragLeave={onDragLeave}
        onDrop={(e) => {
          e.preventDefault();
          const id = e.dataTransfer.getData("text/plain");
          if (id) onDrop(id);
          onDragLeave();
        }}
        style={{
          width: 170,
          minHeight: 104,
          borderRadius: "var(--radius-lg)",
          border: `2px dashed ${highlighted ? "var(--amber)" : "var(--line)"}`,
          background: highlighted ? "var(--amber-wash)" : "var(--card)",
          padding: "var(--space-3)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: empty ? "center" : "flex-start",
          textAlign: empty ? "center" : "left",
          transition: "all 0.15s ease",
          position: "relative",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 12,
            background: "var(--paper)",
            padding: "0 6px",
            fontSize: "0.7rem",
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "var(--ink-soft)",
          }}
        >
          槽位 {slot}
        </span>
        {empty ? (
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            拖一份素材到这里
          </span>
        ) : (
          <>
            <span className="tag tag-accent" style={{ marginBottom: "0.3rem" }}>
              {value!.kind}
            </span>
            <span style={{ fontWeight: 600, fontSize: "0.92rem", lineHeight: 1.35 }}>{value!.title}</span>
            <button
              className="btn-ghost"
              onClick={onClear}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                padding: "0.1rem 0.5rem",
                fontSize: "0.8rem",
              }}
              aria-label="移除素材"
            >
              ×
            </button>
          </>
        )}
      </div>
    );
  }
}

function CauldronSVG({ working, filled }: { working: boolean; filled: boolean }) {
  return (
    <div
      style={{
        width: 220,
        height: 190,
        position: "relative",
        display: "grid",
        placeItems: "center",
        animation: working ? "cauldronPulse 1.6s ease-in-out infinite" : undefined,
        borderRadius: "50%",
      }}
    >
      <svg viewBox="0 0 260 220" width="100%" height="100%" role="img" aria-label="炼金釜">
        <defs>
          <linearGradient id="brew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C97A2B" stopOpacity={filled ? 0.9 : 0.35} />
            <stop offset="1" stopColor="#2F7A6B" stopOpacity={filled ? 0.85 : 0.3} />
          </linearGradient>
          <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3A3F45" />
            <stop offset="1" stopColor="#1D2226" />
          </linearGradient>
          <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#F5C97D" stopOpacity="0.5" />
            <stop offset="1" stopColor="#F5C97D" stopOpacity="0" />
          </radialGradient>
        </defs>

        {filled && <circle cx="130" cy="110" r="90" fill="url(#glow)" />}

        {filled && (
          <g opacity={working ? 0.9 : 0.55}>
            <path d="M100 50 Q108 30 100 12" stroke="#B4DDD1" strokeWidth="4" strokeLinecap="round" fill="none">
              {working && <animate attributeName="opacity" values="0.2;1;0.2" dur="2.2s" repeatCount="indefinite" />}
            </path>
            <path d="M130 44 Q140 26 132 6" stroke="#F1D6A9" strokeWidth="4" strokeLinecap="round" fill="none">
              {working && <animate attributeName="opacity" values="0.4;1;0.4" dur="2.6s" repeatCount="indefinite" />}
            </path>
            <path d="M160 50 Q168 32 160 14" stroke="#B4DDD1" strokeWidth="4" strokeLinecap="round" fill="none">
              {working && <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite" />}
            </path>
          </g>
        )}

        <ellipse cx="130" cy="80" rx="90" ry="14" fill="#242A31" />
        <path d="M40 80 Q40 200 130 200 Q220 200 220 80 Z" fill="url(#body)" stroke="#12161A" strokeWidth="2" />
        <ellipse cx="130" cy="86" rx="82" ry="10" fill="url(#brew)" />

        {filled && working && (
          <>
            <circle cx="105" cy="86" r="3" fill="#FBEFD6" opacity="0.85">
              <animate attributeName="cy" values="86;74;86" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0;0.8" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx="140" cy="86" r="2.5" fill="#FBEFD6" opacity="0.85">
              <animate attributeName="cy" values="86;70;86" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="155" cy="86" r="2" fill="#FBEFD6" opacity="0.85">
              <animate attributeName="cy" values="86;76;86" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </>
        )}

        <rect x="70" y="200" width="12" height="14" rx="3" fill="#242A31" />
        <rect x="178" y="200" width="12" height="14" rx="3" fill="#242A31" />
        <path d="M96 214 Q104 200 112 214 Q108 208 104 214 Q100 208 96 214 Z" fill="#C97A2B" opacity="0.9">
          {working && <animate attributeName="opacity" values="0.5;1;0.5" dur="0.9s" repeatCount="indefinite" />}
        </path>
        <path d="M148 214 Q156 200 164 214 Q160 208 156 214 Q152 208 148 214 Z" fill="#C97A2B" opacity="0.9">
          {working && <animate attributeName="opacity" values="0.7;1;0.7" dur="1.1s" repeatCount="indefinite" />}
        </path>
      </svg>
    </div>
  );
}

function HistoryItem({
  record,
  onInsert,
  onCloseDrawer,
}: {
  record: AlchemyRecord;
  onInsert?: (text: string) => void;
  onCloseDrawer: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="card" style={{ padding: "var(--space-3) var(--space-4)" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          width: "100%",
          textAlign: "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: "none",
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: "0.92rem" }}>
          <strong>{record.materialATitle}</strong>
          <span style={{ color: "var(--amber)", margin: "0 0.5rem" }}>+</span>
          <strong>{record.materialBTitle}</strong>
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
          {new Date(record.createdAt).toLocaleDateString("zh-CN")}
        </span>
      </button>
      {open && (
        <>
          <p
            style={{
              fontFamily: "var(--font-serif)",
              lineHeight: 1.85,
              marginTop: "var(--space-2)",
              whiteSpace: "pre-wrap",
              color: "var(--ink)",
              fontSize: "0.95rem",
            }}
          >
            {record.result}
          </p>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-2)" }}>
            {onInsert ? (
              <button
                className="btn-primary"
                style={{ padding: "0.3rem 0.8rem", fontSize: "0.85rem" }}
                onClick={() => {
                  onInsert(record.result);
                  onCloseDrawer();
                }}
              >
                作为灵感放进正文 →
              </button>
            ) : (
              <span />
            )}
            <button
              className="btn-ghost"
              style={{ color: "var(--danger)" }}
              disabled={pending}
              onClick={() => {
                if (!confirm("删除这次炼金记录？")) return;
                startTransition(async () => {
                  await deleteAlchemyAction(record.id);
                });
              }}
            >
              删除
            </button>
          </div>
        </>
      )}
    </div>
  );
}
