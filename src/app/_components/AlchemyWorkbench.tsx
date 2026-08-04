"use client";

import { useState, useEffect } from "react";
import type { Material } from "../../lib/store";
import { generateImage, readImage, askAgent } from "../../lib/ai";
import { getAiSettings, getMediaBlob } from "../../lib/client-store";
import { createMaterialAction } from "../_actions";

// 引导小朋友的 prompt 提示词
const PROMPT_HINTS = ["温暖的阳光", "一只可爱的小动物", "神秘的森林", "下雨的天气", "星空下", "卡通插画风格"];

const MATERIALS_PER_PAGE = 20;

interface Props {
  materials: Material[];
  userId: string;
}

// 灵感炼金工作台：左侧素材库 + 右侧炼金面板（灵感生成 / 素材融合）
export function AlchemyWorkbench({ materials, userId }: Props) {
  const [mode, setMode] = useState<"text-to-image" | "material-fusion">("text-to-image");
  const [displayCount, setDisplayCount] = useState(MATERIALS_PER_PAGE);
  const [dragId, setDragId] = useState<string | null>(null);

  const visibleMaterials = materials.slice(0, displayCount);
  const hasMore = displayCount < materials.length;

  function loadMore() {
    setDisplayCount(prev => Math.min(prev + MATERIALS_PER_PAGE, materials.length));
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: "var(--space-6)" }}>
      {/* 左侧：素材库 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <h3 style={{ fontSize: "1.05rem", margin: 0 }}>素材库</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: "68vh", overflowY: "auto" }}>
          {materials.length === 0 ? (
            <div className="card" style={{ padding: "var(--space-4)", textAlign: "center" }}>
              <p className="muted" style={{ fontSize: "0.85rem" }}>还没有素材，先去步骤 1 导入吧</p>
            </div>
          ) : (
            <>
              {visibleMaterials.map((m) => (
                <MaterialCard 
                  key={m.id} 
                  material={m} 
                  draggable={mode === "material-fusion"}
                  isDragging={dragId === m.id}
                  onDragStart={() => setDragId(m.id)}
                  onDragEnd={() => setDragId(null)}
                />
              ))}
              {hasMore && (
                <button 
                  onClick={loadMore}
                  className="btn-secondary"
                  style={{ fontSize: "0.85rem", padding: "var(--space-2)" }}
                >
                  加载更多 ({materials.length - displayCount} 项)
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 右侧：炼金面板 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        <div
          style={{
            display: "inline-flex",
            gap: "var(--space-2)",
            padding: "4px",
            background: "var(--surface)",
            borderRadius: "var(--radius)",
            border: "1px solid var(--line)",
            alignSelf: "flex-start",
          }}
        >
          <button
            onClick={() => setMode("text-to-image")}
            style={tabStyle(mode === "text-to-image")}
          >
            🎨 灵感生成
          </button>
          <button
            onClick={() => setMode("material-fusion")}
            style={tabStyle(mode === "material-fusion")}
          >
            ⚗️ 素材融合
          </button>
        </div>

        {mode === "text-to-image" ? <TextToImagePanel userId={userId} /> : <MaterialFusionPanel materials={materials} dragId={dragId} setDragId={setDragId} userId={userId} />}
      </div>
    </div>
  );
}

// 素材卡片组件，支持图片预览
function MaterialCard({ 
  material, 
  draggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd
}: { 
  material: Material;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

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

  return (
    <div 
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="card" 
      style={{ 
        padding: "var(--space-3)", 
        cursor: draggable ? 'grab' : (material.mediaKind === 'photo' && imageUrl ? 'pointer' : 'default'),
        opacity: isDragging ? 0.5 : 1
      }}
      onClick={() => !draggable && material.mediaKind === 'photo' && imageUrl && setExpanded(true)}
    >
      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-start" }}>
        {imageUrl && (
          <div style={{ 
            width: 60, 
            height: 60, 
            flexShrink: 0,
            borderRadius: "var(--radius-sm)", 
            overflow: "hidden",
            background: "var(--surface)"
          }}>
            <img 
              src={imageUrl} 
              alt={material.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="tag" style={{ fontSize: "0.7rem" }}>{material.kind}</span>
          <div style={{ fontSize: "0.9rem", fontWeight: 600, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis" }}>
            {material.title}
          </div>
          {material.tags && material.tags.length > 0 && (
            <div style={{ marginTop: 4, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {material.tags.slice(0, 3).map((tag, i) => (
                <span key={i} style={{ fontSize: "0.7rem", color: "var(--ink-soft)" }}>#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 图片放大预览 */}
      {expanded && imageUrl && !draggable && (
        <div
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            zIndex: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <img src={imageUrl} alt={material.title} style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "var(--radius)" }} />
        </div>
      )}
    </div>
  );
}

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: "8px 20px",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "white" : "var(--ink)",
    border: "none",
    borderRadius: "var(--radius)",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: "0.9rem",
  };
}

function TextToImagePanel({ userId }: { userId: string }) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ imageUrl: string; prompt: string } | null>(null);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [iNoticed, setINoticed] = useState("");
  const [itRemindsMe, setItRemindsMe] = useState("");

  async function handleGenerate() {
    if (!prompt.trim()) {
      alert("请输入描述");
      return;
    }
    setGenerating(true);
    try {
      const settings = await getAiSettings();
      const blob = await generateImage(prompt, settings);
      setResult({ imageUrl: URL.createObjectURL(blob), prompt });
      // 自动生成标题和清空表单
      setTitle(`AI生成：${prompt.slice(0, 20)}`);
      setTags("AI生成");
      setINoticed("");
      setItRemindsMe("");
    } catch (err) {
      alert("生成失败：" + (err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!result) return;
    try {
      const response = await fetch(result.imageUrl);
      const blob = await response.blob();
      await createMaterialAction({
        userId,
        title: title.trim() || `AI生成：${result.prompt.slice(0, 20)}`,
        kind: "观察",
        tags: tags.trim(),
        iNoticed: iNoticed || result.prompt,
        itRemindsMe: itRemindsMe || "",
        aiAllowed: true,
        mediaKind: "photo",
        media: blob,
      });
      alert("已保存到素材库");
      setResult(null);
      setPrompt("");
      setTitle("");
      setTags("");
      setINoticed("");
      setItRemindsMe("");
    } catch {
      alert("保存失败");
    }
  }

  return (
    <div className="card" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <h3 style={{ fontSize: "1.1rem", margin: 0 }}>灵感生成</h3>
      <p className="muted" style={{ fontSize: "0.85rem" }}>输入你想象的场景描述，AI 会帮你生成对应的图片素材。</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        {PROMPT_HINTS.map((hint) => (
          <button
            key={hint}
            type="button"
            onClick={() => setPrompt((p) => (p ? `${p}，${hint}` : hint))}
            style={{ fontSize: "0.75rem", padding: "4px 10px", background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", cursor: "pointer", color: "var(--ink-soft)" }}
          >
            + {hint}
          </button>
        ))}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="例如：一个下雨天的公园，有一只小狗在草地上玩耍..."
        style={{ minHeight: 120, resize: "vertical" }}
      />

      <button onClick={handleGenerate} className="btn-primary" disabled={generating}>
        {generating ? "生成中..." : "🎨 生成图片"}
      </button>

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ width: "100%", maxHeight: 400, borderRadius: "var(--radius)", overflow: "hidden", background: "var(--surface)" }}>
            <img src={result.imageUrl} alt={result.prompt} style={{ width: "100%", height: "auto" }} />
          </div>

          {/* 素材标题 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>素材标题</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给这个素材起个名字..."
              style={{ fontSize: "0.9rem" }}
            />
          </label>

          {/* 标签 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>标签</span>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="多个标签用逗号分隔，如：AI生成,风景,温暖"
              style={{ fontSize: "0.9rem" }}
            />
          </label>

          {/* 三问表单 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>我注意到（选填）</span>
            <input
              value={iNoticed}
              onChange={(e) => setINoticed(e.target.value)}
              placeholder="留空则使用生成提示词"
              style={{ fontSize: "0.9rem" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>它让我想到（选填）</span>
            <textarea
              value={itRemindsMe}
              onChange={(e) => setItRemindsMe(e.target.value)}
              placeholder="这个场景让你想到了什么？"
              style={{ minHeight: 80, resize: "vertical" }}
            />
          </label>

          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button onClick={handleSave} className="btn-primary">✓ 保存到素材库</button>
            <button onClick={() => setResult(null)} className="btn-secondary">✕ 放弃</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialFusionPanel({ materials, dragId, setDragId, userId }: { materials: Material[]; dragId: string | null; setDragId: (id: string | null) => void; userId: string }) {
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [materialPreviews, setMaterialPreviews] = useState<Map<string, string>>(new Map());
  const [brewing, setBrewing] = useState(false);
  const [brewingProgress, setBrewingProgress] = useState(0);
  const [result, setResult] = useState<{ description: string; imageUrl: string } | null>(null);
  const [title, setTitle] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [iNoticed, setINoticed] = useState("");
  const [itRemindsMe, setItRemindsMe] = useState("");
  const [fusionPrompt, setFusionPrompt] = useState(""); // 用户输入的文字 prompt，控制生图结果
  
  // 从所有素材中提取唯一标签
  const allTags = Array.from(new Set(materials.flatMap(m => m.tags))).sort();

  function handleDrop() {
    if (!dragId) return;
    if (selectedMaterials.includes(dragId)) {
      setDragId(null);
      return;
    }
    setSelectedMaterials((prev) => [...prev, dragId]);
    setDragId(null);
  }

  function removeMaterial(id: string) {
    setSelectedMaterials((prev) => prev.filter((mid) => mid !== id));
  }

  function materialById(id: string) {
    return materials.find((m) => m.id === id);
  }

  // 加载素材预览图
  useEffect(() => {
    selectedMaterials.forEach(async (id) => {
      const material = materialById(id);
      if (material && material.mediaKind === 'photo' && !materialPreviews.has(id)) {
        const blob = await getMediaBlob(id);
        if (blob) {
          const url = URL.createObjectURL(blob);
          setMaterialPreviews((prev) => new Map(prev).set(id, url));
        }
      }
    });
  }, [selectedMaterials]);

  async function handleBrew() {
    if (selectedMaterials.length < 2) {
      alert("至少选择 2 个素材才能融合");
      return;
    }
    
    setBrewing(true);
    setBrewingProgress(0);
    
    try {
      // 第一步：读取所有素材的图片和描述
      // 进度从 0% 缓慢增加到 20%
      const progressInterval1 = setInterval(() => {
        setBrewingProgress(prev => {
          if (prev >= 20) return 20;
          return prev + 1;
        });
      }, 50);
      
      const settings = await getAiSettings();
      const materialDescriptions: string[] = [];
      
      for (const id of selectedMaterials) {
        const material = materialById(id);
        if (material) {
          if (material.mediaKind === 'photo') {
            const blob = await getMediaBlob(id);
            if (blob) {
              const file = new File([blob], material.title, { type: blob.type });
              const aiDesc = await readImage(file, settings);
              materialDescriptions.push(`${material.title}: ${aiDesc}`);
            }
          } else {
            materialDescriptions.push(`${material.title}: ${material.iNoticed || material.title}`);
          }
        }
      }
      
      clearInterval(progressInterval1);
      setBrewingProgress(20);
      
      // 第二步：生成融合描述
      // 进度从 20% 缓慢增加到 50%
      await new Promise(resolve => setTimeout(resolve, 300)); // 短暂停留
      const progressInterval2 = setInterval(() => {
        setBrewingProgress(prev => {
          if (prev >= 50) return 50;
          return prev + 1;
        });
      }, 100);
      
      const fusionPromptText = `请将以下${selectedMaterials.length}个素材融合成一个新的创意场景描述（用于生成儿童绘本插画）：\n\n${materialDescriptions.join('\n\n')}\n\n请生成一个融合了所有元素的场景描述，适合儿童绘本插画风格，温馨有趣。直接给出场景描述，不要解释。${fusionPrompt.trim() ? `\n\n孩子额外要求的画面方向：${fusionPrompt.trim()}` : ""}`;
      
      const fusionDescription = await askAgent({ 
        persona: "story-coach", 
        userPrompt: fusionPromptText, 
        settings 
      });
      
      clearInterval(progressInterval2);
      setBrewingProgress(50);
      
      // 第三步：生成图片
      // 进度从 50% 缓慢增加到 90%
      await new Promise(resolve => setTimeout(resolve, 300)); // 短暂停留
      const progressInterval3 = setInterval(() => {
        setBrewingProgress(prev => {
          if (prev >= 90) return 90;
          return prev + 0.5;
        });
      }, 100);
      
      const imagePrompt = `儿童绘本插画风格，温暖色调，${fusionDescription}${fusionPrompt.trim() ? `，用户额外要求：${fusionPrompt.trim()}` : ""}`;
      const imageBlob = await generateImage(imagePrompt, settings);
      const imageUrl = URL.createObjectURL(imageBlob);
      
      clearInterval(progressInterval3);
      
      // 完成 - 快速到 100%
      setBrewingProgress(95);
      await new Promise(resolve => setTimeout(resolve, 200));
      setBrewingProgress(100);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setResult({ 
        description: fusionDescription.trim(), 
        imageUrl 
      });
      setTitle(`素材融合：${selectedMaterials.length}个元素`);
      setSelectedTags([]);
      setINoticed("");
      setItRemindsMe("");
    } catch (err) {
      alert("融合失败：" + (err as Error).message);
    } finally {
      setBrewing(false);
      setBrewingProgress(0);
    }
  }

  async function handleSave() {
    if (!result) return;
    try {
      const response = await fetch(result.imageUrl);
      const blob = await response.blob();
      await createMaterialAction({
        userId,
        title: title.trim() || `素材融合：${selectedMaterials.length}个元素`,
        kind: "观察",
        tags: selectedTags.join(","),
        iNoticed: iNoticed || result.description,
        itRemindsMe: itRemindsMe || "",
        aiAllowed: true,
        mediaKind: "photo",
        media: blob,
      });
      alert("已保存到素材库");
      setResult(null);
      setSelectedMaterials([]);
      setTitle("");
      setSelectedTags([]);
      setINoticed("");
      setItRemindsMe("");
      setFusionPrompt("");
    } catch {
      alert("保存失败");
    }
  }

  return (
    <div className="card" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <h3 style={{ fontSize: "1.1rem", margin: 0 }}>素材融合</h3>
      <p className="muted" style={{ fontSize: "0.85rem" }}>从左侧素材库拖动至少 2 个素材到炼金锅，AI 会融合它们的灵感并生成新素材。</p>

      {/* 素材预览区 */}
      {selectedMaterials.length > 0 && (
        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
          {selectedMaterials.map((id) => {
            const m = materialById(id);
            const previewUrl = materialPreviews.get(id);
            return (
              <div
                key={id}
                style={{
                  width: 120,
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-2)",
                  padding: "var(--space-2)",
                  border: "1px solid var(--line)",
                  borderRadius: "var(--radius)",
                }}
              >
                {previewUrl && (
                  <div style={{
                    width: "100%",
                    height: 100,
                    borderRadius: "var(--radius-sm)",
                    overflow: "hidden",
                    background: "var(--surface)"
                  }}>
                    <img 
                      src={previewUrl} 
                      alt={m?.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                )}
                <div style={{ fontSize: "0.75rem", textAlign: "center", lineHeight: 1.3 }}>
                  {m?.title?.slice(0, 15)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 炼金锅 - 拖拽区 */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{
          minHeight: 280,
          border: dragId ? "3px dashed var(--accent)" : "2px solid var(--line)",
          borderRadius: "var(--radius)",
          padding: "var(--space-4)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "var(--space-3)",
          background: selectedMaterials.length > 0 ? "var(--accent-wash)" : "var(--surface)",
          transition: "all 0.2s ease",
          position: "relative",
        }}
      >
        {/* 炼金锅图标 - 添加动画 */}
        <div 
          style={{ 
            fontSize: "4rem", 
            opacity: 0.6,
            animation: brewing ? "bubble 1.5s ease-in-out infinite" : "none",
            transform: brewing ? "scale(1.1)" : "scale(1)",
            transition: "transform 0.3s ease"
          }}
        >
          🧪
        </div>
        
        {/* 进度环 */}
        {brewing && (
          <div style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 120,
            height: 120,
          }}>
            <svg width="120" height="120" style={{ transform: "rotate(-90deg)" }}>
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="var(--line)"
                strokeWidth="8"
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - brewingProgress / 100)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
            </svg>
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: "1.2rem",
              fontWeight: 700,
              color: "var(--accent)"
            }}>
              {brewingProgress}%
            </div>
          </div>
        )}
        
        {!brewing && selectedMaterials.length === 0 ? (
          <p className="muted" style={{ fontSize: "0.9rem", textAlign: "center" }}>
            拖动素材到这里<br />
            <span style={{ fontSize: "0.8rem" }}>至少需要 2 个素材</span>
          </p>
        ) : !brewing ? (
          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <p style={{ fontSize: "0.9rem", fontWeight: 600, textAlign: "center" }}>
              已选择 {selectedMaterials.length} 个素材
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", justifyContent: "center" }}>
              {selectedMaterials.map((id) => {
                const m = materialById(id);
                return (
                  <div
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      background: "white",
                      border: "1px solid var(--accent)",
                      borderRadius: "var(--radius)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span className="tag" style={{ fontSize: "0.65rem", margin: 0 }}>{m?.kind}</span>
                    <span>{m?.title?.slice(0, 12) ?? "素材"}</span>
                    <button
                      onClick={() => removeMaterial(id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--ink-soft)",
                        padding: 0,
                        fontSize: "1.1rem",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <p style={{ fontSize: "0.9rem", color: "var(--accent)", fontWeight: 600, textAlign: "center" }}>
            正在炼金中...
          </p>
        )}
      </div>

      {/* CSS 动画 */}
      <style jsx>{`
        @keyframes bubble {
          0%, 100% { transform: scale(1.1) translateY(0); }
          50% { transform: scale(1.15) translateY(-5px); }
        }
      `}</style>

      {/* 融合提示词（可选）：控制生图结果 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
          融合提示词（可选）
          <span className="muted" style={{ fontWeight: 400, fontSize: "0.75rem", marginLeft: "var(--space-2)" }}>
            用文字告诉 AI 你想要什么画面，会直接影响生成结果
          </span>
        </span>
        <textarea
          value={fusionPrompt}
          onChange={(e) => setFusionPrompt(e.target.value)}
          placeholder="例如：两个人手牵手站在星空下 / 画面要更梦幻一点…"
          style={{ minHeight: 60, resize: "vertical", fontSize: "0.9rem", lineHeight: 1.6 }}
        />
      </div>

      <button
        onClick={handleBrew}
        className="btn-primary"
        disabled={brewing || selectedMaterials.length < 2}
      >
        {brewing ? `融合中... ${brewingProgress}%` : "🔥 开始融合"}
      </button>

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ width: "100%", maxHeight: 400, borderRadius: "var(--radius)", overflow: "hidden", background: "var(--surface)" }}>
            <img src={result.imageUrl} alt="融合结果" style={{ width: "100%", height: "auto" }} />
          </div>

          <div className="card" style={{ padding: "var(--space-3)", background: "var(--accent-wash)" }}>
            <p style={{ fontSize: "0.85rem", lineHeight: 1.6, margin: 0 }}>{result.description}</p>
          </div>

          {/* 素材标题 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>素材标题</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="给这个融合素材起个名字..."
              style={{ fontSize: "0.9rem" }}
            />
          </label>

          {/* 标签选择 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>标签（从现有素材标签中选择）</span>
            {allTags.length > 0 ? (
              <>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", padding: "var(--space-2)", border: "1px solid var(--line)", borderRadius: "var(--radius)", minHeight: "40px", background: "var(--surface)" }}>
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setSelectedTags(prev => 
                          prev.includes(tag) 
                            ? prev.filter(t => t !== tag)
                            : [...prev, tag]
                        );
                      }}
                      style={{
                        padding: "0.3rem 0.7rem",
                        fontSize: "0.8rem",
                        background: selectedTags.includes(tag) ? "var(--accent)" : "var(--card)",
                        color: selectedTags.includes(tag) ? "white" : "var(--ink)",
                        border: `1px solid ${selectedTags.includes(tag) ? "var(--accent)" : "var(--line)"}`,
                        borderRadius: "var(--radius-sm)",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "0.75rem", color: "var(--ink-soft)", margin: 0 }}>
                  已选择 {selectedTags.length} 个标签{selectedTags.length > 0 ? `：${selectedTags.join("、")}` : ""}
                </p>
              </>
            ) : (
              <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", padding: "var(--space-2)", background: "var(--surface)", borderRadius: "var(--radius)" }}>
                素材库中还没有标签，保存后可以手动添加
              </p>
            )}
          </div>

          {/* 三问表单 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>我注意到（选填）</span>
            <input
              value={iNoticed}
              onChange={(e) => setINoticed(e.target.value)}
              placeholder="留空则使用融合描述"
              style={{ fontSize: "0.9rem" }}
            />
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>它让我想到（选填）</span>
            <textarea
              value={itRemindsMe}
              onChange={(e) => setItRemindsMe(e.target.value)}
              placeholder="这个融合结果让你想到了什么？"
              style={{ minHeight: 80, resize: "vertical" }}
            />
          </label>

          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button onClick={handleSave} className="btn-primary">✓ 保存到素材库</button>
            <button onClick={() => setResult(null)} className="btn-secondary">✕ 放弃</button>
          </div>
        </div>
      )}
    </div>
  );
}
