"use client";

import { useState, useEffect } from "react";
import type { Story } from "../../lib/store";
import { useData } from "./DataProvider";
import { getMediaBlob } from "../../lib/client-store";

interface Props {
  story: Story;
  open: boolean;
  onClose: () => void;
}

// 故事线抽屉：从左侧弹出，展示继承自前面步骤的元数据和起承转合（只读参考）。
export function StorylineDrawer({ story, open, onClose }: Props) {
  const { materials } = useData();
  const [hoverMaterialId, setHoverMaterialId] = useState<string | null>(null);
  const [hoverImageUrl, setHoverImageUrl] = useState<string | null>(null);

  // 加载 hover 素材的图片
  useEffect(() => {
    if (!hoverMaterialId) {
      setHoverImageUrl(null);
      return;
    }
    const mat = materials.find((m) => m.id === hoverMaterialId);
    if (!mat || mat.mediaKind !== "photo") {
      setHoverImageUrl(null);
      return;
    }
    let url: string | null = null;
    (async () => {
      const blob = await getMediaBlob(mat.id);
      if (blob) {
        url = URL.createObjectURL(blob);
        setHoverImageUrl(url);
      }
    })();
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [hoverMaterialId, materials]);

  const meta = story.metadata;
  const structure = story.structure;

  if (!open) return null;

  return (
    <>
      {/* 遮罩 */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }}
      />
      {/* 抽屉 */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          bottom: 0,
          width: 360,
          maxWidth: "85vw",
          background: "white",
          boxShadow: "2px 0 16px rgba(0,0,0,0.15)",
          zIndex: 41,
          padding: "var(--space-5)",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-5)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1.15rem" }}>📋 故事线</h3>
          <button onClick={onClose} className="btn-secondary" style={{ padding: "4px 12px" }}>关闭</button>
        </div>

        {/* 元数据 */}
        <section>
          <h4 style={{ fontSize: "0.9rem", color: "var(--ink-soft)", marginBottom: "var(--space-2)" }}>故事要素</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "0.9rem" }}>
            <div>📅 时间：{meta.time || "—"}</div>
            <div>📍 地点：{meta.place || "—"}</div>
            <div>👤 人物：{meta.people.length ? meta.people.join("、") : "—"}</div>
            <div>⚡ 事件：{meta.event || "—"}</div>
          </div>
        </section>

        {/* 五场景结构 */}
        <section>
          <h4 style={{ fontSize: "0.9rem", color: "var(--ink-soft)", marginBottom: "var(--space-2)" }}>场景结构</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
            {(["discovery", "goal", "accident", "action", "change"] as const).map((slotKey, idx) => {
              const slotData = structure[slotKey];
              const labels = ["发现", "目标", "意外", "行动", "改变"];
              return (
                <div
                  key={slotKey}
                  className="card"
                  style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: 700, color: "var(--accent)" }}>
                      {labels[idx]}
                    </span>
                    {slotData.linkedMaterials.length > 0 && (
                      <span className="tag" style={{ fontSize: "0.7rem" }}>🖼 {slotData.linkedMaterials.length}</span>
                    )}
                  </div>
                  <div style={{ fontSize: "0.85rem", color: slotData.text ? "var(--ink)" : "var(--ink-soft)" }}>
                    {slotData.text || "（还没填）"}
                  </div>

                  {/* 素材缩略图 */}
                  {slotData.linkedMaterials.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                      {slotData.linkedMaterials.map((id) => {
                        const m = materials.find((mat) => mat.id === id);
                        return (
                          <div
                            key={id}
                            title={m?.title}
                            onMouseEnter={() => setHoverMaterialId(id)}
                            onMouseLeave={() => setHoverMaterialId(null)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "2px 8px",
                              background: "var(--accent-wash)",
                              border: "1px solid var(--accent-soft)",
                              borderRadius: "var(--radius-sm)",
                              fontSize: "0.75rem",
                              cursor: "pointer",
                            }}
                          >
                            🖼 {m?.title?.slice(0, 8) ?? "素材"}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* 悬浮预览 */}
        {hoverImageUrl && (
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "420px",
              transform: "translateY(-50%)",
              maxWidth: 300,
              maxHeight: 300,
              background: "white",
              border: "2px solid var(--accent)",
              borderRadius: "var(--radius)",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
              overflow: "hidden",
              pointerEvents: "none",
              zIndex: 50,
            }}
          >
            <img src={hoverImageUrl} alt="素材预览" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
        )}
      </div>
    </>
  );
}
