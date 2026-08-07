"use client";

import { useEffect, useState } from "react";
import type { Material, MaterialKind } from "../../lib/store";
import { getMediaBlob } from "../../lib/client-store";
import { updateMaterialAction, deleteMaterialAction } from "../_actions";

const KINDS: MaterialKind[] = ["观察", "想法", "时间", "地点", "人物", "物品"];

interface Props {
  material: Material;
  onClose: () => void;
}

// 素材详情弹窗：可编辑标题 / 类型 / 素材描述 / 三问，保存后同步更新素材库
export function MaterialDetailModal({ material, onClose }: Props) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [title, setTitle] = useState(material.title);
  const [kind, setKind] = useState<MaterialKind>(material.kind);
  const [description, setDescription] = useState(material.description ?? "");
  const [iNoticed, setINoticed] = useState(material.iNoticed);
  const [itRemindsMe, setItRemindsMe] = useState(material.itRemindsMe);
  const [stillUnsure, setStillUnsure] = useState(material.stillUnsure);
  const [saving, setSaving] = useState(false);
  const [zoomed, setZoomed] = useState(false);

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

  async function handleSave() {
    setSaving(true);
    try {
      await updateMaterialAction(material.id, {
        title: title.trim() || "未命名素材",
        kind,
        description,
        iNoticed,
        itRemindsMe,
        stillUnsure,
      });
      onClose();
    } catch (err) {
      console.error("保存素材失败:", err);
      alert("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`确定删除「${material.title}」吗？删除后无法恢复。`)) return;
    setSaving(true);
    try {
      await deleteMaterialAction(material.id);
      onClose();
    } catch (err) {
      console.error("删除素材失败:", err);
      alert("删除失败，请重试");
    } finally {
      setSaving(false);
    }
  }

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
          maxWidth: 620,
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
        {/* 头部 */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2 style={{ fontSize: "1.4rem", margin: 0, marginBottom: "var(--space-1)" }}>
              ✏️ 编辑素材
            </h2>
            <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
              修改会同步保存到素材库
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="关闭对话框"
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

        {/* 素材预览 */}
        {material.mediaKind === 'photo' && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>素材图片</span>
            {imageUrl ? (
              <div
                style={{
                  width: "100%",
                  minHeight: 200,
                  maxHeight: 360,
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                  background: "var(--surface)",
                  cursor: "zoom-in",
                  position: "relative",
                  border: "1px solid var(--border)",
                }}
                onClick={() => setZoomed(true)}
              >
                <img
                  src={imageUrl}
                  alt={material.title}
                  style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                />
                <span
                  style={{
                    position: "absolute",
                    bottom: 8,
                    right: 8,
                    fontSize: "0.75rem",
                    background: "rgba(0,0,0,0.7)",
                    color: "white",
                    borderRadius: "var(--radius-pill)",
                    padding: "4px 12px",
                  }}
                >
                  🔍 点击查看大图
                </span>
              </div>
            ) : (
              <div
                style={{
                  width: "100%",
                  height: 200,
                  borderRadius: "var(--radius)",
                  background: "var(--surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "1px solid var(--border)",
                }}
              >
                <p className="muted" style={{ fontSize: "0.9rem" }}>加载图片中...</p>
              </div>
            )}
          </div>
        )}

        {/* 大图预览（lightbox） */}
        {zoomed && imageUrl && (
          <div
            onClick={() => setZoomed(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              zIndex: 2000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "zoom-out",
              padding: "var(--space-4)",
            }}
          >
            <img
              src={imageUrl}
              alt={material.title}
              style={{ maxWidth: "94vw", maxHeight: "94vh", borderRadius: "var(--radius)", boxShadow: "var(--shadow-3)" }}
            />
          </div>
        )}

        {/* 标题 */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>素材名字</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="给这个素材起个名字..."
            style={{ fontSize: "0.95rem" }}
          />
        </label>

        {/* 类型 */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>素材类型</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as MaterialKind)}
            style={{ fontSize: "0.9rem" }}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>

        {/* 素材描述 */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>素材描述</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="这张图片里有什么？"
            style={{ minHeight: 60, resize: "vertical", fontSize: "0.9rem", lineHeight: 1.6 }}
          />
        </label>

        {/* 我为什么拍它 */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>我为什么拍它</span>
          <textarea
            value={iNoticed}
            onChange={(e) => setINoticed(e.target.value)}
            style={{ minHeight: 80, resize: "vertical", fontSize: "0.9rem", lineHeight: 1.6 }}
          />
        </label>

        {/* 我的想法 */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>我的想法</span>
          <textarea
            value={itRemindsMe}
            onChange={(e) => setItRemindsMe(e.target.value)}
            style={{ minHeight: 80, resize: "vertical", fontSize: "0.9rem", lineHeight: 1.6 }}
          />
        </label>

        {/* 还不确定 */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>还不确定</span>
          <textarea
            value={stillUnsure}
            onChange={(e) => setStillUnsure(e.target.value)}
            placeholder="还有哪些说不准的地方？"
            style={{ minHeight: 60, resize: "vertical", fontSize: "0.9rem", lineHeight: 1.6 }}
          />
        </label>

        {/* 操作按钮 */}
        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "space-between", alignItems: "center", marginTop: "var(--space-2)" }}>
          <button
            onClick={handleDelete}
            className="btn-ghost"
            disabled={saving}
            style={{ color: "var(--danger)" }}
            aria-label="删除素材"
          >
            🗑️ 删除素材
          </button>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button onClick={handleSave} className="btn-primary" disabled={saving}>
              {saving ? "保存中..." : "✓ 保存修改"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
