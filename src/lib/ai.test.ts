import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const TMP = path.join(os.tmpdir(), `tracebound-ai-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
process.env.TRACEBOUND_HOME = TMP;
// 确保用本地 mock provider，不打真实 API。
process.env.AI_PROVIDER = "mock";

const store = await import("./store");
const ai = await import("./ai");

beforeAll(async () => {
  await fs.mkdir(TMP, { recursive: true });
});

afterAll(async () => {
  await fs.rm(TMP, { recursive: true, force: true });
});

beforeEach(async () => {
  await store.saveAiSettings({ provider: "mock", condition: "trace-bound" });
});

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
    await store.saveAiSettings({ provider: "mock", condition: "trace-bound" });
    const reply = await ai.askAgent({
      persona: "world-witness",
      mode: "open-up",
      userPrompt: "帮我想想",
      context: { traces: [fakeTrace("t1", "photo")] },
    });
    expect(reply.startsWith("基于 P1")).toBe(true);
  });

  it("topic-based：不使用痕迹代号，改为引用孩子当前写下的内容", async () => {
    await store.saveAiSettings({ provider: "mock", condition: "topic-based" });
    const reply = await ai.askAgent({
      persona: "world-witness",
      mode: "open-up",
      userPrompt: "帮我想想",
      context: {
        traces: [fakeTrace("t1", "photo")],
        ideas: [
          {
            id: "i1",
            content: "神秘地点",
            sourceKind: "ai-inspired",
            sourceTraceIds: [],
            origin: "ai-direction",
            decision: "keep",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
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
    await store.saveAiSettings({ provider: "mock", condition: "topic-based" });
    const reply = await ai.askAgent({
      persona: "world-witness",
      mode: "open-up",
      userPrompt: "帮我想想",
      context: { traces: [fakeTrace("t1", "photo")] },
    });
    expect(reply.includes("基于")).toBe(false);
  });

  it("多条 trace 的来源标签按 media 前缀与顺序编号", async () => {
    await store.saveAiSettings({ provider: "mock", condition: "trace-bound" });
    const reply = await ai.askAgent({
      persona: "story-coach",
      userPrompt: "继续",
      context: { traces: [fakeTrace("t1", "photo"), fakeTrace("t2", "audio")] },
    });
    // P1 = 第一条 photo，S2 = 第二条 audio
    expect(reply.startsWith("基于 P1 和 S2")).toBe(true);
  });
});
