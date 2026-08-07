"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { StepIndicator } from "../../_components/StepIndicator";
import { useData } from "../../_components/DataProvider";
import { MaterialDetailModal } from "../../_components/MaterialDetailModal";
import { getMediaBlob, saveMediaBlob, getAiSettings } from "../../../lib/client-store";
import { completeStoryAction, saveStoryAction } from "../../_actions";
import { generateImage } from "../../../lib/ai";
import DOMPurify from "dompurify";
import type { Material } from "../../../lib/store";

const SLOT_LABELS: Record<string, string> = {
  discovery: "发现",
  goal: "目标",
  accident: "意外",
  action: "行动",
  change: "改变",
};

interface GeneratedImage {
  slotKey: string;
  blobId: string;
  prompt: string;
  url: string;
}

interface ImageRound {
  id: string;
  images: GeneratedImage[];
  timestamp: number;
}

function Step5Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = searchParams.get("storyId");
  const { stories, materials } = useData();
  
  const story = stories.find((s) => s.id === storyId);
  const [imageRounds, setImageRounds] = useState<ImageRound[]>([]);
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [expandedScene, setExpandedScene] = useState<string | null>("all"); // 默认全部展开
  const [materialPreviews, setMaterialPreviews] = useState<Map<string, string>>(new Map());
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  // 检查是否需要自动生成场景图
  useEffect(() => {
    if (!story || imageRounds.length > 0 || generating) return;
    
    // 检查是否有超过30字的场景内容
    const slots = ["discovery", "goal", "accident", "action", "change"] as const;
    const hasContent = slots.some(key => {
      const text = story.structure[key].text || "";
      return text.trim().length > 30;
    });
    
    if (hasContent) {
      handleGenerateImages();
    }
  }, [story]);

  // 加载素材预览图
  useEffect(() => {
    if (!story) return;
    
    const urls: string[] = [];
    
    const loadPreviews = async () => {
      const slots = ["discovery", "goal", "accident", "action", "change"] as const;
      
      for (const slotKey of slots) {
        const slotData = story.structure[slotKey];
        if (!slotData?.linkedMaterials) continue;

        for (const matId of slotData.linkedMaterials) {
          const mat = materials.find((m) => m.id === matId);
          if (mat && mat.mediaKind === 'photo' && !materialPreviews.has(matId)) {
            try {
              const blob = await getMediaBlob(matId);
              if (blob) {
                const url = URL.createObjectURL(blob);
                urls.push(url);
                setMaterialPreviews((prev) => new Map(prev).set(matId, url));
              }
            } catch (err) {
              console.error(`加载素材预览失败 (${matId}):`, err);
            }
          }
        }
      }
    };
    
    loadPreviews();
    
    return () => {
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [story, materials]);

  async function handleGenerateImages() {
    if (!story) return;
    
    setGenerating(true);
    const roundId = `round-${Date.now()}`;
    const newImages: GeneratedImage[] = [];

    try {
      const settings = await getAiSettings();
      const slots = ["discovery", "goal", "accident", "action", "change"] as const;

      for (const slotKey of slots) {
        const slot = story.structure[slotKey];
        if (!slot.text || slot.text.trim().length === 0) continue;

        try {
          const prompt = `故事场景：${SLOT_LABELS[slotKey]}。${slot.text.slice(0, 200)}。请生成一个适合儿童故事的插画风格场景图。`;
          const imageBlob = await generateImage(prompt, settings);
          const blobId = `scene-${Date.now()}-${slotKey}`;
          await saveMediaBlob(blobId, imageBlob);
          const url = URL.createObjectURL(imageBlob);
          
          newImages.push({ slotKey, blobId, prompt, url });
        } catch (err) {
          console.error(`生成${SLOT_LABELS[slotKey]}场景图失败:`, err);
        }
      }

      const newRound: ImageRound = {
        id: roundId,
        images: newImages,
        timestamp: Date.now(),
      };
      
      setImageRounds(prev => [...prev, newRound]);
      setSelectedRoundId(roundId);
      
    } catch (err) {
      console.error("生成场景图失败:", err);
      alert(`生成失败：${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function handleComplete() {
    if (!storyId) return;
    
    // 保存选中的场景图
    if (selectedRoundId && imageRounds.length > 0) {
      const selectedRound = imageRounds.find(r => r.id === selectedRoundId);
      if (selectedRound) {
        const sceneImages = selectedRound.images.map(img => ({
          blobId: img.blobId,
          prompt: img.prompt,
          createdAt: new Date().toISOString(),
        }));
        
        await saveStoryAction(storyId, { sceneImages });
        
        // 清理未选中轮次的图片
        for (const round of imageRounds) {
          if (round.id !== selectedRoundId) {
            for (const img of round.images) {
              if (img.url) URL.revokeObjectURL(img.url);
            }
          }
        }
      }
    }
    
    if (!confirm("确认完成这个故事？完成后将可以在首页查看。")) return;
    
    setCompleting(true);
    try {
      await completeStoryAction(storyId);
      router.push("/");
    } catch (err) {
      alert("完成失败，请重试");
      setCompleting(false);
    }
  }

  if (!story) {
    return <div className="fade-in"><p className="muted">未找到故事</p></div>;
  }

  const selectedRound = selectedRoundId ? imageRounds.find(r => r.id === selectedRoundId) : null;
  const slots = ["discovery", "goal", "accident", "action", "change"] as const;

  return (
    <div className="fade-in">
      <StepIndicator currentStep={5} totalSteps={5} />
      
      <header style={{ marginBottom: "var(--space-6)", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>步骤 5：故事回顾</h1>
        <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
          回顾你创作的故事和场景，确认无误后点击「完成故事」。
        </p>
      </header>

      {/* 故事正文 */}
      <section className="card" style={{ marginBottom: "var(--space-5)", padding: "var(--space-4)" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--space-4)" }}>{story.title}</h2>
        <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "0.9rem", color: "var(--ink-soft)", marginBottom: "var(--space-4)", flexWrap: "wrap" }}>
          {story.metadata.time && <span>📅 时间：{story.metadata.time}</span>}
          {story.metadata.place && <span>📍 地点：{story.metadata.place}</span>}
          {story.metadata.people.length > 0 && <span>👤 人物：{story.metadata.people.join("、")}</span>}
          {story.metadata.event && <span>⚡ 事件：{story.metadata.event}</span>}
          {!story.metadata.time && !story.metadata.place && story.metadata.people.length === 0 && !story.metadata.event && (
            <span className="muted">（未填写故事设定）</span>
          )}
        </div>
        <div
          style={{
            fontSize: "1.05rem",
            lineHeight: 1.8,
            fontFamily: "var(--font-serif)",
          }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(story.body) }}
        />
        
        {/* 字数统计 */}
        <div style={{ 
          marginTop: "var(--space-5)", 
          paddingTop: "var(--space-4)", 
          borderTop: "1px solid var(--line)",
          display: "flex",
          gap: "var(--space-4)",
          fontSize: "0.85rem",
          color: "var(--ink-soft)"
        }}>
          <span>总字数：{story.body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, '').length}</span>
          <span>✍️ 你写的：{story.userWordCount || 0} 字</span>
          <span>🤖 AI协助：{story.aiWordCount || 0} 字</span>
        </div>
      </section>

      {/* 五个场景阶段 */}
      <section style={{ marginBottom: "var(--space-5)" }}>
        <h3 style={{ fontSize: "1.1rem", marginBottom: "var(--space-4)" }}>📋 故事场景</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {slots.map((slotKey) => {
            const slot = story.structure[slotKey];
            const linkedMats = materials.filter(m => slot.linkedMaterials?.includes(m.id));
            const isExpanded = expandedScene === "all" || expandedScene === slotKey;
            
            return (
              <div 
                key={slotKey}
                className="card"
                style={{ padding: "var(--space-4)" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-3)" }}>
                  <div>
                    <h4 style={{ fontSize: "1.1rem", fontWeight: 600, color: "var(--accent)", margin: 0 }}>
                      {SLOT_LABELS[slotKey]}
                    </h4>
                  </div>
                  {linkedMats.length > 0 && (
                    <button
                      onClick={() => setExpandedScene(isExpanded ? null : slotKey)}
                      className="btn-secondary"
                      style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                    >
                      {isExpanded ? "收起" : `查看素材 (${linkedMats.length})`}
                    </button>
                  )}
                </div>
                
                {slot.text ? (
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.6, margin: 0, color: "var(--ink)" }}>
                    {slot.text}
                  </p>
                ) : (
                  <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>暂无内容</p>
                )}
                
                {/* 展开的素材列表 */}
                {isExpanded && linkedMats.length > 0 && (
                  <div style={{ 
                    marginTop: "var(--space-3)", 
                    paddingTop: "var(--space-3)", 
                    borderTop: "1px solid var(--line)",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                    gap: "var(--space-3)"
                  }}>
                    {linkedMats.map(mat => {
                      const previewUrl = materialPreviews.get(mat.id);
                      return (
                        <div 
                          key={mat.id}
                          onClick={() => setSelectedMaterial(mat)}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "var(--space-2)",
                            padding: "var(--space-2)",
                            background: "var(--surface)",
                            borderRadius: "var(--radius)",
                            border: "1px solid var(--line-soft)",
                            cursor: "pointer",
                            transition: "transform 0.15s ease, box-shadow 0.15s ease",
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = "translateY(-2px)";
                            e.currentTarget.style.boxShadow = "var(--shadow-1)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow = "none";
                          }}
                        >
                          {previewUrl && (
                            <div style={{ 
                              width: "100%", 
                              height: 120,
                              borderRadius: "var(--radius-sm)", 
                              overflow: "hidden"
                            }}>
                              <img 
                                src={previewUrl} 
                                alt={mat.title}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            </div>
                          )}
                          <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>{mat.title}</div>
                          <span className="tag" style={{ fontSize: "0.7rem", alignSelf: "flex-start" }}>{mat.kind}</span>
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

      {/* 场景插画 */}
      <section style={{ marginBottom: "var(--space-5)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
          <h3 style={{ fontSize: "1.1rem", margin: 0 }}>🎨 场景插画</h3>
          {imageRounds.length > 0 && (
            <button
              onClick={handleGenerateImages}
              disabled={generating}
              className="btn-secondary"
              style={{
                opacity: generating ? 0.6 : 1,
                cursor: generating ? "not-allowed" : "pointer",
              }}
            >
              {generating ? "生成中..." : "🔄 重新生成"}
            </button>
          )}
        </div>

        {generating && imageRounds.length === 0 ? (
          <div className="card" style={{ padding: "var(--space-6)", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "var(--space-3)" }}>🎨</div>
            <p style={{ fontSize: "1.1rem", marginBottom: "var(--space-2)" }}>AI正在为你的故事绘制插画...</p>
            <p className="muted" style={{ fontSize: "0.9rem" }}>这可能需要几分钟，请耐心等待</p>
          </div>
        ) : imageRounds.length > 0 ? (
          <>
            {/* 轮次选择 */}
            {imageRounds.length > 1 && (
              <div style={{ 
                display: "flex", 
                gap: "var(--space-2)", 
                marginBottom: "var(--space-4)",
                overflowX: "auto",
                paddingBottom: "var(--space-2)"
              }}>
                {imageRounds.map((round, index) => (
                  <button
                    key={round.id}
                    onClick={() => setSelectedRoundId(round.id)}
                    className="card"
                    style={{
                      padding: "var(--space-3)",
                      minWidth: 100,
                      border: selectedRoundId === round.id ? "2px solid var(--accent)" : "1px solid var(--line)",
                      background: selectedRoundId === round.id ? "var(--accent-wash)" : "white",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "0.85rem", fontWeight: 600 }}>第 {index + 1} 轮</div>
                    <div style={{ fontSize: "0.7rem", color: "var(--ink-soft)", marginTop: "var(--space-1)" }}>
                      {new Date(round.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* 场景图展示 */}
            {selectedRound && (
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", 
                gap: "var(--space-4)"
              }}>
                {selectedRound.images.map((img) => (
                  <div
                    key={img.blobId}
                    className="card"
                    style={{
                      padding: "var(--space-3)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "var(--space-2)",
                    }}
                  >
                    <div style={{ 
                      width: "100%", 
                      height: 200,
                      borderRadius: "var(--radius)", 
                      overflow: "hidden",
                      background: "var(--surface)"
                    }}>
                      <img 
                        src={img.url} 
                        alt={SLOT_LABELS[img.slotKey]}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    
                    <div style={{ 
                      fontSize: "0.9rem", 
                      fontWeight: 600, 
                      color: "var(--accent)"
                    }}>
                      {SLOT_LABELS[img.slotKey]}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="card" style={{ padding: "var(--space-6)", textAlign: "center" }}>
            <p className="muted">当场景内容超过30字时，将自动生成场景插画</p>
          </div>
        )}
      </section>

      {/* 底部按钮 */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-6)" }}>
        <button onClick={() => router.push(`/create/step4?storyId=${storyId}`)} className="btn-secondary">
          ← 返回修改
        </button>
        <button 
          onClick={handleComplete}
          disabled={completing}
          className="btn-primary"
        >
          {completing ? "完成中..." : "✓ 完成故事"}
        </button>
      </div>

      {/* 素材详情弹窗（可编辑 / 删除） */}
      {selectedMaterial && (
        <MaterialDetailModal
          material={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
        />
      )}
    </div>
  );
}

export default function Step5Page() {
  return (
    <Suspense fallback={<div className="fade-in"><p className="muted">加载中...</p></div>}>
      <Step5Content />
    </Suspense>
  );
}
