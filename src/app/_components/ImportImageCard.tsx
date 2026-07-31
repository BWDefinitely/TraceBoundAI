"use client";

import { useState, useEffect } from "react";
import type { ImportImage } from "./ImportFlow";
import type { MaterialKind } from "../../lib/store";
import { getMediaBlob } from "../../lib/client-store";

const MATERIAL_KINDS: MaterialKind[] = ["观察", "感受", "想法", "对话", "人物", "物品"];

interface Props {
  image: ImportImage;
  onUpdate: (updates: Partial<ImportImage>) => void;
}

export function ImportImageCard({ image, onUpdate }: Props) {
  const [aiDescription, setAiDescription] = useState(image.aiDescription);
  const [iNoticed, setINoticed] = useState(image.iNoticed ?? "");
  const [itRemindsMe, setItRemindsMe] = useState(image.itRemindsMe ?? "");
  const [kind, setKind] = useState<MaterialKind>(image.kind || "观察");
  const [tags, setTags] = useState<string>((image.tags || []).join(", "));
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // 加载图片
  useEffect(() => {
    let url: string | null = null;
    getMediaBlob(image.blobId).then((blob) => {
      if (blob) {
        url = URL.createObjectURL(blob);
        setImageUrl(url);
      }
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [image.blobId]);
  
  // 同步 image 的 kind 和 tags
  useEffect(() => {
    if (image.kind) setKind(image.kind);
    if (image.tags) setTags(image.tags.join(", "));
  }, [image.kind, image.tags]);

  function handleSave() {
    const tagArray = tags.split(/[，,\s]+/).map(t => t.trim()).filter(Boolean);
    onUpdate({ status: "saved", aiDescription, iNoticed, itRemindsMe, kind, tags: tagArray });
  }

  function handleDiscard() {
    onUpdate({ status: "discarded" });
  }

  const isPending = image.status === "pending";
  const isSaved = image.status === "saved";
  const isDiscarded = image.status === "discarded";

  // 监听 image.aiDescription 变化，同步更新本地状态
  useEffect(() => {
    setAiDescription(image.aiDescription);
  }, [image.aiDescription]);

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-4)",
        opacity: isDiscarded ? 0.5 : 1,
        border: isSaved ? "2px solid var(--accent)" : "1px solid var(--line)",
      }}
    >
      {/* 图片预览 */}
      <div
        style={{
          width: "100%",
          height: 200,
          background: "var(--surface)",
          borderRadius: "var(--radius)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="预览"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        ) : (
          <span style={{ fontSize: "3rem" }}>📷</span>
        )}
      </div>

      {/* AI 描述（可编辑） */}
      {!isDiscarded && (
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
            素材名称（AI 自动生成）
            {image.aiDescription.includes("正在分析") && (
              <span style={{ marginLeft: "var(--space-2)", color: "var(--accent)" }}>⏳</span>
            )}
          </span>
          <input
            value={aiDescription}
            onChange={(e) => setAiDescription(e.target.value)}
            disabled={isSaved || image.aiDescription.includes("正在分析")}
            placeholder="编辑素材名称..."
            style={{ fontSize: "0.95rem" }}
          />
        </label>
      )}

      {/* 表单 */}
      {!isDiscarded && (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>素材类型</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as MaterialKind)}
              disabled={isSaved}
              style={{ fontSize: "0.9rem" }}
            >
              {MATERIAL_KINDS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>标签（AI自动识别）</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="多个标签用逗号分隔..."
              disabled={isSaved}
              style={{ fontSize: "0.9rem" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>我注意到</span>
            <textarea
              value={iNoticed}
              onChange={(e) => setINoticed(e.target.value)}
              placeholder="写下你观察到的细节..."
              disabled={isSaved}
              style={{
                minHeight: 80,
                resize: "vertical",
                fontFamily: "inherit",
                fontSize: "0.9rem",
              }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>它让我想到</span>
            <textarea
              value={itRemindsMe}
              onChange={(e) => setItRemindsMe(e.target.value)}
              placeholder="它让你联想到了什么..."
              disabled={isSaved}
              style={{
                minHeight: 80,
                resize: "vertical",
                fontFamily: "inherit",
                fontSize: "0.9rem",
              }}
            />
          </label>
        </>
      )}

      {/* 操作按钮 */}
      <div style={{ display: "flex", gap: "var(--space-3)", marginTop: "auto" }}>
        {isPending && (
          <>
            <button className="btn-primary" onClick={handleSave} style={{ flex: 1 }}>
              保存为素材
            </button>
            <button className="btn-secondary" onClick={handleDiscard}>
              放弃
            </button>
          </>
        )}
        {isSaved && (
          <button
            className="btn-secondary"
            onClick={() => onUpdate({ status: "pending" })}
            style={{ width: "100%" }}
          >
            重新编辑
          </button>
        )}
        {isDiscarded && (
          <button
            className="btn-secondary"
            onClick={() => onUpdate({ status: "pending" })}
            style={{ width: "100%" }}
          >
            恢复
          </button>
        )}
      </div>

      {/* 状态标签 */}
      {isSaved && (
        <div
          style={{
            position: "absolute",
            top: "var(--space-3)",
            right: "var(--space-3)",
            padding: "4px 12px",
            background: "var(--accent)",
            color: "white",
            borderRadius: "var(--radius)",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}
        >
          已保存
        </div>
      )}
      {isDiscarded && (
        <div
          style={{
            position: "absolute",
            top: "var(--space-3)",
            right: "var(--space-3)",
            padding: "4px 12px",
            background: "var(--ink-soft)",
            color: "white",
            borderRadius: "var(--radius)",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}
        >
          已放弃
        </div>
      )}
    </div>
  );
}
