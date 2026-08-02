"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { StepIndicator } from "../../_components/StepIndicator";
import { useData } from "../../_components/DataProvider";
import { StorylineOrganizer } from "../../_components/StorylineOrganizer";
import { ThinkMorePanel } from "../../_components/ThinkMorePanel";
import { saveStoryAction } from "../../_actions";

type SlotKey = "discovery" | "goal" | "accident" | "action" | "change";

function Step3Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { materials, stories, ready } = useData();
  const [storyId, setStoryId] = useState<string | null>(null);
  const [thinkMoreScene, setThinkMoreScene] = useState<SlotKey | null>(null);

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

  function handleThinkMore(slotKey: SlotKey) {
    setThinkMoreScene(slotKey);
  }

  function handleCloseThinkMore() {
    setThinkMoreScene(null);
  }

  async function handleAdoptContent(slotKey: SlotKey, content: string) {
    if (!story) return;
    
    const currentText = story.structure[slotKey].text || "";
    const newText = currentText ? `${currentText}\n\n${content}` : content;
    
    const updatedStructure = {
      ...story.structure,
      [slotKey]: {
        ...story.structure[slotKey],
        text: newText,
      },
    };
    
    await saveStoryAction(story.id, { structure: updatedStructure });
  }

  return (
    <div className="fade-in">
      <StepIndicator currentStep={3} totalSteps={5} />

      <header style={{ marginBottom: "var(--space-5)", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>
          步骤 3：{thinkMoreScene ? "创意拓展" : "素材整理"}
        </h1>
        {story && (
          <div className="card" style={{ display: "inline-block", padding: "var(--space-3)", marginBottom: "var(--space-3)" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--accent)" }}>📖 当前故事：</span>
            <span style={{ fontSize: "0.95rem", fontWeight: 600, marginLeft: "var(--space-2)" }}>
              {story.metadata.event || story.title || "未命名故事"}
            </span>
          </div>
        )}
        <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.7, marginBottom: "var(--space-4)" }}>
          {thinkMoreScene 
            ? "点击可能性按钮，AI会生成创意方向供你选择。"
            : "将素材拖拽到场景中，填写内容后点击「想更多」按钮获取创意灵感。"
          }
        </p>
      </header>

      {!ready ? (
        <p className="muted">加载中...</p>
      ) : !story ? (
        <p className="muted">未找到当前故事，请返回上一步。</p>
      ) : thinkMoreScene ? (
        <ThinkMorePanel
          slotKey={thinkMoreScene}
          slotData={story.structure[thinkMoreScene]}
          story={story}
          materials={materials}
          onClose={handleCloseThinkMore}
          onAdopt={(content) => handleAdoptContent(thinkMoreScene, content)}
        />
      ) : (
        <StorylineOrganizer 
          materials={materials} 
          story={story}
          onThinkMore={handleThinkMore}
        />
      )}

      {!thinkMoreScene && (
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-6)" }}>
          <button onClick={() => router.push("/create/step2")} className="btn-secondary">
            ← 上一步
          </button>
          <button onClick={handleNext} className="btn-primary">
            下一步：开始撰写 →
          </button>
        </div>
      )}
    </div>
  );
}

export default function Step3Page() {
  return (
    <Suspense fallback={<div className="fade-in"><p className="muted">加载中...</p></div>}>
      <Step3Content />
    </Suspense>
  );
}
