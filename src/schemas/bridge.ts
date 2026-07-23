import { z } from "zod";

// Per-field length ceiling. Generous, but bounded so a field can't become an
// entire story dump — the bridge holds notes, not prose.
const FIELD_MAX = 2000;

// The four bridge fields. All optional on input; each defaults to "" so a card
// can be created empty and filled incrementally. Fields are independent.
export const BridgeFieldsSchema = z.object({
  observation: z.string().max(FIELD_MAX).default(""),
  childInterpretation: z.string().max(FIELD_MAX).default(""),
  childImagination: z.string().max(FIELD_MAX).default(""),
  storyFunction: z.string().max(FIELD_MAX).default(""),
});

export type BridgeFieldsInput = z.infer<typeof BridgeFieldsSchema>;

const traceIds = z
  .array(z.string().min(1))
  .max(50)
  .refine((ids) => new Set(ids).size === ids.length, "duplicate trace ids");

// Create a card: needs a session, an optional initial trace selection, and
// optional initial field values.
export const CreateBridgeCardSchema = z.object({
  sessionId: z.string().min(1),
  traceIds: traceIds.default([]),
  fields: BridgeFieldsSchema.default({
    observation: "",
    childInterpretation: "",
    childImagination: "",
    storyFunction: "",
  }),
});

export type CreateBridgeCardInput = z.infer<typeof CreateBridgeCardSchema>;

// Update fields: a partial patch. Only provided fields are changed; others are
// left untouched. Still one field at a time is fine — they never merge.
export const UpdateBridgeFieldsSchema = BridgeFieldsSchema.partial().refine(
  (obj) => Object.keys(obj).length > 0,
  "at least one field must be provided"
);

export type UpdateBridgeFieldsInput = z.infer<typeof UpdateBridgeFieldsSchema>;

// Replace the trace selection for a card.
export const SetBridgeTracesSchema = z.object({
  traceIds,
});

export type SetBridgeTracesInput = z.infer<typeof SetBridgeTracesSchema>;
