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
        width: 340,
        height: 320,
        maxWidth: "100%",
        position: "relative",
        display: "grid",
        placeItems: "center",
        animation: working ? "cauldronPulse 1.6s ease-in-out infinite" : undefined,
        borderRadius: "50%",
      }}
    >
      <svg viewBox="0 0 340 320" width="100%" height="100%" role="img" aria-label="炼金釜">
        <defs>
          {/* 液体：琥珀 → 薄荷 */}
          <linearGradient id="brew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#F0A44A" stopOpacity={filled ? 0.95 : 0.4} />
            <stop offset="0.5" stopColor="#C97A2B" stopOpacity={filled ? 0.9 : 0.35} />
            <stop offset="1" stopColor="#2F7A6B" stopOpacity={filled ? 0.9 : 0.3} />
          </linearGradient>
          {/* 釜身金属 */}
          <linearGradient id="body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4A5158" />
            <stop offset="0.5" stopColor="#2A3036" />
            <stop offset="1" stopColor="#171B1F" />
          </linearGradient>
          {/* 釜身左侧高光 */}
          <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#7C858D" stopOpacity="0.9" />
            <stop offset="0.35" stopColor="#7C858D" stopOpacity="0" />
          </linearGradient>
          {/* 装饰金带 */}
          <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E8B871" />
            <stop offset="1" stopColor="#B07A2E" />
          </linearGradient>
          <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#F5C97D" stopOpacity={working ? 0.7 : 0.45} />
            <stop offset="0.6" stopColor="#F0A44A" stopOpacity="0.15" />
            <stop offset="1" stopColor="#F5C97D" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="surfaceGlow" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#FFE9C2" stopOpacity={filled ? 0.9 : 0.2} />
            <stop offset="1" stopColor="#FFE9C2" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 背景魔法光晕 */}
        <circle cx="170" cy="165" r="150" fill="url(#glow)" />

        {/* 旋转的魔法符文环 */}
        {filled && (
          <g opacity={working ? 0.85 : 0.4} style={{ transformOrigin: "170px 175px" }}>
            {working && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 170 175"
                to="360 170 175"
                dur="14s"
                repeatCount="indefinite"
              />
            )}
            <circle
              cx="170"
              cy="175"
              r="128"
              fill="none"
              stroke="#B4DDD1"
              strokeWidth="1.5"
              strokeDasharray="2 12"
              opacity="0.7"
            />
            {[0, 60, 120, 180, 240, 300].map((deg) => {
              const rad = (deg * Math.PI) / 180;
              const cx = 170 + 128 * Math.cos(rad);
              const cy = 175 + 128 * Math.sin(rad);
              return (
                <g key={deg} transform={`translate(${cx} ${cy})`}>
                  <path
                    d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z"
                    fill={deg % 120 === 0 ? "#F1D6A9" : "#B4DDD1"}
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* 蒸汽 */}
        {filled && (
          <g opacity={working ? 0.95 : 0.5}>
            <path d="M128 118 Q140 88 128 60 Q118 38 128 14" stroke="#B4DDD1" strokeWidth="5" strokeLinecap="round" fill="none">
              {working && <animate attributeName="opacity" values="0.15;1;0.15" dur="2.4s" repeatCount="indefinite" />}
            </path>
            <path d="M170 112 Q184 80 170 48 Q160 24 172 2" stroke="#F1D6A9" strokeWidth="5" strokeLinecap="round" fill="none">
              {working && <animate attributeName="opacity" values="0.4;1;0.4" dur="2.9s" repeatCount="indefinite" />}
            </path>
            <path d="M212 118 Q224 90 212 62 Q202 40 212 18" stroke="#B4DDD1" strokeWidth="5" strokeLinecap="round" fill="none">
              {working && <animate attributeName="opacity" values="0.25;1;0.25" dur="2.0s" repeatCount="indefinite" />}
            </path>
          </g>
        )}

        {/* 漂浮星尘 */}
        {filled && working && (
          <g>
            {[
              { x: 96, y: 70, d: "3.2s" },
              { x: 244, y: 84, d: "3.8s" },
              { x: 120, y: 44, d: "4.4s" },
              { x: 226, y: 52, d: "3.4s" },
            ].map((s, i) => (
              <g key={i} transform={`translate(${s.x} ${s.y})`}>
                <path d="M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4 Z" fill="#FFE9C2">
                  <animate attributeName="opacity" values="0;1;0" dur={s.d} repeatCount="indefinite" />
                </path>
              </g>
            ))}
          </g>
        )}

        {/* 锅耳 */}
        <ellipse cx="66" cy="150" rx="16" ry="22" fill="none" stroke="#2A3036" strokeWidth="9" />
        <ellipse cx="274" cy="150" rx="16" ry="22" fill="none" stroke="#2A3036" strokeWidth="9" />

        {/* 釜口 */}
        <ellipse cx="170" cy="132" rx="118" ry="20" fill="#1B2025" />
        <ellipse cx="170" cy="132" rx="118" ry="20" fill="none" stroke="url(#band)" strokeWidth="4" />

        {/* 釜身 */}
        <path d="M56 132 Q52 296 170 296 Q288 296 284 132 Z" fill="url(#body)" stroke="#0F1316" strokeWidth="2.5" />
        {/* 左侧金属高光 */}
        <path d="M56 132 Q52 296 170 296 Q288 296 284 132 Z" fill="url(#shine)" />
        {/* 装饰金带 */}
        <path d="M62 178 Q170 200 278 178" fill="none" stroke="url(#band)" strokeWidth="7" strokeLinecap="round" />

        {/* 液体表面 */}
        <ellipse cx="170" cy="138" rx="108" ry="14" fill="url(#brew)" />
        <ellipse cx="170" cy="136" rx="90" ry="9" fill="url(#surfaceGlow)" />

        {/* 冒泡 */}
        {filled && working && (
          <>
            <circle cx="132" cy="138" r="4.5" fill="#FBEFD6" opacity="0.9">
              <animate attributeName="cy" values="138;120;138" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.9;0;0.9" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx="182" cy="138" r="3.6" fill="#FBEFD6" opacity="0.9">
              <animate attributeName="cy" values="138;112;138" dur="2.3s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0;0.8" dur="2.3s" repeatCount="indefinite" />
            </circle>
            <circle cx="206" cy="138" r="3" fill="#FBEFD6" opacity="0.9">
              <animate attributeName="cy" values="138;122;138" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="1.6s" repeatCount="indefinite" />
            </circle>
          </>
        )}

        {/* 三足 */}
        <path d="M92 292 L80 312 L98 312 L106 292 Z" fill="#242A31" />
        <path d="M248 292 L260 312 L242 312 L234 292 Z" fill="#242A31" />
        <rect x="160" y="294" width="20" height="18" rx="4" fill="#242A31" />

        {/* 炉火 */}
        <path d="M120 314 Q132 288 144 314 Q138 302 132 314 Q126 302 120 314 Z" fill="#F0A44A" opacity="0.95">
          {working && <animate attributeName="opacity" values="0.5;1;0.5" dur="0.9s" repeatCount="indefinite" />}
        </path>
        <path d="M196 314 Q208 286 220 314 Q214 300 208 314 Q202 300 196 314 Z" fill="#F0A44A" opacity="0.95">
          {working && <animate attributeName="opacity" values="0.7;1;0.7" dur="1.1s" repeatCount="indefinite" />}
        </path>
        <path d="M158 316 Q170 296 182 316 Q176 304 170 316 Q164 304 158 316 Z" fill="#FFE9C2" opacity="0.9">
          {working && <animate attributeName="opacity" values="0.6;1;0.6" dur="0.8s" repeatCount="indefinite" />}
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
