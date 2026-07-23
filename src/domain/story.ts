// The five source types a child may assign to a span of their own writing.
// The child chooses this; it is NEVER inferred automatically.
export type ReflectionSourceType =
  | "WORLD_OBSERVATION"
  | "MY_INTERPRETATION"
  | "MY_IMAGINATION"
  | "INSPIRED_BY_AI_QUESTION"
  | "AI_POSSIBILITY_MODIFIED_BY_ME";

export const REFLECTION_SOURCE_TYPES: ReflectionSourceType[] = [
  "WORLD_OBSERVATION",
  "MY_INTERPRETATION",
  "MY_IMAGINATION",
  "INSPIRED_BY_AI_QUESTION",
  "AI_POSSIBILITY_MODIFIED_BY_ME",
];

// Human-readable labels for the UI.
export const REFLECTION_SOURCE_LABELS: Record<ReflectionSourceType, string> = {
  WORLD_OBSERVATION: "World Observation",
  MY_INTERPRETATION: "My Interpretation",
  MY_IMAGINATION: "My Imagination",
  INSPIRED_BY_AI_QUESTION: "Inspired by an AI Question",
  AI_POSSIBILITY_MODIFIED_BY_ME: "AI Suggested Possibility, Modified by Me",
};

export interface StoryReflectionView {
  id: string;
  storyId: string;
  sourceType: ReflectionSourceType;
  startOffset: number;
  endOffset: number;
  selectedText: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryView {
  id: string;
  sessionId: string;
  title: string;
  body: string;
  wordCount: number;
  reflections: StoryReflectionView[];
  createdAt: Date;
  updatedAt: Date;
}
