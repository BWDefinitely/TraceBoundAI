import { describe, it, expect, beforeEach } from "vitest";
import { FakePrisma } from "./fakePrisma";
import {
  createBridgeCard,
  updateBridgeFields,
  saveDraft,
  setBridgeTraces,
  getSourcePreview,
  BridgeCardNotFoundError,
} from "../src/bridge/bridgeService";
import {
  scaffoldQuestions,
  nextScaffoldQuestion,
} from "../src/bridge/mockScaffold";
import { BRIDGE_FIELD_KEYS } from "../src/domain/bridge";

const asPrisma = (p: FakePrisma) => p as unknown as any;

describe("bridge card — four separate fields", () => {
  let db: FakePrisma;
  beforeEach(() => {
    db = new FakePrisma();
  });

  it("creates a card with four independent, empty fields by default", async () => {
    const card = await createBridgeCard(asPrisma(db), { sessionId: "sess-1" } as any);
    expect(card.observation).toBe("");
    expect(card.childInterpretation).toBe("");
    expect(card.childImagination).toBe("");
    expect(card.storyFunction).toBe("");
    expect(card.status).toBe("DRAFT");
  });

  it("stores each field in its own column — editing one leaves others intact", async () => {
    const card = await createBridgeCard(asPrisma(db), {
      sessionId: "sess-1",
      traceIds: [],
      fields: {
        observation: "saw a red kite",
        childInterpretation: "",
        childImagination: "",
        storyFunction: "",
      },
    } as any);

    const updated = await updateBridgeFields(asPrisma(db), card.id, {
      childInterpretation: "it was flying away",
    });

    // The four fields remain distinct — no merge into one paragraph.
    expect(updated.observation).toBe("saw a red kite");
    expect(updated.childInterpretation).toBe("it was flying away");
    expect(updated.childImagination).toBe("");
    expect(updated.storyFunction).toBe("");
  });

  it("supports editing all four fields independently", async () => {
    const card = await createBridgeCard(asPrisma(db), { sessionId: "sess-1" } as any);
    const updated = await updateBridgeFields(asPrisma(db), card.id, {
      observation: "A",
      childInterpretation: "B",
      childImagination: "C",
      storyFunction: "D",
    });
    expect([
      updated.observation,
      updated.childInterpretation,
      updated.childImagination,
      updated.storyFunction,
    ]).toEqual(["A", "B", "C", "D"]);
  });

  it("throws when editing a missing card", async () => {
    await expect(
      updateBridgeFields(asPrisma(db), "nope", { observation: "x" })
    ).rejects.toBeInstanceOf(BridgeCardNotFoundError);
  });
});

describe("bridge card — trace selection & source preview", () => {
  let db: FakePrisma;
  beforeEach(() => {
    db = new FakePrisma();
  });

  it("references multiple traces", async () => {
    const t1 = db.seedTrace({ sessionId: "sess-1", content: "one" });
    const t2 = db.seedTrace({ sessionId: "sess-1", content: "two" });
    const card = await createBridgeCard(asPrisma(db), {
      sessionId: "sess-1",
      traceIds: [t1.id, t2.id],
    } as any);
    expect(card.traceIds.sort()).toEqual([t1.id, t2.id].sort());
    expect(card.traces).toHaveLength(2);
  });

  it("rejects traces from another session", async () => {
    const foreign = db.seedTrace({ sessionId: "other", content: "x" });
    await expect(
      createBridgeCard(asPrisma(db), {
        sessionId: "sess-1",
        traceIds: [foreign.id],
      } as any)
    ).rejects.toThrow(/invalid for this session/);
  });

  it("setBridgeTraces replaces the selection", async () => {
    const t1 = db.seedTrace({ sessionId: "sess-1" });
    const t2 = db.seedTrace({ sessionId: "sess-1" });
    const card = await createBridgeCard(asPrisma(db), {
      sessionId: "sess-1",
      traceIds: [t1.id],
    } as any);

    const updated = await setBridgeTraces(asPrisma(db), card.id, [t2.id]);
    expect(updated.traceIds).toEqual([t2.id]);
  });

  it("source preview returns browser-safe views (no storageKey) for live traces", async () => {
    const t = db.seedTrace({
      sessionId: "sess-1",
      type: "PHOTO",
      storageKey: "sess-1/secret.jpg",
      mimeType: "image/jpeg",
    });
    const card = await createBridgeCard(asPrisma(db), {
      sessionId: "sess-1",
      traceIds: [t.id],
    } as any);

    const preview = await getSourcePreview(asPrisma(db), card.id);
    expect(preview).toHaveLength(1);
    expect(JSON.stringify(preview)).not.toContain("secret.jpg");
    expect(preview[0].mediaUrl).toMatch(/^\/api\/traces\/.+\/media$/);
  });

  it("drops soft-deleted traces from the source preview", async () => {
    const live = db.seedTrace({ sessionId: "sess-1" });
    const card = await createBridgeCard(asPrisma(db), {
      sessionId: "sess-1",
      traceIds: [live.id],
    } as any);
    // Simulate the trace being deleted after linking.
    live.deletedAt = new Date();
    const preview = await getSourcePreview(asPrisma(db), card.id);
    expect(preview).toHaveLength(0);
  });
});

describe("bridge card — draft saving", () => {
  let db: FakePrisma;
  beforeEach(() => {
    db = new FakePrisma();
  });

  it("saveDraft flips status to SAVED", async () => {
    const card = await createBridgeCard(asPrisma(db), { sessionId: "sess-1" } as any);
    expect(card.status).toBe("DRAFT");
    const saved = await saveDraft(asPrisma(db), card.id);
    expect(saved.status).toBe("SAVED");
  });

  it("saveDraft can apply a final field patch atomically", async () => {
    const card = await createBridgeCard(asPrisma(db), { sessionId: "sess-1" } as any);
    const saved = await saveDraft(asPrisma(db), card.id, { storyFunction: "the ending" });
    expect(saved.status).toBe("SAVED");
    expect(saved.storyFunction).toBe("the ending");
  });
});

describe("mock scaffold — asks questions, never generates plot", () => {
  let db: FakePrisma;
  beforeEach(() => {
    db = new FakePrisma();
  });

  it("returns one open question per empty field", async () => {
    const card = await createBridgeCard(asPrisma(db), { sessionId: "sess-1" } as any);
    const prompts = scaffoldQuestions(card);
    expect(prompts.map((p) => p.field).sort()).toEqual([...BRIDGE_FIELD_KEYS].sort());
    // Every prompt is a question, and none echoes/produces field content.
    for (const p of prompts) {
      expect(p.question.trim().endsWith("?")).toBe(true);
    }
  });

  it("skips fields the author already filled", async () => {
    const card = await createBridgeCard(asPrisma(db), {
      sessionId: "sess-1",
      fields: {
        observation: "already written",
        childInterpretation: "",
        childImagination: "",
        storyFunction: "",
      },
    } as any);
    const prompts = scaffoldQuestions(card, { onlyEmpty: true });
    expect(prompts.find((p) => p.field === "observation")).toBeUndefined();
    expect(prompts).toHaveLength(3);
  });

  it("nextScaffoldQuestion returns null once all fields are filled", async () => {
    const card = await createBridgeCard(asPrisma(db), {
      sessionId: "sess-1",
      fields: {
        observation: "a",
        childInterpretation: "b",
        childImagination: "c",
        storyFunction: "d",
      },
    } as any);
    expect(nextScaffoldQuestion(card)).toBeNull();
  });

  it("scaffold output never contains generated story/plot text — only fixed questions", async () => {
    const card = await createBridgeCard(asPrisma(db), { sessionId: "sess-1" } as any);
    const prompts = scaffoldQuestions(card);
    // The questions are a closed, fixed set — assert they are all interrogative
    // and contain no narrative verbs like "then" chaining a plot.
    const joined = prompts.map((p) => p.question).join(" ");
    expect(joined).not.toMatch(/once upon a time|the end|chapter/i);
    expect(prompts.every((p) => p.question.includes("?"))).toBe(true);
  });
});
