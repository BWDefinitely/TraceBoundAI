"use client";

import { useEffect, useState } from "react";
import type { Material } from "../../lib/store";
import { getMediaBlob } from "../../lib/client-store";

interface Props {
  material: Material;
  onClose: () => void;
}

export function MaterialDetailModal({ material, onClose }: Props) {
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
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "var(--space-4)",
      }}
      onClick={onClose}
    >
      <div 
        className="card"
        style={{
          maxWidth: 600,
          width: "100%",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "var(--space-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 关闭按钮 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.4rem", margin: 0, marginBottom: "var(--space-1)" }}>
              {material.title}
            </h2>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              <span className="tag">{material.kind}</span>
              <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                {new Date(material.createdAt).toLocaleDateString('zh-CN')}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              color: "var(--ink-soft)",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 图片预览 */}
        {imageUrl && (
          <div style={{ 
            width: "100%", 
            maxHeight: 300,
            borderRadius: "var(--radius)", 
            overflow: "hidden",
            background: "var(--surface)"
          }}>
            <img 
              src={imageUrl} 
              alt={material.title}
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
        )}

        {/* 我为什么拍它 / 我注意到 */}
        {material.iNoticed && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0, color: "var(--accent)" }}>
              我为什么拍它
            </h3>
            <p style={{ 
              fontSize: "0.9rem", 
              lineHeight: 1.7, 
              margin: 0,
              padding: "var(--space-3)",
              background: "var(--surface)",
              borderRadius: "var(--radius)",
            }}>
              {material.iNoticed}
            </p>
          </div>
        )}

        {/* 我的想法 / 它让我想到 */}
        {material.itRemindsMe && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0, color: "var(--accent)" }}>
              我的想法
            </h3>
            <p style={{ 
              fontSize: "0.9rem", 
              lineHeight: 1.7, 
              margin: 0,
              padding: "var(--space-3)",
              background: "var(--surface)",
              borderRadius: "var(--radius)",
            }}>
              {material.itRemindsMe}
            </p>
          </div>
        )}

        {/* 标签 */}
        {material.tags && material.tags.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <h3 style={{ fontSize: "0.95rem", fontWeight: 600, margin: 0, color: "var(--ink-soft)" }}>
              标签
            </h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
              {material.tags.map((tag, i) => (
                <span 
                  key={i}
                  style={{
                    fontSize: "0.8rem",
                    padding: "4px 10px",
                    background: "var(--accent-wash)",
                    border: "1px solid var(--accent-soft)",
                    borderRadius: "var(--radius-sm)",
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
