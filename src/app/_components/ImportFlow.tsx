"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ImportImageCard } from "./ImportImageCard";
import type { MaterialKind } from "../../lib/store";
import { createImportBatch, updateImportBatch, deleteImportBatch, saveMediaBlob, getMediaBlob, deleteMediaBlob } from "../../lib/client-store";
import { createMaterialAction, getAiSettingsAction } from "../_actions";
import { readImage } from "../../lib/ai";

export interface ImportImage {
  id: string;
  blobId: string;
  aiDescription: string;
  status: "pending" | "saved" | "discarded";
  iNoticed?: string;
  itRemindsMe?: string;
  kind?: MaterialKind;
  tags?: string[];
}

interface Props {
  onComplete?: () => void;
  onImagesChange?: (hasImages: boolean) => void;
}

export function ImportFlow({ onComplete, onImagesChange }: Props) {
  const router = useRouter();
  const [batchId, setBatchId] = useState<string | null>(null);
  const [images, setImages] = useState<ImportImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [confirmingAll, setConfirmingAll] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 通知父组件图片状态变化
  useEffect(() => {
    if (onImagesChange) {
      onImagesChange(images.length > 0);
    }
  }, [images.length, onImagesChange]);

  // 处理文件选择
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setLoading(true);
    try {
      const settings = await getAiSettingsAction();
      const tempImages: ImportImage[] = [];
      
      // 第一阶段：快速上传所有图片到 IndexedDB，显示占位
      const baseIndex = images.length; // 从现有图片数量开始计数
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;

        const blobId = `import-${Date.now()}-${baseIndex + i}`;
        await saveMediaBlob(blobId, file);

        tempImages.push({
          id: `img-${Date.now()}-${baseIndex + i}`,
          blobId,
          aiDescription: "AI 正在分析图片...",
          status: "pending",
        });
      }

      // 如果是第一次，创建批次；否则更新现有批次
      if (!batchId) {
        const batch = await createImportBatch(tempImages);
        setBatchId(batch.id);
      }
      
      // 追加到现有图片列表
      setImages((prev) => [...prev, ...tempImages]);
      setLoading(false);

      // 第二阶段：异步调用 AI 读图（逐个更新）
      for (let i = 0; i < tempImages.length; i++) {
        const img = tempImages[i];
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;

        let aiDescription = `图片 ${baseIndex + i + 1}`;
        let detectedKind: MaterialKind = "观察";
        let suggestedTags: string[] = [];
        
        try {
          const rawDescription = await readImage(file, settings);
          aiDescription = rawDescription;
          
          // 智能识别素材类型和标签
          const lowerDesc = rawDescription.toLowerCase();
          
          // 检测是否是人物照片
          if (lowerDesc.includes('人') || lowerDesc.includes('男') || lowerDesc.includes('女') || 
              lowerDesc.includes('孩子') || lowerDesc.includes('小朋友') || lowerDesc.includes('朋友') ||
              lowerDesc.includes('家人') || lowerDesc.includes('同学') || lowerDesc.includes('老师') ||
              lowerDesc.includes('portrait') || lowerDesc.includes('person') || lowerDesc.includes('face')) {
            detectedKind = "人物";
            
            // 提取人物特征作为标签
            if (lowerDesc.includes('笑') || lowerDesc.includes('开心')) suggestedTags.push('笑容');
            if (lowerDesc.includes('跑') || lowerDesc.includes('跳')) suggestedTags.push('运动');
            if (lowerDesc.includes('读') || lowerDesc.includes('书')) suggestedTags.push('阅读');
          }
          
          // 根据内容添加通用标签
          if (lowerDesc.includes('自然') || lowerDesc.includes('树') || lowerDesc.includes('花')) suggestedTags.push('自然');
          if (lowerDesc.includes('动物') || lowerDesc.includes('猫') || lowerDesc.includes('狗')) suggestedTags.push('动物');
          if (lowerDesc.includes('建筑') || lowerDesc.includes('房子') || lowerDesc.includes('楼')) suggestedTags.push('建筑');
          if (lowerDesc.includes('食物') || lowerDesc.includes('吃') || lowerDesc.includes('美食')) suggestedTags.push('食物');
          
        } catch (err) {
          console.error("AI 读图失败:", err);
          aiDescription = `图片 ${baseIndex + i + 1}（AI 分析失败：${(err as Error).message}）`;
        }

        // 更新单个图片的描述和智能识别结果
        setImages((prev) =>
          prev.map((item) => (item.id === img.id ? { 
            ...item, 
            aiDescription,
            kind: detectedKind,
            tags: suggestedTags
          } : item))
        );
      }
    } catch (err) {
      console.error("Failed to upload images:", err);
      alert("上传失败，请重试");
      setLoading(false);
    }
    
    // 重置文件输入，允许重复选择相同文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  // 更新单个图片
  function updateImage(id: string, updates: Partial<ImportImage>) {
    setImages((prev) =>
      prev.map((img) => (img.id === id ? { ...img, ...updates } : img))
    );
  }

  // 保存所有标记为 saved 的图片到素材库
  async function confirmAll() {
    setConfirmingAll(true);
    try {
      const saved = images.filter((img) => img.status === "saved");
      
      for (const img of saved) {
        const blob = await getMediaBlob(img.blobId);
        if (!blob) continue;

        await createMaterialAction({
          title: img.aiDescription,
          kind: img.kind || "观察",
          tags: (img.tags || []).join(", "),
          iNoticed: img.iNoticed ?? "",
          itRemindsMe: img.itRemindsMe ?? "",
          aiAllowed: true,
          mediaKind: "photo",
          media: blob,
        });
      }

      // 删除批次和 Blob
      if (batchId) await deleteImportBatch(batchId);
      for (const img of images) {
        await deleteMediaBlob(img.blobId);
      }

      alert(`成功保存 ${saved.length} 份素材到素材库`);
      
      if (onComplete) {
        onComplete();
      } else {
        router.push("/");
      }
    } catch (err) {
      console.error("Failed to save materials:", err);
      alert("保存失败，请重试");
    } finally {
      setConfirmingAll(false);
    }
  }

  const pendingCount = images.filter((img) => img.status === "pending").length;
  const savedCount = images.filter((img) => img.status === "saved").length;
  const discardedCount = images.filter((img) => img.status === "discarded").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
      {/* 隐藏的文件输入（始终存在） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />

      {/* 上传区域 */}
      {images.length === 0 && (
        <div
          className="card"
          style={{
            padding: "var(--space-8)",
            textAlign: "center",
            border: "2px dashed var(--line)",
            cursor: "pointer",
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <div style={{ fontSize: "3rem", marginBottom: "var(--space-3)" }}>📸</div>
          <h3 style={{ marginBottom: "var(--space-2)" }}>选择图片</h3>
          <p className="muted" style={{ fontSize: "0.9rem" }}>
            点击或拖拽多张图片到这里
          </p>
          {loading && <p style={{ marginTop: "var(--space-3)", color: "var(--accent)" }}>上传中...</p>}
        </div>
      )}

      {/* 统计信息 */}
      {images.length > 0 && (
        <div
          className="card"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "var(--space-4)",
          }}
        >
          <div style={{ display: "flex", gap: "var(--space-6)" }}>
            <div>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                待处理
              </span>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)" }}>
                {pendingCount}
              </div>
            </div>
            <div>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                已保存
              </span>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--accent)" }}>
                {savedCount}
              </div>
            </div>
            <div>
              <span className="muted" style={{ fontSize: "0.85rem" }}>
                已放弃
              </span>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--ink-soft)" }}>
                {discardedCount}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button
              className="btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
            >
              继续添加图片
            </button>
            <button
              className="btn-primary"
              onClick={confirmAll}
              disabled={confirmingAll}
            >
              {confirmingAll
                ? "保存中..."
                : savedCount > 0
                ? "下一步"
                : "跳过当前步骤"}
            </button>
          </div>
        </div>
      )}

      {/* 图片列表 */}
      {images.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "var(--space-5)",
          }}
        >
          {images.map((img) => (
            <ImportImageCard
              key={img.id}
              image={img}
              onUpdate={(updates) => updateImage(img.id, updates)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
