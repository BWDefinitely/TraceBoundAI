"use client";

import { useState, useEffect } from "react";
import type { Story } from "../../lib/store";
import { generateImage, readImage } from "../../lib/ai";
import { getAiSettings, saveMediaBlob, getMediaBlob } from "../../lib/client-store";
import { saveStoryAction, askAgentAction } from "../_actions";

interface Props {
  story: Story;
  storyBody: string;
}

interface ImageWithMeta {
  url: string;
  prompt: string;
  description: string;
  index: number;
}

// 场景生图面板：支持自定义prompt，AI读图生成描述，可编辑描述
export function SceneImagePanel({ story, storyBody }: Props) {
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<ImageWithMeta[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const [count, setCount] = useState(2);
  const [customPrompt, setCustomPrompt] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingDescription, setEditingDescription] = useState("");

  // 加载已有场景图
  useEffect(() => {
    let revoked: string[] = [];
    (async () => {
      const existing = story.sceneImages ?? [];
      const loaded: ImageWithMeta[] = [];
      for (let i = 0; i < existing.length; i++) {
        const img = existing[i];
        const blob = await getMediaBlob(img.blobId);
        if (blob) {
          const url = URL.createObjectURL(blob);
          revoked.push(url);
          loaded.push({ 
            url, 
            prompt: img.prompt, 
            description: img.description || "暂无描述",
            index: i
          });
        }
      }
      setImages(loaded);
    })();
    return () => {
      revoked.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story.id]);

  // 从正文拆解出不同的场景片段（分镜）
  async function buildScenePrompts(numScenes: number, userPrompt?: string): Promise<string[]> {
    // 如果用户提供了自定义prompt，直接使用
    if (userPrompt?.trim()) {
      const styleContext = buildStyleContext();
      return [userPrompt.trim()].concat(Array(numScenes - 1).fill(""));
    }

    const text = storyBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) {
      return [`儿童绘本插画风格，1:1 正方形构图，温暖明亮的色彩，描绘：${story.metadata.place || "一个场景"}`];
    }

    // 构建风格描述：根据故事元数据和已写内容
    const styleContext = buildStyleContext();

    try {
      // 传入完整的故事内容和元数据，让AI理解风格
      const fullContext = `
故事元数据：
- 时间：${story.metadata.time || "未知"}
- 地点：${story.metadata.place || "未知"}
- 人物：${story.metadata.people?.join("、") || "未知"}
- 事件：${story.metadata.event || "未知"}

故事内容：
${text}
`;

      const res = await askAgentAction({
        persona: "story-coach",
        userPrompt:
          `请仔细阅读下面的故事元数据和内容，理解故事的风格、氛围和基调，然后拆解成 ${numScenes} 个不同的关键场景，每个场景用一句话描述（30字内），` +
          `分别编号「1.」「2.」「3.」「4.」开头，适合画成儿童绘本插画。只给场景描述，不要额外解释。\n\n${fullContext}`,
        storyId: story.id,
        includeStoryBody: false,
      });
      if (res.ok) {
        const lines = res.reply.split("\n").filter((l) => /^[1-4]\./.test(l.trim()));
        return lines.slice(0, numScenes).map((l) => {
          const desc = l.replace(/^[1-4]\.\s*/, "").trim();
          return `${styleContext}，描绘：${desc}`;
        });
      }
    } catch {
      /* fallback */
    }

    // 降级：切分文本为多个片段
    const sentences = text.match(/[^。！？.!?]+[。！？.!?]*/g) || [text];
    const step = Math.max(1, Math.floor(sentences.length / numScenes));
    const prompts: string[] = [];
    for (let i = 0; i < numScenes && i < sentences.length; i++) {
      const start = i * step;
      const snippet = sentences.slice(start, start + step).join("").slice(0, 200);
      prompts.push(`${buildStyleContext()}，描绘如下故事场景：${snippet}`);
    }
    return prompts.slice(0, numScenes);
  }

  // 根据故事元数据和内容构建风格描述
  function buildStyleContext(): string {
    const meta = story.metadata;
    const parts: string[] = ["儿童绘本插画风格", "1:1 正方形构图"];
    
    // 根据故事的时间和地点推断氛围和色调
    const time = meta.time?.toLowerCase() || "";
    const place = meta.place?.toLowerCase() || "";
    const event = meta.event?.toLowerCase() || "";
    
    // 时间相关的色调
    if (time.includes("早晨") || time.includes("清晨")) {
      parts.push("清新明亮的晨光色调");
    } else if (time.includes("傍晚") || time.includes("黄昏")) {
      parts.push("温暖的金黄色夕阳光线");
    } else if (time.includes("夜晚") || time.includes("晚上")) {
      parts.push("柔和的夜色氛围，星光点点");
    } else if (time.includes("春天")) {
      parts.push("明快清新的春日色彩");
    } else if (time.includes("夏天")) {
      parts.push("明亮活泼的夏日阳光");
    } else if (time.includes("秋天")) {
      parts.push("温暖的秋日金黄色调");
    } else if (time.includes("冬天")) {
      parts.push("清冷纯净的冬日色彩");
    } else {
      parts.push("温暖明亮的色彩");
    }
    
    // 地点相关的氛围
    if (place.includes("森林") || place.includes("树林")) {
      parts.push("自然清新，绿意盎然");
    } else if (place.includes("海边") || place.includes("沙滩")) {
      parts.push("蓝天碧海，轻松愉快");
    } else if (place.includes("山") || place.includes("高处")) {
      parts.push("开阔辽远的视野");
    } else if (place.includes("家") || place.includes("房间")) {
      parts.push("温馨舒适的室内环境");
    } else if (place.includes("学校") || place.includes("教室")) {
      parts.push("明亮整洁的学习环境");
    } else if (place.includes("公园")) {
      parts.push("悠闲愉快的户外氛围");
    }
    
    // 事件相关的情绪氛围
    if (event.includes("开心") || event.includes("快乐") || event.includes("庆祝")) {
      parts.push("欢乐愉快的气氛");
    } else if (event.includes("冒险") || event.includes("探险") || event.includes("发现")) {
      parts.push("充满好奇和期待");
    } else if (event.includes("安静") || event.includes("思考")) {
      parts.push("宁静祥和的氛围");
    } else if (event.includes("紧张") || event.includes("担心")) {
      parts.push("略带紧张但充满希望");
    }
    
    // 角色相关
    if (meta.people && meta.people.length > 0) {
      parts.push(`主要角色：${meta.people.slice(0, 2).join("、")}`);
    }
    
    return parts.join("，");
  }

  async function handleGenerate() {
    const text = storyBody.replace(/<[^>]+>/g, "").trim();
    if (!text && !customPrompt.trim()) {
      alert("请先写点故事内容，或输入自定义提示词");
      return;
    }
    setGenerating(true);
    try {
      const settings = await getAiSettings();
      const prompts = await buildScenePrompts(count, customPrompt);
      
      // 如果是自定义prompt且只有一个，复制到所需数量
      const actualPrompts = customPrompt.trim() 
        ? Array(count).fill(prompts[0])
        : prompts;
      
      const actualCount = Math.min(count, actualPrompts.length);
      console.log(`[SceneImagePanel] 将生成 ${actualCount} 张图片`);
      
      const newImages: ImageWithMeta[] = [];
      const newRecords = [...(story.sceneImages ?? [])];
      
      for (let i = 0; i < actualCount; i++) {
        const prompt = actualPrompts[i];
        if (!prompt) continue;
        
        console.log(`[SceneImagePanel] 生成第 ${i + 1}/${actualCount} 张，prompt:`, prompt);
        const blob = await generateImage(prompt, settings);
        const blobId = `scene-${Date.now()}-${i}`;
        await saveMediaBlob(blobId, blob);
        
        // 使用AI读图生成简短描述
        let description = "正在生成描述...";
        try {
          const aiDesc = await readImage(blob, settings);
          // 提取第一句话作为简短描述（限制50字）
          const firstSentence = aiDesc.split(/[。！？.!?]/)[0];
          description = firstSentence.slice(0, 50);
        } catch (err) {
          console.error("[SceneImagePanel] AI读图失败:", err);
          description = "场景图片";
        }
        
        newRecords.push({ blobId, prompt, description, createdAt: new Date().toISOString() });
        newImages.push({ 
          url: URL.createObjectURL(blob), 
          prompt, 
          description,
          index: newRecords.length - 1
        });
      }
      
      await saveStoryAction(story.id, { sceneImages: newRecords });
      setImages((prev) => [...prev, ...newImages]);
      setCustomPrompt(""); // 清空自定义prompt
    } catch (err) {
      console.error("[SceneImagePanel] 生成失败:", err);
      alert("生成失败：" + (err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSaveDescription(index: number) {
    if (editingIndex !== index) return;
    
    const newRecords = [...(story.sceneImages ?? [])];
    if (newRecords[index]) {
      newRecords[index] = {
        ...newRecords[index],
        description: editingDescription
      };
      await saveStoryAction(story.id, { sceneImages: newRecords });
      
      setImages(prev => prev.map(img => 
        img.index === index 
          ? { ...img, description: editingDescription }
          : img
      ));
    }
    
    setEditingIndex(null);
    setEditingDescription("");
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: "1.05rem", margin: 0 }}>🎨 场景生图</h3>
        <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>已生成 {images.length} 张</span>
      </div>

      {/* 自定义提示词输入 */}
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
        <label style={{ fontSize: "0.85rem", fontWeight: 600 }}>
          自定义提示词（选填，留空自动根据故事风格生成）
        </label>
        <textarea
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          placeholder="例：一只小兔子在森林里探险，卡通风格，温馨明亮..."
          disabled={generating}
          style={{ 
            minHeight: 60, 
            resize: "vertical",
            fontSize: "0.9rem"
          }}
        />
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <label style={{ fontSize: "0.85rem" }}>生成数量</label>
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={generating}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>{n} 张</option>
          ))}
        </select>
        <button className="btn-primary" onClick={handleGenerate} disabled={generating} style={{ flex: 1 }}>
          {generating ? "AI 绘制中..." : customPrompt.trim() ? "根据提示词生成" : "根据故事生成场景图"}
        </button>
      </div>

      {images.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {images.map((img, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: "var(--space-3)",
                padding: "var(--space-3)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                background: "var(--surface)",
              }}
            >
              {/* 图片缩略图 */}
              <div
                onClick={() => setZoom(img.url)}
                style={{
                  width: 120,
                  height: 120,
                  flexShrink: 0,
                  borderRadius: "var(--radius)",
                  overflow: "hidden",
                  border: "1px solid var(--line)",
                  cursor: "zoom-in",
                }}
              >
                <img src={img.url} alt={`场景 ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>

              {/* 描述和编辑 */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                  场景 {i + 1}
                </div>
                
                {editingIndex === img.index ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                    <input
                      value={editingDescription}
                      onChange={(e) => setEditingDescription(e.target.value)}
                      placeholder="输入图片描述..."
                      style={{ fontSize: "0.9rem" }}
                      autoFocus
                    />
                    <div style={{ display: "flex", gap: "var(--space-2)" }}>
                      <button 
                        onClick={() => handleSaveDescription(img.index)}
                        className="btn-primary"
                        style={{ fontSize: "0.8rem", padding: "0.3rem 0.8rem" }}
                      >
                        保存
                      </button>
                      <button 
                        onClick={() => {
                          setEditingIndex(null);
                          setEditingDescription("");
                        }}
                        className="btn-secondary"
                        style={{ fontSize: "0.8rem", padding: "0.3rem 0.8rem" }}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <div 
                    style={{ 
                      fontSize: "0.9rem", 
                      lineHeight: 1.6,
                      cursor: "pointer",
                      padding: "var(--space-2)",
                      background: "var(--card)",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid transparent",
                      transition: "border-color 0.2s ease",
                    }}
                    onClick={() => {
                      setEditingIndex(img.index);
                      setEditingDescription(img.description);
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = "var(--accent-soft)"}
                    onMouseLeave={(e) => e.currentTarget.style.borderColor = "transparent"}
                  >
                    {img.description}
                    <span style={{ 
                      marginLeft: "var(--space-2)", 
                      fontSize: "0.75rem", 
                      color: "var(--accent)",
                      opacity: 0.7
                    }}>
                      ✏️ 点击编辑
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 单图放大 */}
      {zoom && (
        <div
          onClick={() => setZoom(null)}
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
          <img src={zoom} alt="放大" style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: "var(--radius)" }} />
        </div>
      )}
    </div>
  );
}
