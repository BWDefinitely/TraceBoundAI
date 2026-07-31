"use client";

import { useState, useEffect } from "react";
import type { Material, Story, StoryStructure } from "../../lib/store";
import { saveStoryAction } from "../_actions";
import { getMediaBlob } from "../../lib/client-store";

type SlotKey = "qi" | "cheng" | "zhuan" | "he";
const SLOTS: { key: SlotKey; label: string; desc: string }[] = [
  { key: "qi", label: "起", desc: "故事的开头" },
  { key: "cheng", label: "承", desc: "事情的发展" },
  { key: "zhuan", label: "转", desc: "意外或转折" },
  { key: "he", label: "合", desc: "故事的结局" },
];

const MATERIALS_PER_PAGE = 20;

// 素材整理：左侧素材库（可拖拽），右侧故事线起承转合（可放置素材缩略图）
export function StorylineOrganizer({ materials, story }: { materials: Material[]; story: Story }) {
  const [structure, setStructure] = useState<StoryStructure>(story.structure);
  const [dragId, setDragId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(MATERIALS_PER_PAGE);

  const visibleMaterials = materials.slice(0, displayCount);
  const hasMore = displayCount < materials.length;

  function loadMore() {
    setDisplayCount(prev => Math.min(prev + MATERIALS_PER_PAGE, materials.length));
  }

  async function persist(next: StoryStructure) {
    setStructure(next);
    await saveStoryAction(story.id, { structure: next });
  }

  function handleDrop(slotKey: SlotKey) {
    if (!dragId) return;
    const slot = structure[slotKey];
    if (slot.linkedMaterials.includes(dragId)) {
      setDragId(null);
      return;
    }
    const next: StoryStructure = {
      ...structure,
      [slotKey]: { ...slot, linkedMaterials: [...slot.linkedMaterials, dragId] },
    };
    persist(next);
    setDragId(null);
  }

  function removeMaterial(slotKey: SlotKey, materialId: string) {
    const slot = structure[slotKey];
    const next: StoryStructure = {
      ...structure,
      [slotKey]: { ...slot, linkedMaterials: slot.linkedMaterials.filter((id) => id !== materialId) },
    };
    persist(next);
  }

  function updateSlotText(slotKey: SlotKey, text: string) {
    const next: StoryStructure = { ...structure, [slotKey]: { ...structure[slotKey], text } };
    setStructure(next);
  }

  function materialById(id: string) {
    return materials.find((m) => m.id === id);
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "var(--space-6)" }}>
      {/* 左侧素材库 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <h3 style={{ fontSize: "1.05rem", margin: 0 }}>素材库</h3>
        <p className="muted" style={{ fontSize: "0.8rem" }}>拖动素材到右侧的起承转合格子里</p>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: "68vh", overflowY: "auto" }}>
          {materials.length === 0 ? (
            <div className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
              <p className="muted" style={{ fontSize: "0.85rem" }}>还没有素材</p>
            </div>
          ) : (
            <>
              {visibleMaterials.map((m) => (
                <DraggableMaterialCard 
                  key={m.id} 
                  material={m} 
                  isDragging={dragId === m.id}
                  onDragStart={() => setDragId(m.id)}
                  onDragEnd={() => setDragId(null)}
                />
              ))}
              {hasMore && (
                <button 
                  onClick={loadMore}
                  className="btn-secondary"
                  style={{ fontSize: "0.85rem", padding: "var(--space-2)" }}
                >
                  加载更多 ({materials.length - displayCount} 项)
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 右侧故事线 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {/* 元数据参考 */}
        <div className="card" style={{ padding: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)", fontSize: "0.82rem", color: "var(--ink-soft)" }}>
          <span>📅 {story.metadata.time || "—"}</span>
          <span>📍 {story.metadata.place || "—"}</span>
          <span>👤 {story.metadata.people.join("、") || "—"}</span>
          <span>⚡ {story.metadata.event || "—"}</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--space-4)" }}>
          {SLOTS.map((slot) => {
            const s = structure[slot.key];
            return (
              <div
                key={slot.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(slot.key)}
                className="card"
                style={{
                  padding: "var(--space-4)",
                  minHeight: 180,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                  border: dragId ? "2px dashed var(--accent)" : "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
                  <span style={{ fontSize: "1.3rem", fontWeight: 700, fontFamily: "var(--font-serif)", color: "var(--accent)" }}>{slot.label}</span>
                  <span style={{ fontSize: "0.78rem", color: "var(--ink-soft)" }}>{slot.desc}</span>
                </div>

                <textarea
                  value={s.text}
                  onChange={(e) => updateSlotText(slot.key, e.target.value)}
                  onBlur={() => persist(structure)}
                  placeholder="写一句话..."
                  style={{ minHeight: 50, resize: "vertical", fontSize: "0.85rem" }}
                />

                {/* 素材缩略图 */}
                {s.linkedMaterials.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {s.linkedMaterials.map((id) => {
                      const m = materialById(id);
                      return (
                        <div
                          key={id}
                          title={m?.title}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            background: "var(--accent-wash)",
                            border: "1px solid var(--accent-soft)",
                            borderRadius: "var(--radius-sm)",
                            fontSize: "0.75rem",
                          }}
                        >
                          🖼 {m?.title?.slice(0, 8) ?? "素材"}
                          <button
                            onClick={() => removeMaterial(slot.key, id)}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-soft)", padding: 0 }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// 可拖拽的素材卡片，带缩略图
function DraggableMaterialCard({ 
  material, 
  isDragging, 
  onDragStart, 
  onDragEnd 
}: { 
  material: Material; 
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    if (material.mediaKind === 'photo') {
      let url: string | null = null;
      getMediaBlob(material.id).then((blob) => {
        if (blob) {
          url = URL.createObjectURL(blob);
          setImageUrl(url);
        }
      });
      return () => {
        if (url) URL.revokeObjectURL(url);
      };
    }
  }, [material.id, material.mediaKind]);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="card"
      style={{ 
        padding: "var(--space-3)", 
        cursor: "grab", 
        opacity: isDragging ? 0.5 : 1 
      }}
    >
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}>
        {imageUrl && (
          <div style={{ 
            width: 60, 
            height: 60, 
            flexShrink: 0,
            borderRadius: "var(--radius-sm)", 
            overflow: "hidden",
            background: "var(--surface)"
          }}>
            <img 
              src={imageUrl} 
              alt={material.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="tag" style={{ fontSize: "0.7rem" }}>{material.kind}</span>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis" }}>
            {material.title}
          </div>
          {material.tags && material.tags.length > 0 && (
            <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {material.tags.slice(0, 3).map((tag, i) => (
                <span key={i} style={{ fontSize: "0.7rem", color: "var(--ink-soft)" }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
