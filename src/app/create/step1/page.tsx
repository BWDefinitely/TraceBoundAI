"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator } from "../../_components/StepIndicator";
import { ImportFlow } from "../../_components/ImportFlow";

export default function Step1Page() {
  const router = useRouter();
  const [hasImages, setHasImages] = useState(false);
  const [userId, setUserId] = useState("");
  const [storyTitle, setStoryTitle] = useState("");
  // 复用之前导入的素材：在首页创建故事的对话框中勾选（newStoryReuseOld）
  const [reuseOldMaterials, setReuseOldMaterials] = useState(false);

  useEffect(() => {
    // 从 sessionStorage 获取 userId 和标题
    const storedUserId = sessionStorage.getItem("newStoryUserId");
    const storedTitle = sessionStorage.getItem("newStoryTitle");
    if (storedUserId) setUserId(storedUserId);
    if (storedTitle) setStoryTitle(storedTitle);
    setReuseOldMaterials(sessionStorage.getItem("newStoryReuseOld") === "1");
  }, []);

  function handleComplete() {
    // 素材导入完成，进入下一步
    router.push("/create/step2");
  }
  
  function handleSkip() {
    // 跳过素材导入，直接进入下一步
    router.push("/create/step2");
  }

  return (
    <div className="fade-in">
      <StepIndicator currentStep={1} totalSteps={5} />
      
      <header style={{ marginBottom: "var(--space-6)", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>步骤 1：批量导入素材</h1>
        <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
          上传多张图片，AI 会自动读图并生成描述。填写观察内容后，这些素材将成为故事的灵感来源。
        </p>
        {userId && (
          <div style={{ marginTop: "var(--space-3)", fontSize: "0.9rem", color: "var(--accent)" }}>
            当前用户：<strong>{userId}</strong> · 故事：<strong>{storyTitle}</strong>
            {reuseOldMaterials && (
              <span style={{ marginLeft: "var(--space-2)", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                · 已勾选「复用之前导入的素材」
              </span>
            )}
          </div>
        )}
      </header>

      <ImportFlow 
        userId={userId}
        onComplete={handleComplete} 
        onImagesChange={setHasImages}
        reuseOldMaterials={reuseOldMaterials}
      />

      <div style={{ marginTop: "var(--space-6)", display: "flex", justifyContent: "space-between" }}>
        <button onClick={() => router.push("/")} className="btn-secondary">
          ← 取消
        </button>
        {!hasImages && (
          <button onClick={handleSkip} className="btn-secondary">
            跳过此步骤 →
          </button>
        )}
      </div>
    </div>
  );
}
