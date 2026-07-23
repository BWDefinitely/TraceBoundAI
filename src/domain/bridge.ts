import type { TraceView } from "./types";

// The four bridge fields, kept as separate, independently-editable strings.
// They are NEVER concatenated into a single generated paragraph, and none of
// them is ever populated by AI classification.
export interface BridgeFields {
  observation: string;
  childInterpretation: string;
  childImagination: string;
  storyFunction: string;
}

// The canonical list of field keys — used by editing/validation so the four
// fields stay enumerated in exactly one place.
export const BRIDGE_FIELD_KEYS = [
  "observation",
  "childInterpretation",
  "childImagination",
  "storyFunction",
] as const;

export type BridgeFieldKey = (typeof BRIDGE_FIELD_KEYS)[number];

export type BridgeCardStatus = "DRAFT" | "SAVED";

// Browser-safe projection of a bridge card. Includes the referenced traces as
// TraceViews (no storageKey), so a card can render its own source preview.
export interface BridgeCardView extends BridgeFields {
  id: string;
  sessionId: string;
  status: BridgeCardStatus;
  traceIds: string[];
  traces: TraceView[];
  createdAt: Date;
  updatedAt: Date;
}
