import { describe, it, expect, beforeEach } from "vitest";
import { FakePrisma } from "./fakePrisma";
import { countWords } from "../src/story/wordCount";
import {
  createStory,
  saveStory,
  getStory,
  StoryNotFoundError,
} from "../src/story/storyService";
import {
  createReflection,
  updateReflection,
  deleteReflection,
  listReflections,
} from "../src/story/reflectionService";
import { REFLECTION_SOURCE_TYPES } from "../src/domain/story";

const asPrisma = (p: FakePrisma) => p as unknown as any;

describe("word count", () => {
  it("counts words, ignoring extra whitespace", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("hello")).toBe(1);
    expect(countWords("  hello   world  ")).toBe(2);
    expect(countWords("one\ntwo\tthree four")).toBe(4);
  });
});

describe("story save & word count", () => {
  let db: FakePrisma;
  beforeEach(() => {
    db = new FakePrisma();
  });

  it("creates a story with derived word count", async () => {
    const s = await createStory(asPrisma(db), { sessionId: "sess-1", body: "a b c" } as any);
    expect(s.wordCount).toBe(3);
  });

  it("manual save and autosave share the same path (partial patch)", async () => {
    const s = await createStory(asPrisma(db), { sessionId: "sess-1" } as any);

    // Autosave-style: only body.
    const afterBody = await saveStory(asPrisma(db), s.id, { body: "the quick brown fox" });
    expect(afterBody.body).toBe("the quick brown fox");
    expect(afterBody.wordCount).toBe(4);
    expect(afterBody.title).toBe(""); // untouched

    // Manual-style: only title.
    const afterTitle = await saveStory(asPrisma(db), s.id, { title: "My Story" });
    expect(afterTitle.title).toBe("My Story");
    expect(afterTitle.body).toBe("the quick brown fox"); // preserved
  });

  it("word count stays consistent with the saved body", async () => {
    const s = await createStory(asPrisma(db), { sessionId: "sess-1" } as any);
    const saved = await saveStory(asPrisma(db), s.id, { body: "one two three four five" });
    const reloaded = await getStory(asPrisma(db), s.id);
    expect(saved.wordCount).toBe(5);
    expect(reloaded.wordCount).toBe(5);
  });

  it("throws when saving a missing story", async () => {
    await expect(saveStory(asPrisma(db), "nope", { body: "x" })).rejects.toBeInstanceOf(
      StoryNotFoundError
    );
  });
});

describe("source reflection — child assigns the source, never inferred", () => {
  let db: FakePrisma;
  let storyId: string;
  const body = "The kite flew over the hill and I felt free.";

  beforeEach(async () => {
    db = new FakePrisma();
    const s = await createStory(asPrisma(db), { sessionId: "sess-1", body } as any);
    storyId = s.id;
  });

  it("associates a selection with each of the five source types", async () => {
    for (const sourceType of REFLECTION_SOURCE_TYPES) {
      const r = await createReflection(asPrisma(db), {
        storyId,
        sourceType,
        startOffset: 0,
        endOffset: 8,
        selectedText: body.slice(0, 8),
      } as any);
      expect(r.sourceType).toBe(sourceType);
    }
    const all = await listReflections(asPrisma(db), storyId);
    expect(all.map((r) => r.sourceType).sort()).toEqual([...REFLECTION_SOURCE_TYPES].sort());
  });

  it("stores the exact selected span (offsets + snapshot)", async () => {
    const start = 4;
    const end = 8; // "kite"
    const r = await createReflection(asPrisma(db), {
      storyId,
      sourceType: "WORLD_OBSERVATION",
      startOffset: start,
      endOffset: end,
      selectedText: body.slice(start, end),
    } as any);
    expect(r.selectedText).toBe("kite");
    expect([r.startOffset, r.endOffset]).toEqual([4, 8]);
  });

  it("rejects a selection that doesn't match the story text (stale selection)", async () => {
    await expect(
      createReflection(asPrisma(db), {
        storyId,
        sourceType: "MY_INTERPRETATION",
        startOffset: 0,
        endOffset: 8,
        selectedText: "WRONGTEXT",
      } as any)
    ).rejects.toThrow(/does not match/);
  });

  it("rejects offsets beyond the body", async () => {
    await expect(
      createReflection(asPrisma(db), {
        storyId,
        sourceType: "MY_IMAGINATION",
        startOffset: 0,
        endOffset: body.length + 50,
        selectedText: body,
      } as any)
    ).rejects.toThrow(/outside the story body/);
  });

  it("requires a source type — schema rejects a missing/invalid one", async () => {
    await expect(
      createReflection(asPrisma(db), {
        storyId,
        startOffset: 0,
        endOffset: 8,
        selectedText: body.slice(0, 8),
      } as any)
    ).rejects.toBeTruthy();

    await expect(
      createReflection(asPrisma(db), {
        storyId,
        sourceType: "SOMETHING_AI_GUESSED",
        startOffset: 0,
        endOffset: 8,
        selectedText: body.slice(0, 8),
      } as any)
    ).rejects.toBeTruthy();
  });

  it("lets the child re-account for a span (update source type)", async () => {
    const r = await createReflection(asPrisma(db), {
      storyId,
      sourceType: "AI_POSSIBILITY_MODIFIED_BY_ME",
      startOffset: 0,
      endOffset: 3,
      selectedText: body.slice(0, 3),
    } as any);
    const updated = await updateReflection(asPrisma(db), r.id, {
      sourceType: "MY_IMAGINATION",
    });
    expect(updated.sourceType).toBe("MY_IMAGINATION");
  });

  it("deletes a reflection", async () => {
    const r = await createReflection(asPrisma(db), {
      storyId,
      sourceType: "MY_INTERPRETATION",
      startOffset: 0,
      endOffset: 3,
      selectedText: body.slice(0, 3),
    } as any);
    await deleteReflection(asPrisma(db), r.id);
    expect(await listReflections(asPrisma(db), storyId)).toHaveLength(0);
  });
});
