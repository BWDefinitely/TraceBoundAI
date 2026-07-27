import { describe, it, expect } from "vitest";
import type { AiSettings } from "./ai-settings";

const ai = await import("./ai");

// 纯前端 AI 层：settings 由调用方传入。这里构造 mock provider 的设置，
// 避免打真实 API。
function mockSettings(condition: "trace-bound" | "topic-based"): AiSettings {
  return {
    provider: "mock",
    condition,
    anthropic: { apiKey: "", model: "claude-opus-4-8", baseUrl: "" },
    openaiCompat: { apiKey: "", model: "", baseUrl: "" },
  };
}

function fakeTrace(id: string, mediaKind: "photo" | "audio" | "text") {
  return {
    id,
    title: `素材 ${id}`,
    kind: "画面" as const,
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

describe("askAgent 实验条件门控", () => {
  it("trace-bound：带 photo trace 时回应以「基于 P1」来源标签开头", async () => {
    const reply = await ai.askAgent({
      persona: "world-witness",
      mode: "open-up",
      userPrompt: "帮我想想",
      settings: mockSettings("trace-bound"),
      context: { traces: [fakeTrace("t1", "photo")] },
    });
    expect(reply.startsWith("基于 P1")).toBe(true);
  });

  it("topic-based：不使用痕迹代号，改为引用孩子当前写下的内容", async () => {
    const reply = await ai.askAgent({
      persona: "world-witness",
      mode: "open-up",
      userPrompt: "帮我想想",
      settings: mockSettings("topic-based"),
      context: {
        traces: [fakeTrace("t1", "photo")],
        ideas: [
          {
            id: "i1",
            content: "神秘地点",
            sourceKind: "ai-inspired",
            sourceTraceIds: [],
            sourceIdeaIds: [],
            parentAlchemyId: null,
            origin: "ai-direction",
            decision: "keep",
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    // 文档 §"Topic-Based AI 条件"：不出现 P/S/R 痕迹代号，
    // 但仍显示「基于你当前写下的…」式来源标签。
    expect(reply.includes("P1")).toBe(false);
    expect(reply.startsWith("基于你当前写下的")).toBe(true);
    expect(reply.includes("神秘地点")).toBe(true);
  });

  it("topic-based：没有 Idea Card / Shelf 时不强加标签", async () => {
    const reply = await ai.askAgent({
      persona: "world-witness",
      mode: "open-up",
      userPrompt: "帮我想想",
      settings: mockSettings("topic-based"),
      context: { traces: [fakeTrace("t1", "photo")] },
    });
    expect(reply.includes("基于")).toBe(false);
  });

  it("多条 trace 的来源标签按 media 前缀与顺序编号", async () => {
    const reply = await ai.askAgent({
      persona: "story-coach",
      userPrompt: "继续",
      settings: mockSettings("trace-bound"),
      context: { traces: [fakeTrace("t1", "photo"), fakeTrace("t2", "audio")] },
    });
    // P1 = 第一条 photo，S2 = 第二条 audio
    expect(reply.startsWith("基于 P1 和 S2")).toBe(true);
  });
});
