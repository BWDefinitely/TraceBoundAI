import { describe, it, expect } from "vitest";
import type { AiSettings } from "./ai-settings";

const ai = await import("./ai");

// 纯前端 AI 层：settings 由调用方传入。这里构造 mock provider 的设置，
// 避免打真实 API。
function mockSettings(): AiSettings {
  return {
    provider: "mock",
    anthropic: { apiKey: "", model: "claude-opus-4-8", baseUrl: "" },
    openaiCompat: { apiKey: "", model: "", baseUrl: "" },
    vision: { provider: "anthropic", apiKey: "", model: "claude-3-5-sonnet-20241022", baseUrl: "" },
    imageGeneration: { provider: "dall-e-3", apiKey: "", model: "dall-e-3", baseUrl: "" },
  };
}

function fakeTrace(id: string, mediaKind: "photo" | "audio" | "text") {
  return {
    id,
    title: `素材 ${id}`,
    kind: "观察" as const,
    tags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    favorite: false,
    iNoticed: "我注意到了一些东西",
    itRemindsMe: "让我想到一扇门",
    stillUnsure: "",
    aiAllowed: true,
    mediaKind,
  };
}

describe("askAgent 基础功能", () => {
  it("trace 时回应包含来源标签", async () => {
    const reply = await ai.askAgent({
      persona: "world-witness",
      mode: "open-up",
      userPrompt: "帮我想想",
      settings: mockSettings(),
      context: { traces: [fakeTrace("t1", "photo")] },
    });
    expect(reply.startsWith("基于 P1")).toBe(true);
  });

  it("多条 trace 的来源标签按 media 前缀与顺序编号", async () => {
    const reply = await ai.askAgent({
      persona: "story-coach",
      userPrompt: "继续",
      settings: mockSettings(),
      context: { traces: [fakeTrace("t1", "photo"), fakeTrace("t2", "audio")] },
    });
    // P1 = 第一条 photo，S2 = 第二条 audio
    expect(reply.startsWith("基于 P1 和 S2")).toBe(true);
  });
});
