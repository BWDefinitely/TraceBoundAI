"use client";

import { useMemo, useState, useTransition } from "react";
import type { AlchemyRecord, Material, IdeaOrigin, IdeaDecision } from "../../lib/store";
import { brewAction, createIdeaCardAction, deleteAlchemyAction } from "../_actions";
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
type BrewResult = { text: string; alchemyId: string; traceIds: [string, string]; relationship: string };

// 设计文档 §"两个线索可能是什么关系？"：
// 系统在合成前先让儿童选择关系方向，或自己描述。
const RELATIONSHIP_HINTS = [
  "一个是另一个的原因",
  "它们同时发生",
  "一个让角色误解另一个",
  "它们属于不同角色",
  "一个是线索，一个是结果",
];

export function AlchemyDrawer({ open, onClose, materials, history, providerLabel, handoff }: Props) {
  const [slotA, setSlotA] = useState<Material | null>(null);
  const [slotB, setSlotB] = useState<Material | null>(null);
  const [dragOver, setDragOver] = useState<Slot | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [result, setResult] = useState<BrewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<string>("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  }

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
    if (!relationship.trim()) {
      setError("先选择或写一句：两条素材可能是什么关系？");
      return;
    }
    setError(null);
    setResult(null);
    const rel = relationship.trim();
    startTransition(async () => {
      const res = await brewAction({ aId: slotA.id, bId: slotB.id, relationship: rel });
      if (res.ok) {
        setResult({
          text: res.record.result,
          alchemyId: res.record.id,
          traceIds: [slotA.id, slotB.id],
          relationship: rel,
        });
      } else {
        setError(res.message);
      }
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="灵感炼金"
      subtitle={`两份素材 → 一段联想 · 当前引擎：${providerLabel}`}
      color="accent"
      width={720}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <section
          className="card"
          style={{
            padding: "var(--space-5)",
            background: "linear-gradient(180deg, var(--accent-wash) 0%, var(--card) 55%)",
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
              style={{
                fontFamily: "var(--font-round)",
                fontSize: "1.8rem",
                color: "var(--accent)",
                fontWeight: 900,
                textShadow: "0 2px 8px rgba(124,99,231,0.25)",
              }}
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

          {slotA && slotB && !result && (
            <div
              style={{
                width: "100%",
                background: "var(--card)",
                border: "2px dashed var(--accent-soft)",
                borderRadius: "var(--radius)",
                padding: "var(--space-4)",
                display: "flex",
                flexDirection: "column",
                gap: "var(--space-2)",
              }}
            >
              <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--accent)" }}>
                🔗 两个线索可能是什么关系？
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
                在合成之前，先由你决定它们怎么连起来。AI 会顺着你的方向给一段联想，而不是替你想。
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.2rem" }}>
                {RELATIONSHIP_HINTS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setRelationship(h)}
                    aria-pressed={relationship === h}
                    className={relationship === h ? "btn-primary" : ""}
                    style={{
                      fontSize: "0.8rem",
                      padding: "0.35rem 0.85rem",
                    }}
                  >
                    {h}
                  </button>
                ))}
              </div>
              <textarea
                rows={2}
                placeholder="或者，用你自己的话描述这个关系……"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                style={{ marginTop: "0.3rem" }}
              />
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={onBrew}
              disabled={pending || !slotA || !slotB}
              style={{ fontSize: "1rem", padding: "0.75rem 1.8rem" }}
            >
              {pending ? "炼金中…" : "✨ 开始炼金"}
            </button>
            {error && <span style={{ fontSize: "0.9rem", color: "var(--danger)" }}>{error}</span>}
          </div>
        </section>

        {result && (
          <IdeaCardEditor
            key={result.alchemyId}
            result={result}
            onSaved={(msg) => {
              showToast(msg);
              setResult(null);
              setSlotA(null);
              setSlotB(null);
              setRelationship("");
            }}
          />
        )}

        {toast && (
          <div
            role="status"
            style={{
              position: "sticky",
              top: 0,
              padding: "0.55rem 1rem",
              background: "var(--accent-wash)",
              color: "var(--accent-2)",
              borderRadius: "var(--radius-pill)",
              fontSize: "0.9rem",
              fontWeight: 700,
              border: "1px solid var(--accent-soft)",
              textAlign: "center",
              boxShadow: "var(--shadow-1)",
            }}
          >
            {toast}
          </div>
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
                <HistoryItem key={h.id} record={h} onSavedAsIdea={showToast} />
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
          width: 180,
          minHeight: 112,
          borderRadius: "var(--radius-lg)",
          border: `2px dashed ${highlighted ? "var(--accent)" : "var(--accent-soft)"}`,
          background: highlighted ? "var(--accent-wash)" : "var(--card)",
          padding: "var(--space-3)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: empty ? "center" : "flex-start",
          textAlign: empty ? "center" : "left",
          transition: "all 0.15s ease",
          position: "relative",
          boxShadow: value ? "var(--shadow-1)" : "none",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: -10,
            left: 14,
            background: "var(--accent)",
            color: "white",
            padding: "2px 10px",
            borderRadius: "var(--radius-pill)",
            fontSize: "0.68rem",
            fontWeight: 800,
            letterSpacing: "0.1em",
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
<<<<<<< HEAD
            <stop offset="0" stopColor="#A692F0" stopOpacity={filled ? 0.95 : 0.4} />
            <stop offset="1" stopColor="#7C63E7" stopOpacity={filled ? 0.9 : 0.35} />
          </linearGradient>
          <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5A4BB0" />
            <stop offset="1" stopColor="#2E2255" />
          </linearGradient>
          <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#C9BEF5" stopOpacity="0.65" />
            <stop offset="1" stopColor="#C9BEF5" stopOpacity="0" />
=======
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
>>>>>>> f557910c8a72f17fd3d167d37a1e66e5deaf80cd
          </radialGradient>
          <radialGradient id="surfaceGlow" cx="0.5" cy="0.4" r="0.6">
            <stop offset="0" stopColor="#FFE9C2" stopOpacity={filled ? 0.9 : 0.2} />
            <stop offset="1" stopColor="#FFE9C2" stopOpacity="0" />
          </radialGradient>
        </defs>

<<<<<<< HEAD
        {filled && <circle cx="130" cy="110" r="96" fill="url(#glow)" />}
=======
        {/* 背景魔法光晕 */}
        <circle cx="170" cy="165" r="150" fill="url(#glow)" />
>>>>>>> f557910c8a72f17fd3d167d37a1e66e5deaf80cd

        {/* 旋转的魔法符文环 */}
        {filled && (
<<<<<<< HEAD
          <g opacity={working ? 0.95 : 0.6}>
            <path d="M100 50 Q108 30 100 12" stroke="#C9BEF5" strokeWidth="4" strokeLinecap="round" fill="none">
              {working && <animate attributeName="opacity" values="0.2;1;0.2" dur="2.2s" repeatCount="indefinite" />}
            </path>
            <path d="M130 44 Q140 26 132 6" stroke="#FCD79A" strokeWidth="4" strokeLinecap="round" fill="none">
              {working && <animate attributeName="opacity" values="0.4;1;0.4" dur="2.6s" repeatCount="indefinite" />}
            </path>
            <path d="M160 50 Q168 32 160 14" stroke="#B0E0C5" strokeWidth="4" strokeLinecap="round" fill="none">
              {working && <animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite" />}
=======
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
>>>>>>> f557910c8a72f17fd3d167d37a1e66e5deaf80cd
            </path>
          </g>
        )}

<<<<<<< HEAD
        <ellipse cx="130" cy="80" rx="90" ry="14" fill="#3A2E70" />
        <path d="M40 80 Q40 200 130 200 Q220 200 220 80 Z" fill="url(#body)" stroke="#241A48" strokeWidth="2" />
        <ellipse cx="130" cy="86" rx="82" ry="10" fill="url(#brew)" />
=======
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
>>>>>>> f557910c8a72f17fd3d167d37a1e66e5deaf80cd

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
<<<<<<< HEAD
            <circle cx="105" cy="86" r="3" fill="#FFFFFF" opacity="0.9">
              <animate attributeName="cy" values="86;74;86" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0;0.8" dur="1.8s" repeatCount="indefinite" />
            </circle>
            <circle cx="140" cy="86" r="2.5" fill="#FFFFFF" opacity="0.85">
              <animate attributeName="cy" values="86;70;86" dur="2.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0;0.7" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="155" cy="86" r="2" fill="#FFFFFF" opacity="0.85">
              <animate attributeName="cy" values="86;76;86" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="1.6s" repeatCount="indefinite" />
=======
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
>>>>>>> f557910c8a72f17fd3d167d37a1e66e5deaf80cd
            </circle>
          </>
        )}

<<<<<<< HEAD
        <rect x="70" y="200" width="12" height="14" rx="3" fill="#3A2E70" />
        <rect x="178" y="200" width="12" height="14" rx="3" fill="#3A2E70" />
        <path d="M96 214 Q104 200 112 214 Q108 208 104 214 Q100 208 96 214 Z" fill="#F5A623" opacity="0.9">
          {working && <animate attributeName="opacity" values="0.5;1;0.5" dur="0.9s" repeatCount="indefinite" />}
        </path>
        <path d="M148 214 Q156 200 164 214 Q160 208 156 214 Q152 208 148 214 Z" fill="#F5A623" opacity="0.9">
=======
        {/* 三足 */}
        <path d="M92 292 L80 312 L98 312 L106 292 Z" fill="#242A31" />
        <path d="M248 292 L260 312 L242 312 L234 292 Z" fill="#242A31" />
        <rect x="160" y="294" width="20" height="18" rx="4" fill="#242A31" />

        {/* 炉火 */}
        <path d="M120 314 Q132 288 144 314 Q138 302 132 314 Q126 302 120 314 Z" fill="#F0A44A" opacity="0.95">
          {working && <animate attributeName="opacity" values="0.5;1;0.5" dur="0.9s" repeatCount="indefinite" />}
        </path>
        <path d="M196 314 Q208 286 220 314 Q214 300 208 314 Q202 300 196 314 Z" fill="#F0A44A" opacity="0.95">
>>>>>>> f557910c8a72f17fd3d167d37a1e66e5deaf80cd
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
  onSavedAsIdea,
}: {
  record: AlchemyRecord;
  onSavedAsIdea: (msg: string) => void;
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
          <span style={{ color: "var(--accent)", margin: "0 0.5rem", fontWeight: 800 }}>+</span>
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
            <button
              className="btn-primary"
              style={{ padding: "0.3rem 0.8rem", fontSize: "0.85rem" }}
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await createIdeaCardAction({
                    content: record.result,
                    sourceKind: "ai-inspired",
                    sourceTraceIds: [record.materialAId, record.materialBId],
                    parentAlchemyId: record.id,
                  });
                  if (res.ok) onSavedAsIdea("已保存为 Idea Card");
                });
              }}
            >
              {pending ? "保存中…" : "保存为 Idea Card →"}
            </button>
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

// ---------- Idea Card 确认编辑器 ----------
// 设计文档 §9 Idea Card 的确认机制：
//   - 6 种「想法从哪里来」（origin）
//   - 4 种「我的决定」（decision）
//   - AI 建议不能一键插入正文，必须先经过孩子的确认
// origin 会自动依据孩子是否编辑过内容给出建议。

type SourceKind = "ai-inspired" | "child-edited" | "combined";

const ORIGIN_OPTIONS: Array<{ id: IdeaOrigin; label: string; hint: string }> = [
  { id: "pre-ai", label: "AI 出现前我已经想到", hint: "这是我原本就有的想法。" },
  { id: "trace-relook", label: "重新看素材后想到", hint: "重新看 / 听 trace 时冒出来的。" },
  { id: "ai-question", label: "AI 的问题启发了我", hint: "AI 问了一个我从没想过的问题。" },
  { id: "ai-direction", label: "我采用了 AI 的一个方向", hint: "AI 给的方向我觉得可用。" },
  { id: "ai-modified", label: "我改变了 AI 的建议", hint: "AI 说了 X，我改成了自己的样子。" },
  { id: "ai-combined", label: "我和 AI 的想法组合而成", hint: "各出一半，拼在一起。" },
];

const DECISION_OPTIONS: Array<{ id: IdeaDecision; label: string; color: string }> = [
  { id: "keep", label: "✓ 保留", color: "var(--green)" },
  { id: "refine", label: "✎ 继续修改", color: "var(--amber)" },
  { id: "shelve", label: "◔ 暂时放下", color: "var(--blue)" },
  { id: "discard", label: "✗ 删除", color: "var(--danger)" },
];

function originToSourceKind(origin: IdeaOrigin): SourceKind {
  if (origin === "pre-ai" || origin === "trace-relook") return "child-edited";
  if (origin === "ai-combined") return "combined";
  return "ai-inspired";
}

function IdeaCardEditor({
  result,
  onSaved,
}: {
  result: BrewResult;
  onSaved: (msg: string) => void;
}) {
  const [content, setContent] = useState(result.text);
  const [origin, setOrigin] = useState<IdeaOrigin>("ai-direction");
  const [decision, setDecision] = useState<IdeaDecision>("keep");
  const [pending, startTransition] = useTransition();

  const edited = content.trim() !== result.text.trim();
  // 建议：改动过 → ai-modified；未改动 → ai-direction
  const suggestedOrigin: IdeaOrigin = edited ? "ai-modified" : "ai-direction";

  return (
    <section
      className="card fade-in"
      style={{
        padding: "var(--space-5)",
        background: "linear-gradient(180deg, var(--accent-wash) 0%, #FFFFFF 60%)",
        borderColor: "var(--accent-soft)",
        borderWidth: 2,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
        <span
          className="icon-chip icon-chip-accent"
          style={{ width: 32, height: 32, fontSize: "0.95rem" }}
          aria-hidden
        >
          ✦
        </span>
        <div style={{ fontWeight: 800, color: "var(--accent-2)", fontSize: "1.05rem" }}>
          炼金火花 · 编辑并保存为 Idea Card
        </div>
      </div>

      {result.relationship && (
        <div
          style={{
            fontSize: "0.85rem",
            color: "var(--ink-soft)",
            marginBottom: "var(--space-3)",
            padding: "0.55rem 0.9rem",
            background: "var(--card)",
            border: "1px dashed var(--accent-soft)",
            borderRadius: "var(--radius-pill)",
          }}
        >
          🔗 你决定的关系：<span style={{ color: "var(--accent-2)", fontWeight: 700 }}>{result.relationship}</span>
        </div>
      )}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={6}
        style={{
          fontFamily: "var(--font-round)",
          fontSize: "1rem",
          lineHeight: 1.85,
          background: "var(--card)",
          border: "1.5px solid var(--accent-soft)",
        }}
      />

      <div style={{ marginTop: "var(--space-4)" }}>
        <div style={{ fontSize: "0.85rem", color: "var(--ink)", fontWeight: 700, marginBottom: "0.5rem" }}>
          这个想法是怎么产生的？
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {ORIGIN_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setOrigin(o.id)}
              aria-pressed={origin === o.id}
              title={o.hint}
              className={origin === o.id ? "btn-primary" : ""}
              style={{ padding: "0.35rem 0.8rem", fontSize: "0.78rem" }}
            >
              {o.label}
              {suggestedOrigin === o.id && origin !== o.id && (
                <span style={{ marginLeft: 4, fontSize: "0.68rem", opacity: 0.7 }}>· 建议</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginTop: "var(--space-4)" }}>
        <div style={{ fontSize: "0.85rem", color: "var(--ink)", fontWeight: 700, marginBottom: "0.5rem" }}>
          我对这张 Idea Card 的决定：
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {DECISION_OPTIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDecision(d.id)}
              aria-pressed={decision === d.id}
              style={{
                padding: "0.4rem 1rem",
                fontSize: "0.85rem",
                fontWeight: 700,
                background: decision === d.id ? d.color : "var(--card)",
                color: decision === d.id ? "white" : d.color,
                border: `1.5px solid ${d.color}`,
                borderRadius: "var(--radius-pill)",
                boxShadow: decision === d.id ? "var(--shadow-1)" : "none",
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--space-2)",
          marginTop: "var(--space-5)",
        }}
      >
        <button
          className="btn-primary"
          disabled={pending || !content.trim() || decision === "discard"}
          onClick={() =>
            startTransition(async () => {
              const res = await createIdeaCardAction({
                content: content.trim(),
                sourceKind: originToSourceKind(origin),
                origin,
                decision,
                relationship: result.relationship,
                sourceTraceIds: [...result.traceIds],
                parentAlchemyId: result.alchemyId,
              });
              if (res.ok) {
                if (decision === "shelve") onSaved("已放入 Idea Card 抽屉，暂时放下");
                else onSaved("已保存为 Idea Card，可在故事编辑器右侧看到");
              }
            })
          }
        >
          {pending
            ? "保存中…"
            : decision === "discard"
              ? "已选择删除"
              : decision === "shelve"
                ? "暂时放下"
                : decision === "refine"
                  ? "保存为进一步修改"
                  : "确认并保存为 Idea Card"}
        </button>
      </div>
    </section>
  );
}

