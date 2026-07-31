"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StepIndicator } from "../../_components/StepIndicator";
import { useData } from "../../_components/DataProvider";
import { AlchemyWorkbench } from "../../_components/AlchemyWorkbench";
import { StorylineOrganizer } from "../../_components/StorylineOrganizer";

export default function Step3Page() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { materials, stories, ready } = useData();
  const [storyId, setStoryId] = useState<string | null>(null);
  const [state, setState] = useState<"alchemy" | "organize">("alchemy");

  useEffect(() => {
    // 优先从 URL 读取，其次从 sessionStorage
    const urlStoryId = searchParams?.get("storyId") || null;
    const sessionStoryId = sessionStorage.getItem("currentStoryId");
    const finalId = urlStoryId || sessionStoryId;
    setStoryId(finalId);
    if (finalId) {
      sessionStorage.setItem("currentStoryId", finalId);
    }
  }, [searchParams]);

  const story = stories.find((s) => s.id === storyId);

  function handleNext() {
    if (!storyId) {
      alert("未找到故事 ID，请先完成前面的步骤");
      return;
    }
    router.push(`/create/step4?storyId=${storyId}`);
  }

  return (
    <div className="fade-in">
      <StepIndicator currentStep={3} totalSteps={5} />

      <header style={{ marginBottom: "var(--space-5)", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>步骤 3：灵感炼金 & 素材整理</h1>
        {story && (
          <div className="card" style={{ display: "inline-block", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--accent)" }}>📖 当前故事：</span>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, marginLeft: "var(--space-2)" }}>
              {story.metadata.event || story.title || "未命名故事"}
            </span>
          </div>
        )}
        <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "var(--space-4)" }}>
          切换两种状态：<strong>灵感炼金</strong>用素材生成新灵感；<strong>素材整理</strong>把素材拖到故事线上。
        </p>

        {/* 状态切换 */}
        <div
          style={{
            display: "inline-flex",
            gap: "var(--space-2)",
            padding: "4px",
            background: "var(--surface)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)",
          }}
        >
          <button
            onClick={() => setState("alchemy")}
            style={{
              padding: "8px 20px",
              background: state === "alchemy" ? "var(--accent)" : "transparent",
              color: state === "alchemy" ? "white" : "var(--ink)",
              border: "none",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            ⚗️ 灵感炼金
          </button>
          <button
            onClick={() => setState("organize")}
            style={{
              padding: "8px 20px",
              background: state === "organize" ? "var(--accent)" : "transparent",
              color: state === "organize" ? "white" : "var(--ink)",
              border: "none",
              borderRadius: "var(--radius)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
            }}
          >
            📋 素材整理
          </button>
        </div>
      </header>

      {!ready ? (
        <p className="muted">加载中...</p>
      ) : state === "alchemy" ? (
        <AlchemyWorkbench materials={materials} />
      ) : story ? (
        <StorylineOrganizer materials={materials} story={story} />
      ) : (
        <p className="muted">未找到当前故事，请返回上一步。</p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-6)" }}>
        <button onClick={() => router.push("/create/step2")} className="btn-secondary">
          ← 上一步
        </button>
        {state === "alchemy" ? (
          <button onClick={() => setState("organize")} className="btn-primary">
            前往素材整理 →
          </button>
        ) : (
          <button onClick={handleNext} className="btn-primary">
            下一步：开始撰写 →
          </button>
        )}
      </div>
    </div>
  );
}
