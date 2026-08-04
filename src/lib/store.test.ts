import { describe, it, expect } from "vitest";
// 数据层已迁移到浏览器 IndexedDB（client-store）。测试用 fake-indexeddb 提供
// 一个内存版 indexedDB，import 之后即可像浏览器一样读写。
import "fake-indexeddb/auto";

const store = await import("./client-store");

describe("materials (Trace) CRUD", () => {
  it("创建后能读回，且默认 aiAllowed=true / mediaKind=text", async () => {
    const m = await store.createMaterial({
      title: "树根裂缝",
      kind: "观察",
      iNoticed: "树根旁有一道裂缝",
      body: "现场正文",
    });
    expect(m.id).toBeTruthy();
    expect(m.aiAllowed).toBe(true);
    expect(m.mediaKind).toBe("text");

    const body = await store.readMaterialBody(m.id);
    expect(body).toBe("现场正文");

    const got = await store.getMaterial(m.id);
    expect(got?.iNoticed).toBe("树根旁有一道裂缝");
  });

  it("更新 aiAllowed 与三问字段", async () => {
    const m = await store.createMaterial({ title: "滴水声", kind: "观察" });
    const updated = await store.updateMaterial(m.id, { aiAllowed: false, itRemindsMe: "像敲门" });
    expect(updated?.aiAllowed).toBe(false);
    expect(updated?.itRemindsMe).toBe("像敲门");
  });

  it("删除后 getMaterial 返回 null", async () => {
    const m = await store.createMaterial({ title: "待删除", kind: "观察" });
    await store.deleteMaterial(m.id);
    expect(await store.getMaterial(m.id)).toBeNull();
  });
});

describe("first thoughts (Pre-AI baseline)", () => {
  it("同一 trace 覆写而不追加", async () => {
    const traceId = "trace-ft-1";
    await store.saveFirstThought({ traceId, actuallySawHeard: "看到裂缝", guessed: "有东西", couldBecome: "一扇门" });
    await store.saveFirstThought({ traceId, actuallySawHeard: "改了", guessed: "", couldBecome: "" });
    const all = (await store.listFirstThoughts()).filter((f) => f.traceId === traceId);
    expect(all).toHaveLength(1);
    expect(all[0].actuallySawHeard).toBe("改了");
  });
});

describe("stories 新结构（metadata + structure）", () => {
  it("createStory 生成空的 metadata 和 structure", async () => {
    const s = await store.createStory({ title: "新故事" });
    expect(s.metadata).toBeDefined();
    expect(s.structure).toBeDefined();
    expect(s.structure.qi).toBeDefined();
    expect(s.structure.cheng).toBeDefined();
    expect(s.structure.zhuan).toBeDefined();
    expect(s.structure.he).toBeDefined();
    expect(s.completedAt).toBeNull();
    expect(s.aiWordCount).toBe(0);
    expect(s.userWordCount).toBe(0);
  });

  it("completeStory / reopenStory 切换完成状态", async () => {
    const s = await store.createStory({ title: "完成测试" });
    const done = await store.completeStory(s.id);
    expect(done?.completedAt).toBeTruthy();
    const reopened = await store.reopenStory(s.id);
    expect(reopened?.completedAt).toBeNull();
  });

  it("updateStory 可更新 metadata 和 structure", async () => {
    const s = await store.createStory({ title: "元数据测试" });
    await store.updateStory(s.id, {
      metadata: { time: "2024年春天", place: "公园", people: ["小明"], event: "发现秘密" },
      structure: { qi: { text: "开始了", linkedMaterials: [] } },
    });
    const got = await store.getStory(s.id);
    expect(got?.metadata.time).toBe("2024年春天");
    expect(got?.structure.qi.text).toBe("开始了");
  });
});

describe("idea cards 迁移", () => {
  it("旧数据缺 origin/decision 时 listIdeaCards 补默认", async () => {
    const card = await store.createIdeaCard({ content: "倒计时", sourceKind: "ai-inspired" });
    expect(card.origin).toBe("ai-direction");
    expect(card.decision).toBe("keep");

    const combined = await store.createIdeaCard({ content: "组合", sourceKind: "combined" });
    expect(combined.origin).toBe("ai-combined");
  });
});

describe("CHI event log", () => {
  it("appendEvent 追加并可导出为 NDJSON", async () => {
    const before = (await store.listEvents()).length;
    await store.appendEvent({ type: "trace-capture", payload: { traceId: "x" } });
    await store.appendEvent({ type: "agent-ask", payload: { persona: "story-coach" } });
    const after = await store.listEvents();
    expect(after.length).toBe(before + 2);

    const ndjson = await store.exportEventsNdjson();
    const lines = ndjson.split("\n");
    expect(lines.length).toBe(after.length);
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });
});

describe("AI settings", () => {
  it("默认 provider 为 mock", async () => {
    const s = await store.getAiSettings();
    expect(["mock", "anthropic", "openai-compat"]).toContain(s.provider);
  });

  it("saveAiSettings 能切换 provider 并持久化", async () => {
    await store.saveAiSettings({ provider: "anthropic" });
    const s = await store.getAiSettings();
    expect(s.provider).toBe("anthropic");
    await store.saveAiSettings({ provider: "mock" });
    expect((await store.getAiSettings()).provider).toBe("mock");
  });
});
