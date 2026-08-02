"use client";

import { useState, useEffect } from "react";
import type { Material, Story, StoryStructure } from "../../lib/store";
import { saveStoryAction } from "../_actions";
import { getMediaBlob } from "../../lib/client-store";
import { MaterialDetailModal } from "./MaterialDetailModal";
import { AlchemyWorkbench } from "./AlchemyWorkbench";

type SlotKey = "discovery" | "goal" | "accident" | "action" | "change";
const SLOTS: { key: SlotKey; label: string; desc: string }[] = [
  { key: "discovery", label: "发现", desc: "主角发现了什么" },
  { key: "goal", label: "目标", desc: "主角想要什么" },
  { key: "accident", label: "意外", desc: "遇到了什么困难" },
  { key: "action", label: "行动", desc: "主角如何应对" },
  { key: "change", label: "改变", desc: "最后有什么变化" },
];

const MATERIALS_PER_PAGE = 20;

interface Props {
  materials: Material[];
  story: Story;
  onThinkMore?: (slotKey: SlotKey) => void;
}

// 素材整理：左侧素材库（纵向），右侧场景列表（纵向滚动）
export function StorylineOrganizer({ materials, story, onThinkMore }: Props) {
  const [structure, setStructure] = useState<StoryStructure>(story.structure);
  const [dragId, setDragId] = useState<string | null>(null);
  const [displayCount, setDisplayCount] = useState(MATERIALS_PER_PAGE);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [showAlchemy, setShowAlchemy] = useState(false);

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

  function canThinkMore(slotKey: SlotKey): boolean {
    const slot = structure[slotKey];
    // 必须有内容才能点击想更多
    return (slot.text?.trim().length ?? 0) > 0;
  }

  return (
    <div style={{ display: "flex", gap: "var(--space-5)", height: "calc(100vh - 250px)" }}>
      {/* 左侧：素材库 */}
      <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "1.05rem", margin: 0 }}>素材库</h3>
          <button
            onClick={() => setShowAlchemy(!showAlchemy)}
            className="btn-secondary"
            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
          >
            {showAlchemy ? "✕ 关闭" : "⚗️ 素材炼金"}
          </button>
        </div>
        
        {showAlchemy ? (
          <div style={{ flex: 1, overflowY: "auto" }}>
            <AlchemyWorkbench materials={materials} />
          </div>
        ) : (
          <>
            <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
              拖动素材到右侧场景卡片中
            </p>

            <div style={{ 
              flex: 1, 
              display: "flex", 
              flexDirection: "column", 
              gap: "var(--space-2)", 
              overflowY: "auto",
              paddingRight: "var(--space-2)"
            }}>
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
                      onClick={() => setSelectedMaterial(m)}
                    />
                  ))}
                  {hasMore && (
                    <button 
                      onClick={loadMore}
                      className="btn-secondary"
                      style={{ fontSize: "0.8rem", padding: "var(--space-2)" }}
                    >
                      加载更多 ({materials.length - displayCount})
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* 右侧：场景列表（纵向滚动） */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {/* 元数据参考 */}
        <div className="card" style={{ padding: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-3)", fontSize: "0.82rem", color: "var(--ink-soft)" }}>
          <span>📅 {story.metadata.time || "—"}</span>
          <span>📍 {story.metadata.place || "—"}</span>
          <span>👤 {story.metadata.people.join("、") || "—"}</span>
          <span>⚡ {story.metadata.event || "—"}</span>
        </div>

        {/* 纵向滚动的场景列表 */}
        <div 
          style={{ 
            flex: 1,
            display: "flex", 
            flexDirection: "column",
            gap: "var(--space-4)", 
            overflowY: "auto",
            paddingRight: "var(--space-2)"
          }}
        >
          {SLOTS.map((slot) => {
            const s = structure[slot.key];
            const canClick = canThinkMore(slot.key);
            return (
              <div
                key={slot.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(slot.key)}
                className="card"
                style={{
                  padding: "var(--space-4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                  border: dragId ? "2px dashed var(--accent)" : "1px solid var(--line)",
                }}
              >
                {/* 场景标题和"想更多"按钮 */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
                    <span style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent)" }}>{slot.label}</span>
                    <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>{slot.desc}</span>
                  </div>
                  {onThinkMore && (
                    <button
                      onClick={() => canClick && onThinkMore(slot.key)}
                      className="btn-secondary"
                      disabled={!canClick}
                      style={{
                        fontSize: "0.8rem",
                        padding: "6px 12px",
                        whiteSpace: "nowrap",
                        opacity: canClick ? 1 : 0.4,
                        cursor: canClick ? "pointer" : "not-allowed",
                      }}
                      title={!canClick ? "请先填写内容后才能点击" : undefined}
                    >
                      💭 想更多
                    </button>
                  )}
                </div>

                {/* 大号文本输入框 */}
                <textarea
                  value={s.text}
                  onChange={(e) => updateSlotText(slot.key, e.target.value)}
                  onBlur={() => persist(structure)}
                  placeholder={`在这里描述「${slot.label}」的内容...`}
                  style={{ 
                    minHeight: 120, 
                    resize: "vertical", 
                    fontSize: "0.9rem",
                    lineHeight: 1.6
                  }}
                />

                {/* 素材缩略图 */}
                {s.linkedMaterials.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)", fontWeight: 600 }}>
                      关联素材 ({s.linkedMaterials.length})
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                      {s.linkedMaterials.map((id) => {
                        const m = materialById(id);
                        return (
                          <LinkedMaterialChip
                            key={id}
                            material={m}
                            onRemove={() => removeMaterial(slot.key, id)}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 素材详情弹窗 */}
      {selectedMaterial && (
        <MaterialDetailModal
          material={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
        />
      )}
    </div>
  );
}

// 关联素材的小芯片
function LinkedMaterialChip({ material, onRemove }: { material: Material | undefined; onRemove: () => void }) {
  return (
    <div
      title={material?.title}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        background: "var(--accent-wash)",
        border: "1px solid var(--accent-soft)",
        borderRadius: "var(--radius)",
        fontSize: "0.8rem",
      }}
    >
      <span className="tag" style={{ fontSize: "0.65rem", margin: 0 }}>{material?.kind}</span>
      <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {material?.title ?? "素材"}
      </span>
      <button
        onClick={onRemove}
        style={{ 
          background: "none", 
          border: "none", 
          cursor: "pointer", 
          color: "var(--ink-soft)", 
          padding: 0,
          fontSize: "1.1rem",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

// 可拖拽的素材卡片，带缩略图
function DraggableMaterialCard({ 
  material, 
  isDragging, 
  onDragStart, 
  onDragEnd,
  onClick 
}: { 
  material: Material; 
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
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
      onClick={onClick}
      className="card"
      style={{ 
        padding: "var(--space-3)", 
        cursor: isDragging ? "grabbing" : "pointer", 
        opacity: isDragging ? 0.5 : 1,
        transition: "opacity 0.2s ease, transform 0.2s ease",
      }}
      onMouseEnter={(e) => !isDragging && (e.currentTarget.style.transform = "translateY(-2px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
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
          <div style={{ 
            fontSize: "0.9rem", 
            fontWeight: 600, 
            marginTop: 4, 
            overflow: "hidden", 
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical"
          }}>
            {material.title}
          </div>
        </div>
      </div>
    </div>
  );
}
