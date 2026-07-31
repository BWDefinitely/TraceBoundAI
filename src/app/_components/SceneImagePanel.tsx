"use client";

import { useState, useEffect } from "react";
import type { Story } from "../../lib/store";
import { generateImage } from "../../lib/ai";
import { getAiSettings, saveMediaBlob, getMediaBlob } from "../../lib/client-store";
import { saveStoryAction, askAgentAction } from "../_actions";

interface Props {
  story: Story;
  storyBody: string;
}

// 场景生图面板：点击后 AI 根据已写内容自动生成 1-4 张 1:1 图片。
// 支持多图预览和单图点击放大。
export function SceneImagePanel({ story, storyBody }: Props) {
  const [generating, setGenerating] = useState(false);
  const [images, setImages] = useState<{ url: string; prompt: string }[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const [count, setCount] = useState(2);

  // 加载已有场景图
  useEffect(() => {
    let revoked: string[] = [];
    (async () => {
      const existing = story.sceneImages ?? [];
      const loaded: { url: string; prompt: string }[] = [];
      for (const img of existing) {
        const blob = await getMediaBlob(img.blobId);
        if (blob) {
          const url = URL.createObjectURL(blob);
          revoked.push(url);
          loaded.push({ url, prompt: img.prompt });
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
  async function buildScenePrompts(numScenes: number): Promise<string[]> {
    const text = storyBody.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!text) {
      return [`儿童绘本插画风格，1:1 正方形构图，温暖明亮的色彩，描绘：${story.metadata.place || "一个场景"}`];
    }

    // 构建风格描述：根据故事元数据和已写内容
    const styleContext = buildStyleContext();

    try {
      const res = await askAgentAction({
        persona: "story-coach",
        userPrompt:
          `请阅读下面的故事内容，拆解成 ${numScenes} 个不同的关键场景，每个场景用一句话描述（30字内），` +
          `分别编号「1.」「2.」「3.」「4.」开头，适合画成儿童绘本插画。只给场景描述，不要额外解释。\n\n故事：${text.slice(0, 600)}`,
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
      prompts.push(`${styleContext}，描绘如下故事场景：${snippet}`);
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
    if (!text) {
      alert("先写点故事内容，我才能画出场景哦～");
      return;
    }
    setGenerating(true);
    try {
      const settings = await getAiSettings();
      const prompts = await buildScenePrompts(count);
      
      // 确保生成的数量等于用户选择的数量
      const actualCount = Math.min(count, prompts.length);
      console.log(`[SceneImagePanel] 将生成 ${actualCount} 张图片`);
      
      const newImages: { url: string; prompt: string }[] = [];
      const newRecords = [...(story.sceneImages ?? [])];
      
      for (let i = 0; i < actualCount; i++) {
        const prompt = prompts[i];
        console.log(`[SceneImagePanel] 生成第 ${i + 1}/${actualCount} 张，prompt:`, prompt);
        const blob = await generateImage(prompt, settings);
        const blobId = `scene-${Date.now()}-${i}`;
        await saveMediaBlob(blobId, blob);
        newRecords.push({ blobId, prompt, createdAt: new Date().toISOString() });
        newImages.push({ url: URL.createObjectURL(blob), prompt });
      }
      
      await saveStoryAction(story.id, { sceneImages: newRecords });
      setImages((prev) => [...prev, ...newImages]);
    } catch (err) {
      console.error("[SceneImagePanel] 生成失败:", err);
      alert("生成失败：" + (err as Error).message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: "1.05rem", margin: 0 }}>🎨 场景生图</h3>
        <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>已生成 {images.length} 张</span>
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
        <label style={{ fontSize: "0.85rem" }}>生成数量</label>
        <select value={count} onChange={(e) => setCount(Number(e.target.value))} disabled={generating}>
          {[1, 2, 3, 4].map((n) => (
            <option key={n} value={n}>{n} 张</option>
          ))}
        </select>
        <button className="btn-primary" onClick={handleGenerate} disabled={generating} style={{ flex: 1 }}>
          {generating ? "AI 绘制中..." : "根据故事生成场景图"}
        </button>
      </div>

      {images.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: "var(--space-3)" }}>
          {images.map((img, i) => (
            <div
              key={i}
              onClick={() => setZoom(img.url)}
              style={{
                aspectRatio: "1 / 1",
                borderRadius: "var(--radius)",
                overflow: "hidden",
                border: "1px solid var(--line)",
                cursor: "zoom-in",
              }}
            >
              <img src={img.url} alt={`场景 ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
