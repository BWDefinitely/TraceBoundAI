"use client";

import { useState } from "react";
import type { Material, Story, StorySlot } from "../../lib/store";
import { AlchemyWorkbench } from "./AlchemyWorkbench";

type SlotKey = "discovery" | "goal" | "accident" | "action" | "change";

const SLOT_LABELS: Record<SlotKey, string> = {
  discovery: "发现",
  goal: "目标",
  accident: "意外",
  action: "行动",
  change: "改变",
};

interface Props {
  slotKey: SlotKey;
  slotData: StorySlot;
  story: Story;
  materials: Material[];
  onClose: () => void;
}

// 场景灵感炼金面板：左侧显示当前场景卡片，中间是炼金工作台
export function SceneAlchemyPanel({ slotKey, slotData, story, materials, onClose }: Props) {
  const label = SLOT_LABELS[slotKey];
  
  // 获取关联的素材
  const linkedMaterials = materials.filter(m => slotData.linkedMaterials.includes(m.id));

  return (
    <div style={{ display: "flex", height: "calc(100vh - 180px)", gap: "var(--space-5)" }}>
      {/* 左侧：当前场景卡片 */}
      <div style={{ width: 350, flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "1.1rem", margin: 0 }}>当前场景</h3>
          <button 
            onClick={onClose}
            className="btn-secondary"
            style={{ fontSize: "0.85rem", padding: "6px 12px" }}
          >
            ← 返回整理
          </button>
        </div>

        <div className="card" style={{ padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)" }}>{label}</span>
          </div>

          {/* 已撰写的内容 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink-soft)" }}>已撰写内容</span>
            {slotData.text ? (
              <div 
                style={{ 
                  padding: "var(--space-3)", 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius)",
                  fontSize: "0.9rem",
                  lineHeight: 1.6,
                  maxHeight: 200,
                  overflowY: "auto"
                }}
              >
                {slotData.text}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: "0.85rem", padding: "var(--space-3)", background: "var(--surface)", borderRadius: "var(--radius)" }}>
                还没有内容
              </p>
            )}
          </div>

          {/* 已拖入的素材 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--ink-soft)" }}>
              关联素材 ({linkedMaterials.length})
            </span>
            {linkedMaterials.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 300, overflowY: "auto" }}>
                {linkedMaterials.map(m => (
                  <div 
                    key={m.id}
                    className="card"
                    style={{ 
                      padding: "var(--space-2)",
                      background: "var(--accent-wash)",
                      border: "1px solid var(--accent-soft)"
                    }}
                  >
                    <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
                      <span className="tag" style={{ fontSize: "0.65rem" }}>{m.kind}</span>
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, flex: 1 }}>{m.title}</span>
                    </div>
                    {m.iNoticed && (
                      <p style={{ fontSize: "0.75rem", marginTop: "var(--space-1)", color: "var(--ink-soft)", lineHeight: 1.4 }}>
                        {m.iNoticed.slice(0, 80)}{m.iNoticed.length > 80 ? "..." : ""}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: "0.85rem", padding: "var(--space-3)", background: "var(--surface)", borderRadius: "var(--radius)" }}>
                还没有关联素材
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 右侧：灵感炼金区 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-4)", overflowY: "auto" }}>
        <div className="card" style={{ padding: "var(--space-4)", background: "var(--accent-wash)" }}>
          <h3 style={{ fontSize: "1.2rem", margin: 0, marginBottom: "var(--space-2)" }}>
            💭 你想给「{label}」这个场景添加些什么？
          </h3>
          <p className="muted" style={{ fontSize: "0.9rem", lineHeight: 1.6 }}>
            使用下方的灵感工具，为这个场景生成新的创意素材，或者融合现有素材产生新想法。
          </p>
        </div>

        <AlchemyWorkbench materials={materials} />
      </div>
    </div>
  );
}
