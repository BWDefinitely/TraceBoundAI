"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import { StepIndicator } from "../../_components/StepIndicator";
import { useData } from "../../_components/DataProvider";
import { getMediaBlob } from "../../../lib/client-store";
import { completeStoryAction } from "../../_actions";

function Step5Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = searchParams.get("storyId");
  const { stories, materials } = useData();
  
  const story = stories.find((s) => s.id === storyId);
  const [imageUrls, setImageUrls] = useState<Array<{ url: string | null; prompt: string }>>([]);
  const [completing, setCompleting] = useState(false);
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null);
  const [materialPreviews, setMaterialPreviews] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    if (story?.sceneImages) {
      Promise.all(
        story.sceneImages.map(async (img) => {
          const blob = await getMediaBlob(img.blobId);
          return {
            url: blob ? URL.createObjectURL(blob) : null,
            prompt: img.prompt,
          };
        })
      ).then(setImageUrls);
    }

    return () => {
      imageUrls.forEach((img) => {
        if (img.url) URL.revokeObjectURL(img.url);
      });
    };
  }, [story?.sceneImages]);

  // 加载展开的素材预览图
  useEffect(() => {
    if (!expandedSlot || !story) return;
    
    const slotData = story.structure[expandedSlot as keyof typeof story.structure];
    if (!slotData?.linkedMaterials) return;

    slotData.linkedMaterials.forEach(async (matId: string) => {
      const mat = materials.find((m) => m.id === matId);
      if (mat && mat.mediaKind === 'photo' && !materialPreviews.has(matId)) {
        const blob = await getMediaBlob(matId);
        if (blob) {
          const url = URL.createObjectURL(blob);
          setMaterialPreviews((prev) => new Map(prev).set(matId, url));
        }
      }
    });
  }, [expandedSlot, story, materials]);

  async function handleComplete() {
    if (!storyId) return;
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

  return (
    <div className="fade-in">
      <StepIndicator currentStep={5} totalSteps={5} />
      
      <header style={{ marginBottom: "var(--space-6)", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>步骤 5：故事回顾</h1>
        <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
          回顾你创作的故事，确认无误后点击「完成故事」。
        </p>
      </header>

      {/* 故事正文 */}
      <section className="card" style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--space-4)" }}>{story.title}</h2>
        <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "0.9rem", color: "var(--ink-soft)", marginBottom: "var(--space-4)" }}>
          {story.metadata.time && <span>📅 {story.metadata.time}</span>}
          {story.metadata.place && <span>📍 {story.metadata.place}</span>}
          {story.metadata.people.length > 0 && <span>👤 {story.metadata.people.join("、")}</span>}
        </div>
        <div
          style={{
            fontSize: "1.05rem",
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
            fontFamily: "var(--font-serif)",
          }}
        >
          {story.body || <span className="muted">（还没有正文）</span>}
        </div>
        <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", display: "flex", gap: "var(--space-4)" }}>
            <span>总字数：{story.body.replace(/<[^>]+>/g, "").replace(/\s/g, "").length} 字</span>
            <span>✍️ 你写了：{story.userWordCount ?? 0} 字</span>
            <span>🤖 AI 写了：{story.aiWordCount ?? 0} 字</span>
          </div>
        </div>
      </section>

      {/* 故事线 */}
      <section className="card" style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--space-4)" }}>故事线</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "var(--space-4)" }}>
          {["qi", "cheng", "zhuan", "he"].map((key, index) => {
            const data = story.structure[key as keyof typeof story.structure];
            const labels = ["起", "承", "转", "合"];
            const colors = ["var(--accent)", "var(--blue)", "var(--amber)", "var(--green)"];
            const isExpanded = expandedSlot === key;
            
            return (
              <div
                key={key}
                style={{
                  padding: "var(--space-4)",
                  background: "var(--surface)",
                  borderRadius: "var(--radius)",
                  borderLeft: `4px solid ${colors[index]}`,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: "var(--space-2)" }}>{labels[index]}</div>
                {data?.text ? (
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>{data.text}</p>
                ) : (
                  <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>未填写</p>
                )}
                {data?.linkedMaterials && data.linkedMaterials.length > 0 && (
                  <div style={{ marginTop: "var(--space-3)" }}>
                    <button
                      onClick={() => setExpandedSlot(isExpanded ? null : key)}
                      style={{
                        fontSize: "0.8rem",
                        padding: "4px 8px",
                        background: "var(--accent-wash)",
                        border: "1px solid var(--accent-soft)",
                        borderRadius: "var(--radius-sm)",
                        cursor: "pointer",
                        color: "var(--accent)",
                        fontWeight: 500,
                        marginBottom: "var(--space-2)"
                      }}
                    >
                      {isExpanded ? "▼" : "▶"} 素材 ({data.linkedMaterials.length})
                    </button>
                    
                    {isExpanded ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                        {data.linkedMaterials.map((matId: string) => {
                          const mat = materials.find((m) => m.id === matId);
                          const previewUrl = materialPreviews.get(matId);
                          
                          return mat ? (
                            <div
                              key={matId}
                              style={{
                                display: "flex",
                                gap: "var(--space-2)",
                                padding: "var(--space-2)",
                                background: "white",
                                border: "1px solid var(--line)",
                                borderRadius: "var(--radius-sm)",
                                alignItems: "center"
                              }}
                            >
                              {previewUrl && (
                                <div style={{
                                  width: 60,
                                  height: 60,
                                  flexShrink: 0,
                                  borderRadius: "var(--radius-sm)",
                                  overflow: "hidden",
                                  background: "var(--surface)"
                                }}>
                                  <img 
                                    src={previewUrl} 
                                    alt={mat.title}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                </div>
                              )}
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <span className="tag" style={{ fontSize: "0.65rem", marginBottom: 2 }}>{mat.kind}</span>
                                <div style={{ fontSize: "0.85rem", fontWeight: 500 }}>{mat.title}</div>
                                {mat.tags && mat.tags.length > 0 && (
                                  <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
                                    {mat.tags.slice(0, 2).map((tag, i) => (
                                      <span key={i} style={{ fontSize: "0.65rem", color: "var(--ink-soft)" }}>#{tag}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null;
                        })}
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                        {data.linkedMaterials.map((matId: string) => {
                          const mat = materials.find((m) => m.id === matId);
                          return mat ? (
                            <span key={matId} className="tag" style={{ fontSize: "0.75rem" }}>
                              {mat.title}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 场景图片 */}
      {imageUrls.length > 0 && (
        <section className="card" style={{ marginBottom: "var(--space-6)" }}>
          <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--space-4)" }}>场景图片</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
            {imageUrls.map((img, index) => (
              <div
                key={index}
                style={{
                  background: "var(--surface)",
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                }}
              >
                <div style={{ width: "100%", height: 280, background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {img.url ? (
                    <img src={img.url} alt={img.prompt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ fontSize: "3rem" }}>🎨</span>
                  )}
                </div>
                <div style={{ padding: "var(--space-3)" }}>
                  <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: 0 }}>
                    {img.prompt}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-6)" }}>
        <button onClick={() => router.push(`/create/step4?storyId=${storyId}`)} className="btn-secondary">
          ← 上一步
        </button>
        <button onClick={handleComplete} className="btn-primary" disabled={completing}>
          {completing ? "完成中..." : "✓ 完成故事"}
        </button>
      </div>
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
