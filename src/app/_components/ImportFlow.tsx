"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ImportImageCard } from "./ImportImageCard";
import type { MaterialKind } from "../../lib/store";
import { createImportBatch, updateImportBatch, deleteImportBatch, saveMediaBlob, getMediaBlob, deleteMediaBlob } from "../../lib/client-store";
import { createMaterialAction, getAiSettingsAction } from "../_actions";
import { generateObservationGuidance } from "../../lib/ai";

export interface ImportImage {
  id: string;
  blobId: string;
  materialName?: string; // 素材名字
  status: "pending" | "saved" | "discarded";
  whyTook?: string; // 我为什么拍它
  myThoughts?: string; // 我的想法
  guidanceHint?: string; // AI观察指导提示
  kind?: MaterialKind;
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
        materialName: `素材 ${baseIndex + i + 1}`,
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

  // 生成观察指导
  async function handleGenerateGuidance(imageId: string, whyTook: string, myThoughts: string) {
    try {
      const img = images.find(i => i.id === imageId);
      if (!img) throw new Error("图片未找到");

      const blob = await getMediaBlob(img.blobId);
      if (!blob) throw new Error("图片数据未找到");

      const settings = await getAiSettingsAction();
      
      // 调用AI生成观察指导（一句话提示）
      const guidance = await generateObservationGuidance(blob, whyTook, myThoughts, settings);
      
      // 更新图片的观察指导
      updateImage(imageId, { guidanceHint: guidance });
      
    } catch (err) {
      console.error("生成观察指导失败:", err);
      throw err;
    }
  }

  // 保存所有标记为 saved 的图片到素材库
  async function confirmAll() {
    setConfirmingAll(true);
    try {
      const saved = images.filter((img) => img.status === "saved");
      
      for (let i = 0; i < saved.length; i++) {
        const img = saved[i];
        const blob = await getMediaBlob(img.blobId);
        if (!blob) continue;

        await createMaterialAction({
          title: img.materialName || `素材 ${i + 1}`,
          kind: img.kind || "观察",
          tags: "", // 不再使用标签
          iNoticed: img.whyTook ?? "", // 我为什么拍它
          itRemindsMe: img.myThoughts ?? "", // 我的想法
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
              onGenerateGuidance={handleGenerateGuidance}
            />
          ))}
        </div>
      )}
    </div>
  );
}
