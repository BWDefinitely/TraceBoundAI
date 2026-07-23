import { describe, it, expect, beforeEach } from "vitest";
import { FakePrisma } from "./fakePrisma";
import {
  setAiAccess,
  setHidden,
  setIncludeInStory,
  editTrace,
  TraceNotFoundError,
} from "../src/library/myWorldLibraryService";

// The service is typed against PrismaClient; the fake implements the used subset.
const asPrisma = (p: FakePrisma) => p as unknown as any;

describe("permission changes", () => {
  let db: FakePrisma;
  beforeEach(() => {
    db = new FakePrisma();
  });

  it("grants AI access and records AI_ACCESS_GRANTED", async () => {
    const t = db.seedTrace({ aiAccessAllowed: false });
    const view = await setAiAccess(asPrisma(db), t.id, true);

    expect(view.aiAccessAllowed).toBe(true);
    const events = db.auditFor(t.id).map((e) => e.action);
    expect(events).toContain("AI_ACCESS_GRANTED");
  });

  it("revoking AI access records AI_ACCESS_REVOKED", async () => {
    const t = db.seedTrace({ aiAccessAllowed: true });
    await setAiAccess(asPrisma(db), t.id, false);
    expect(db.auditFor(t.id).map((e) => e.action)).toContain("AI_ACCESS_REVOKED");
  });

  it("does NOT audit when the flag is unchanged (no-op)", async () => {
    const t = db.seedTrace({ aiAccessAllowed: true });
    await setAiAccess(asPrisma(db), t.id, true); // already true
    expect(db.auditFor(t.id)).toHaveLength(0);
  });

  it("hide/unhide records HIDDEN then UNHIDDEN", async () => {
    const t = db.seedTrace({ hidden: false });
    await setHidden(asPrisma(db), t.id, true);
    await setHidden(asPrisma(db), t.id, false);
    const actions = db.auditFor(t.id).map((e) => e.action);
    expect(actions).toEqual(["HIDDEN", "UNHIDDEN"]);
  });

  it("story inclusion toggles record STORY_INCLUDED / STORY_EXCLUDED", async () => {
    const t = db.seedTrace({ includeInStory: false });
    await setIncludeInStory(asPrisma(db), t.id, true);
    await setIncludeInStory(asPrisma(db), t.id, false);
    expect(db.auditFor(t.id).map((e) => e.action)).toEqual([
      "STORY_INCLUDED",
      "STORY_EXCLUDED",
    ]);
  });

  it("editing content records EDITED only when changed", async () => {
    const t = db.seedTrace({ content: "old" });
    await editTrace(asPrisma(db), t.id, "old"); // no change
    expect(db.auditFor(t.id)).toHaveLength(0);

    await editTrace(asPrisma(db), t.id, "new");
    expect(db.auditFor(t.id).map((e) => e.action)).toContain("EDITED");
  });

  it("audit detail captures the from/to transition", async () => {
    const t = db.seedTrace({ aiAccessAllowed: false });
    await setAiAccess(asPrisma(db), t.id, true);
    const evt = db.auditFor(t.id)[0];
    expect(JSON.parse(evt.detail!)).toMatchObject({
      field: "aiAccessAllowed",
      from: false,
      to: true,
    });
  });

  it("throws on a missing trace", async () => {
    await expect(setHidden(asPrisma(db), "nope", true)).rejects.toBeInstanceOf(
      TraceNotFoundError
    );
  });

  it("refuses to mutate a soft-deleted trace", async () => {
    const t = db.seedTrace({ deletedAt: new Date() });
    await expect(setAiAccess(asPrisma(db), t.id, true)).rejects.toBeInstanceOf(
      TraceNotFoundError
    );
  });
});
