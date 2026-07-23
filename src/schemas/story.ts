import { z } from "zod";
import { REFLECTION_SOURCE_TYPES } from "../domain/story";

const TITLE_MAX = 200;
const BODY_MAX = 100_000; // generous ceiling for a plain-text story

export const CreateStorySchema = z.object({
  sessionId: z.string().min(1),
  title: z.string().max(TITLE_MAX).default(""),
  body: z.string().max(BODY_MAX).default(""),
});
export type CreateStoryInput = z.infer<typeof CreateStorySchema>;

// Save (manual and autosave use the same shape). Both title and body optional so
// a save can touch just one; at least one must be present.
export const SaveStorySchema = z
  .object({
    title: z.string().max(TITLE_MAX).optional(),
    body: z.string().max(BODY_MAX).optional(),
  })
  .refine((o) => o.title !== undefined || o.body !== undefined, "nothing to save");
export type SaveStoryInput = z.infer<typeof SaveStorySchema>;

// Associate a selected span with a source type. The child supplies the type —
// there is no default and no server-side inference.
export const CreateReflectionSchema = z
  .object({
    storyId: z.string().min(1),
    sourceType: z.enum(
      REFLECTION_SOURCE_TYPES as [string, ...string[]]
    ),
    startOffset: z.number().int().min(0),
    endOffset: z.number().int().min(0),
    selectedText: z.string().min(1).max(BODY_MAX),
    note: z.string().max(2000).default(""),
  })
  .refine((o) => o.endOffset > o.startOffset, "empty selection range");
export type CreateReflectionInput = z.infer<typeof CreateReflectionSchema>;

// Update an existing reflection's type/note (child may re-account for a span).
export const UpdateReflectionSchema = z
  .object({
    sourceType: z
      .enum(REFLECTION_SOURCE_TYPES as [string, ...string[]])
      .optional(),
    note: z.string().max(2000).optional(),
  })
  .refine((o) => o.sourceType !== undefined || o.note !== undefined, "nothing to update");
export type UpdateReflectionInput = z.infer<typeof UpdateReflectionSchema>;
