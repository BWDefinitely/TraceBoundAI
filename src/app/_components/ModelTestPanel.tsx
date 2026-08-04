"use client";

import { useState } from "react";
import { getAiSettings } from "../../lib/client-store";
import { askAgent, readImage, generateImage, isMockFallbackText, isMockFallbackBlob } from "../../lib/ai";

type TestStatus = "idle" | "testing" | "success" | "error";

export function ModelTestPanel() {
  const [mainStatus, setMainStatus] = useState<TestStatus>("idle");
  const [mainResult, setMainResult] = useState("");

  const [visionStatus, setVisionStatus] = useState<TestStatus>("idle");
  const [visionResult, setVisionResult] = useState("");

  const [imageGenStatus, setImageGenStatus] = useState<TestStatus>("idle");
  const [imageGenResult, setImageGenResult] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  // 测试主模型
  async function testMainModel() {
    setMainStatus("testing");
    setMainResult("");
    try {
      const settings = await getAiSettings();
      const reply = await askAgent({
        persona: "story-coach",
        userPrompt: "请用一句话回答：你是谁？",
        settings,
      });
      // 真实模型失败时 askAgent 会静默回退到本地模拟，这里需要识别出来并如实报错
      if (isMockFallbackText(reply)) {
        setMainResult(
          `❌ 失败：真实模型调用失败，以下内容为本地模拟兜底，并非模型回复。\n请检查 API Key、Base URL 与网络后重试。\n\n${reply}`
        );
        setMainStatus("error");
        return;
      }
      setMainResult(`✅ 成功！模型回复：\n${reply}`);
      setMainStatus("success");
    } catch (err) {
      setMainResult(`❌ 失败：${(err as Error).message}`);
      setMainStatus("error");
    }
  }

  // 测试读图模型
  async function testVisionModel() {
    setVisionStatus("testing");
    setVisionResult("");
    try {
      const settings = await getAiSettings();
      // 创建一个简单的测试图片（1x1 红色像素）
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "red";
      ctx.fillRect(0, 0, 1, 1);
      
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png");
      });

      const description = await readImage(blob, settings);
      // 读图失败时 readImage 会静默回退到本地模拟，识别并如实报错
      if (isMockFallbackText(description)) {
        setVisionResult(
          `❌ 失败：真实读图模型调用失败，以下内容为本地模拟兜底，并非模型描述。\n请检查 Vision 配置后重试。\n\n${description}`
        );
        setVisionStatus("error");
        return;
      }
      setVisionResult(`✅ 成功！模型描述：\n${description}`);
      setVisionStatus("success");
    } catch (err) {
      setVisionResult(`❌ 失败：${(err as Error).message}`);
      setVisionStatus("error");
    }
  }

  // 测试生图模型
  async function testImageGenModel() {
    setImageGenStatus("testing");
    setImageGenResult("");
    if (generatedImageUrl) {
      URL.revokeObjectURL(generatedImageUrl);
      setGeneratedImageUrl(null);
    }
    try {
      const settings = await getAiSettings();
      const config = {
        provider: settings.imageGeneration.provider,
        model: settings.imageGeneration.model,
        baseUrl: settings.imageGeneration.baseUrl,
        hasApiKey: !!settings.imageGeneration.apiKey,
      };
      console.log("[测试生图] 配置:", config);
      
      // 判断实际会使用哪个 provider
      let actualProvider = "mock";
      if (config.provider === "custom" && config.baseUrl) {
        actualProvider = "custom";
      } else if (config.provider === "dall-e-3" && config.hasApiKey) {
        actualProvider = "dall-e-3";
      } else if (settings.provider === "openai-compat" && settings.openaiCompat.apiKey) {
        actualProvider = "dall-e-3 (fallback)";
      }
      
      console.log("[测试生图] 实际使用provider:", actualProvider);
      setImageGenResult(`🔄 正在调用 ${actualProvider}...`);
      
      const blob = await generateImage("一个简单的红色圆圈", settings);
      console.log("[测试生图] 成功，blob大小:", blob.size, "类型:", blob.type);

      // 真实生图失败时 generateImage 会静默回退到本地 1x1 占位图，识别并如实报错
      const isMockBlob = await isMockFallbackBlob(blob);
      if (isMockBlob && actualProvider !== "mock") {
        const url = URL.createObjectURL(blob);
        setGeneratedImageUrl(url);
        setImageGenResult(
          `❌ 失败：生图模型调用失败，返回的是本地模拟占位图（1x1）。\n请检查生图配置（Base URL / API Key）后重试。`
        );
        setImageGenStatus("error");
        return;
      }

      const url = URL.createObjectURL(blob);
      setGeneratedImageUrl(url);
      setImageGenResult(`✅ 成功！使用 ${actualProvider} 生成图片 (${(blob.size / 1024).toFixed(1)} KB)`);
      setImageGenStatus("success");
    } catch (err) {
      console.error("[测试生图] 失败:", err);
      setImageGenResult(`❌ 失败：${(err as Error).message}`);
      setImageGenStatus("error");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      {/* 主模型测试 */}
      <section className="card" style={{ padding: "var(--space-4)" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-3)" }}>🤖 主模型测试</h3>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "var(--space-3)" }}>
          测试对话模型是否正常工作（Anthropic / OpenAI 兼容）
        </p>
        <button
          onClick={testMainModel}
          disabled={mainStatus === "testing"}
          className="btn-secondary"
          style={{ marginBottom: "var(--space-3)" }}
        >
          {mainStatus === "testing" ? "测试中..." : "开始测试"}
        </button>
        {mainResult && (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "0.85rem",
              padding: "var(--space-3)",
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              color: mainStatus === "error" ? "var(--danger)" : "var(--ink)",
            }}
          >
            {mainResult}
          </pre>
        )}
      </section>

      {/* 读图模型测试 */}
      <section className="card" style={{ padding: "var(--space-4)" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-3)" }}>👁️ 读图模型测试</h3>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "var(--space-3)" }}>
          测试 Vision 模型是否能够读取并描述图片
        </p>
        <button
          onClick={testVisionModel}
          disabled={visionStatus === "testing"}
          className="btn-secondary"
          style={{ marginBottom: "var(--space-3)" }}
        >
          {visionStatus === "testing" ? "测试中..." : "开始测试"}
        </button>
        {visionResult && (
          <pre
            style={{
              whiteSpace: "pre-wrap",
              fontSize: "0.85rem",
              padding: "var(--space-3)",
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              color: visionStatus === "error" ? "var(--danger)" : "var(--ink)",
            }}
          >
            {visionResult}
          </pre>
        )}
      </section>

      {/* 生图模型测试 */}
      <section className="card" style={{ padding: "var(--space-4)" }}>
        <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-3)" }}>🎨 生图模型测试</h3>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "var(--space-3)" }}>
          测试图片生成模型是否正常工作（DALL-E 3 / 自定义）
        </p>
        <button
          onClick={testImageGenModel}
          disabled={imageGenStatus === "testing"}
          className="btn-secondary"
          style={{ marginBottom: "var(--space-3)" }}
        >
          {imageGenStatus === "testing" ? "测试中..." : "开始测试"}
        </button>
        {imageGenResult && (
          <div>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontSize: "0.85rem",
                padding: "var(--space-3)",
                background: "var(--surface)",
                borderRadius: "var(--radius)",
                color: imageGenStatus === "error" ? "var(--danger)" : "var(--ink)",
                marginBottom: "var(--space-3)",
              }}
            >
              {imageGenResult}
            </pre>
            {generatedImageUrl && (
              <div style={{ maxWidth: 300, borderRadius: "var(--radius)", overflow: "hidden", border: "1px solid var(--line)" }}>
                <img src={generatedImageUrl} alt="生成的测试图片" style={{ width: "100%", height: "auto" }} />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
