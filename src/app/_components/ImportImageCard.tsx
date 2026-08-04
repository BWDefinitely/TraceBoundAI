"use client";

import { useState, useEffect } from "react";
import type { ImportImage } from "./ImportFlow";
import type { MaterialKind } from "../../lib/store";
import { getMediaBlob } from "../../lib/client-store";

const MATERIAL_KINDS: MaterialKind[] = ["观察", "想法", "时间", "地点", "人物", "物品"];
const MAX_LENGTH = 500;

interface Props {
  image: ImportImage;
  onUpdate: (updates: Partial<ImportImage>) => void;
  onGenerateGuidance?: (imageId: string, whyTook: string, myThoughts: string) => Promise<void>;
  onGenerateDescription?: (imageId: string) => Promise<void>;
}

export function ImportImageCard({ image, onUpdate, onGenerateGuidance, onGenerateDescription }: Props) {
  const [materialName, setMaterialName] = useState(image.materialName || "");
  const [description, setDescription] = useState(image.description ?? "");
  const [whyTook, setWhyTook] = useState(image.whyTook ?? "");
  const [myThoughts, setMyThoughts] = useState(image.myThoughts ?? "");
  const [kind, setKind] = useState<MaterialKind>(image.kind || "观察");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [guidanceHint, setGuidanceHint] = useState(image.guidanceHint ?? "");

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
  
  // 同步状态
  useEffect(() => {
    if (image.kind) setKind(image.kind);
  }, [image.kind]);

  useEffect(() => {
    if (image.whyTook !== undefined) setWhyTook(image.whyTook);
  }, [image.whyTook]);

  useEffect(() => {
    if (image.myThoughts !== undefined) setMyThoughts(image.myThoughts);
  }, [image.myThoughts]);

  useEffect(() => {
    if (image.description !== undefined) setDescription(image.description);
  }, [image.description]);

  useEffect(() => {
    if (image.guidanceHint !== undefined) setGuidanceHint(image.guidanceHint);
  }, [image.guidanceHint]);

  function handleSave() {
    onUpdate({ 
      status: "saved", 
      materialName: materialName.trim() || "未命名素材",
      description, 
      whyTook, 
      myThoughts, 
      kind 
    });
  }

  async function handleGenerateDescription() {
    if (!onGenerateDescription) return;
    setIsGeneratingDesc(true);
    try {
      await onGenerateDescription(image.id);
    } catch (err) {
      console.error("AI生成观察失败:", err);
      alert(`生成失败：${(err as Error).message}`);
    } finally {
      setIsGeneratingDesc(false);
    }
  }

  async function handleGenerateGuidance() {
    if (!whyTook.trim() && !myThoughts.trim()) return;
    if (!onGenerateGuidance) return;
    
    setIsGenerating(true);
    try {
      await onGenerateGuidance(image.id, whyTook, myThoughts);
    } catch (err) {
      console.error("生成观察指导失败:", err);
      alert(`生成失败：${(err as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDiscard() {
    onUpdate({ status: "discarded" });
  }

  const isPending = image.status === "pending";
  const isSaved = image.status === "saved";
  const isDiscarded = image.status === "discarded";
  const hasContent = whyTook.trim().length > 0 || myThoughts.trim().length > 0;
  const canGenerate = hasContent && !isGenerating && !isDiscarded;

  return (
    <div
      className="card"
      style={{
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        opacity: isDiscarded ? 0.4 : 1,
        border: isSaved ? "2px solid var(--accent)" : "1px solid var(--line)",
      }}
    >
      {/* 图片预览 */}
      {imageUrl && (
        <div style={{ 
          width: "100%", 
          height: 200, 
          borderRadius: "var(--radius)", 
          overflow: "hidden",
          background: "var(--surface)"
        }}>
          <img 
            src={imageUrl} 
            alt="素材"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      )}

      {/* 表单 */}
      {!isDiscarded && (
        <>
          {/* 素材名字 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>素材名字</span>
            <input
              type="text"
              value={materialName}
              onChange={(e) => setMaterialName(e.target.value)}
              placeholder="给这个素材起个名字..."
              disabled={isSaved}
              style={{ fontSize: "0.95rem" }}
            />
          </label>

          {/* 素材类型 */}
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

          {/* 素材描述 + AI生成观察 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>素材描述</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="这张图片里有什么？（AI 可以帮你生成）"
              disabled={isSaved}
              style={{
                minHeight: 60,
                resize: "vertical",
                fontSize: "0.9rem",
                lineHeight: 1.6,
              }}
            />
            {!isSaved && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDesc || isDiscarded}
                style={{
                  alignSelf: "flex-start",
                  fontSize: "0.82rem",
                  padding: "6px 14px",
                }}
              >
                {isGeneratingDesc ? "🤖 AI 读图中..." : "✨ AI生成观察"}
              </button>
            )}
          </div>

          {/* 我为什么拍它 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>我为什么拍它</span>
              <span 
                className="muted" 
                style={{ 
                  fontSize: "0.75rem",
                  color: whyTook.length > MAX_LENGTH ? "var(--error, red)" : "var(--ink-soft)"
                }}
              >
                {whyTook.length}/{MAX_LENGTH}
              </span>
            </div>
            <textarea
              value={whyTook}
              onChange={(e) => setWhyTook(e.target.value)}
              placeholder="为什么在那个时刻拍下这张照片？"
              disabled={isSaved}
              style={{
                minHeight: 80,
                resize: "vertical",
                fontSize: "0.9rem",
                lineHeight: 1.6,
                borderColor: whyTook.length > MAX_LENGTH ? "var(--error, red)" : undefined,
              }}
            />
          </label>

          {/* 我的想法 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>我的想法</span>
              <span 
                className="muted" 
                style={{ 
                  fontSize: "0.75rem",
                  color: myThoughts.length > MAX_LENGTH ? "var(--error, red)" : "var(--ink-soft)"
                }}
              >
                {myThoughts.length}/{MAX_LENGTH}
              </span>
            </div>
            <textarea
              value={myThoughts}
              onChange={(e) => setMyThoughts(e.target.value)}
              placeholder="看到这个素材时，你的感受、联想或思考是什么？"
              disabled={isSaved}
              style={{
                minHeight: 80,
                resize: "vertical",
                fontSize: "0.9rem",
                lineHeight: 1.6,
                borderColor: myThoughts.length > MAX_LENGTH ? "var(--error, red)" : undefined,
              }}
            />
          </label>

          {/* 生成观察指导按钮 */}
          {!isSaved && (
            <button
              className="btn-secondary"
              onClick={handleGenerateGuidance}
              disabled={!canGenerate}
              style={{
                width: "100%",
                opacity: canGenerate ? 1 : 0.5,
                cursor: canGenerate ? "pointer" : "not-allowed",
              }}
            >
              {isGenerating ? "🤔 AI正在思考..." : "💡 获取观察指导"}
            </button>
          )}

          {/* AI观察指导提示 */}
          {guidanceHint && (
            <div 
              style={{
                padding: "var(--space-3)",
                background: "var(--accent-wash)",
                border: "1px solid var(--accent-soft)",
                borderRadius: "var(--radius)",
                fontSize: "0.85rem",
                lineHeight: 1.6,
                color: "var(--ink)",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--accent)" }}>💡 观察提示：</span>
              <span style={{ marginLeft: "var(--space-1)" }}>{guidanceHint}</span>
            </div>
          )}
        </>
      )}

      {/* 操作按钮 */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)" }}>
        {!isSaved && !isDiscarded && (
          <>
            <button onClick={handleSave} className="btn-primary" style={{ flex: 1 }}>
              ✓ 保存
            </button>
            <button onClick={handleDiscard} className="btn-secondary">
              丢弃
            </button>
          </>
        )}
        {isSaved && <div style={{ color: "var(--accent)", fontSize: "0.9rem", fontWeight: 600 }}>✓ 已保存</div>}
        {isDiscarded && <div style={{ color: "var(--ink-soft)", fontSize: "0.9rem" }}>已丢弃</div>}
      </div>
    </div>
  );
}
