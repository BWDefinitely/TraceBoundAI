import { describe, it, expect, beforeEach } from "vitest";
import { FakePrisma } from "./fakePrisma";
import { MockAiClient, type AiClient } from "../src/ai/aiClient";
import type { ModelPrompt } from "../src/ai/promptBuilder";
import { requestTraceBoundAi } from "../src/ai/traceBoundAiService";
import { AiResponseSchema } from "../src/schemas/ai";

const asPrisma = (p: FakePrisma) => p as unknown as any;

// A client that records every prompt it was asked to complete, so tests can
// assert exactly what did (and did not) cross the boundary. Delegates to the
// mock for a valid response body.
class SpyAiClient implements AiClient {
  prompts: ModelPrompt[] = [];
  private inner = new MockAiClient();
  async complete(prompt: ModelPrompt): Promise<unknown> {
    this.prompts.push(prompt);
    return this.inner.complete(prompt);
  }
  // Everything the client ever saw, as one string — for leak assertions.
  seenText() {
    return this.prompts.map((p) => p.text + JSON.stringify(p.traces)).join("\n");
  }
  allTraceIds() {
    return this.prompts.flatMap((p) => p.traces.map((t) => t.id));
  }
}

describe("Trace-Bound AI — policy enforced before the model", () => {
  let db: FakePrisma;
  let spy: SpyAiClient;
  beforeEach(() => {
    db = new FakePrisma();
    db.seedSession({ id: "sess-1", childId: "child-1", status: "ACTIVE" });
    spy = new SpyAiClient();
  });

  const run = (selectedTraceIds: string[], childId = "child-1") =>
    requestTraceBoundAi({ prisma: asPrisma(db), ai: spy }, childId, {
      sessionId: "sess-1",
      selectedTraceIds,
      prompt: "What do these mean?",
    });

  it("sends only authorized, explicitly-selected traces to the model", async () => {
    const a = db.seedTrace({ sessionId: "sess-1", aiAccessAllowed: true, content: "A" });
    const b = db.seedTrace({ sessionId: "sess-1", aiAccessAllowed: true, content: "B" });

    const out = await run([a.id, b.id]);
    expect(out.ok).toBe(true);
    expect(spy.allTraceIds().sort()).toEqual([a.id, b.id].sort());
  });

  it("UNSELECTED traces never reach the prompt", async () => {
    const selected = db.seedTrace({ sessionId: "sess-1", aiAccessAllowed: true, content: "SELECTED" });
    const unselected = db.seedTrace({
      sessionId: "sess-1",
      aiAccessAllowed: true,
      content: "UNSELECTED-SECRET",
    });

    const out = await run([selected.id]); // only select the first
    expect(out.ok).toBe(true);
    expect(spy.allTraceIds()).toEqual([selected.id]);
    expect(spy.allTraceIds()).not.toContain(unselected.id);
    expect(spy.seenText()).not.toContain("UNSELECTED-SECRET");
  });

  it("REVOKED traces (aiAccessAllowed=false) are denied and never reach the model", async () => {
    const ok = db.seedTrace({ sessionId: "sess-1", aiAccessAllowed: true, content: "OK" });
    const revoked = db.seedTrace({
      sessionId: "sess-1",
      aiAccessAllowed: false,
      content: "REVOKED-SECRET",
    });

    const out = await run([ok.id, revoked.id]);
    expect(out.ok).toBe(false);
    if (!out.ok && out.reason === "ACCESS_DENIED") {
      expect(out.violations.map((v) => v.reason)).toContain("TRACE_AI_ACCESS_DENIED");
    } else {
      throw new Error("expected ACCESS_DENIED");
    }
    // Fail-closed: because one trace was denied, NOTHING was sent — not even OK.
    expect(spy.prompts).toHaveLength(0);
    expect(spy.seenText()).not.toContain("REVOKED-SECRET");
    expect(spy.seenText()).not.toContain("OK");
  });

  it("DELETED traces are denied and never reach the model", async () => {
    const deleted = db.seedTrace({
      sessionId: "sess-1",
      aiAccessAllowed: true,
      deletedAt: new Date(),
      content: "DELETED-SECRET",
    });

    const out = await run([deleted.id]);
    expect(out.ok).toBe(false);
    if (!out.ok && out.reason === "ACCESS_DENIED") {
      expect(out.violations.map((v) => v.reason)).toContain("TRACE_DELETED");
    } else {
      throw new Error("expected ACCESS_DENIED");
    }
    expect(spy.prompts).toHaveLength(0);
    expect(spy.seenText()).not.toContain("DELETED-SECRET");
  });

  it("traces from another child's session are denied", async () => {
    const t = db.seedTrace({ sessionId: "sess-1", aiAccessAllowed: true, content: "X" });
    const out = await run([t.id], "child-999"); // wrong owner
    expect(out.ok).toBe(false);
    expect(spy.prompts).toHaveLength(0);
  });

  it("prompt carries textual metadata only — never storageKey or media", async () => {
    const photo = db.seedTrace({
      sessionId: "sess-1",
      type: "PHOTO",
      aiAccessAllowed: true,
      content: "a red kite",
      storageKey: "sess-1/secret-file.jpg",
      mimeType: "image/jpeg",
    });

    await run([photo.id]);
    const seen = spy.seenText();
    expect(seen).toContain("a red kite"); // caption is textual metadata -> allowed
    expect(seen).toContain("PHOTO"); // type is metadata -> allowed
    expect(seen).not.toContain("secret-file.jpg"); // storageKey -> never
    expect(seen).not.toContain("image/jpeg"); // mime -> not included
  });

  it("records an audit AiRequest with exactly the authorized traces", async () => {
    const a = db.seedTrace({ sessionId: "sess-1", aiAccessAllowed: true });
    const b = db.seedTrace({ sessionId: "sess-1", aiAccessAllowed: true });
    const out = await run([a.id, b.id]);
    expect(out.ok).toBe(true);
    expect(db.aiRequests).toHaveLength(1);
    const linked = db.aiRequestTraces.map((l) => l.traceId).sort();
    expect(linked).toEqual([a.id, b.id].sort());
  });
});

describe("Trace-Bound AI — response validation", () => {
  let db: FakePrisma;
  beforeEach(() => {
    db = new FakePrisma();
    db.seedSession();
  });

  it("rejects a response that references an unauthorized trace id", async () => {
    const t = db.seedTrace({ sessionId: "sess-1", aiAccessAllowed: true });

    const liar: AiClient = {
      async complete() {
        return {
          basedOnTraceIds: ["trace-i-was-never-given"],
          recognizedObservations: [],
          recognizedChildInterpretations: [],
          aiPossibilities: [],
          questionsForChild: [],
          boundaryReminder: "these are suggestions",
        };
      },
    };

    const out = await requestTraceBoundAi({ prisma: asPrisma(db), ai: liar }, "child-1", {
      sessionId: "sess-1",
      selectedTraceIds: [t.id],
      prompt: "hi",
    });
    expect(out.ok).toBe(false);
    if (!out.ok && out.reason === "INVALID_RESPONSE") {
      expect(out.detail).toMatch(/unauthorized traces/);
    } else {
      throw new Error("expected INVALID_RESPONSE");
    }
    // A bad response is not persisted.
    expect(db.aiRequests).toHaveLength(0);
  });

  it("rejects a malformed response missing boundaryReminder", async () => {
    const t = db.seedTrace({ sessionId: "sess-1", aiAccessAllowed: true });
    const bad: AiClient = {
      async complete() {
        return { basedOnTraceIds: [], recognizedObservations: [] }; // missing required field
      },
    };
    const out = await requestTraceBoundAi({ prisma: asPrisma(db), ai: bad }, "child-1", {
      sessionId: "sess-1",
      selectedTraceIds: [t.id],
      prompt: "hi",
    });
    expect(out.ok).toBe(false);
    expect(out.ok ? "" : out.reason).toBe("INVALID_RESPONSE");
  });

  it("mock client output satisfies the required schema shape", async () => {
    const t = db.seedTrace({ sessionId: "sess-1", aiAccessAllowed: true });
    const out = await requestTraceBoundAi(
      { prisma: asPrisma(db), ai: new MockAiClient() },
      "child-1",
      { sessionId: "sess-1", selectedTraceIds: [t.id], prompt: "hi" }
    );
    expect(out.ok).toBe(true);
    if (out.ok) {
      // The persisted/returned response validates against the exact schema.
      expect(AiResponseSchema.safeParse(out.response).success).toBe(true);
      expect(Object.keys(out.response).sort()).toEqual(
        [
          "aiPossibilities",
          "basedOnTraceIds",
          "boundaryReminder",
          "questionsForChild",
          "recognizedChildInterpretations",
          "recognizedObservations",
        ].sort()
      );
    }
  });
});
