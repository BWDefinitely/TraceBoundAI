import { describe, it, expect } from "vitest";
import { CREATIVE_MODES, NARRATIVE_MOVES } from "./ai-modes";

describe("CREATIVE_MODES", () => {
  it("恰好三种创意模式，且映射到合法 persona", () => {
    expect(CREATIVE_MODES.map((m) => m.mode).sort()).toEqual(
      ["build-on", "look-again", "open-up"].sort()
    );
    for (const m of CREATIVE_MODES) {
      expect(["world-witness", "story-coach", "alchemy"]).toContain(m.persona);
      expect(m.label).toBeTruthy();
      expect(m.scenario).toBeTruthy();
    }
  });

  it("Build On 由 Story Coach 支持，Open Up / Look Again 由 World Witness 支持", () => {
    const byMode = Object.fromEntries(CREATIVE_MODES.map((m) => [m.mode, m.persona]));
    expect(byMode["build-on"]).toBe("story-coach");
    expect(byMode["open-up"]).toBe("world-witness");
    expect(byMode["look-again"]).toBe("world-witness");
  });
});

describe("NARRATIVE_MOVES", () => {
  it("每条都有 id / label / scenario / question，且 id 唯一", () => {
    const ids = NARRATIVE_MOVES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const move of NARRATIVE_MOVES) {
      expect(move.label).toBeTruthy();
      expect(move.scenario).toBeTruthy();
      expect(move.question).toBeTruthy();
    }
  });

  it("包含设计文档要求的核心叙事动作", () => {
    const ids = NARRATIVE_MOVES.map((n) => n.id);
    expect(ids).toContain("plan-fails");
    expect(ids).toContain("new-clue");
  });
});
