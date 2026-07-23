import { z } from "zod";

// --- AI INPUT --------------------------------------------------------------
// What the client is allowed to send toward an AI request. Note: the client
// sends only IDs + a prompt. It never sends trace content, aiAccessAllowed, or
// deleted state — the server loads those and the policy decides.

export const AiRequestInputSchema = z.object({
  sessionId: z.string().min(1),
  // The child's explicit selection. Must be non-empty and unique.
  selectedTraceIds: z
    .array(z.string().min(1))
    .min(1, "at least one trace must be explicitly selected")
    .max(50)
    .refine((ids) => new Set(ids).size === ids.length, "duplicate trace ids"),
  prompt: z.string().min(1).max(4000),
});

export type AiRequestInput = z.infer<typeof AiRequestInputSchema>;

// --- AI OUTPUT -------------------------------------------------------------
// The model's response is untrusted. It is parsed/validated against this schema
// before use and is never executed. The structure keeps the AI's contribution
// in clearly separated categories so the UI can render each on its own — and so
// AI "possibilities" stay visibly distinct from the child's own observations.
//
// `basedOnTraceIds` lets us verify the model only references traces we actually
// authorized (defense-in-depth: the service cross-checks these against the
// policy-approved set and rejects the response if it names anything else).

const line = z.string().min(1).max(1000);

export const AiResponseSchema = z.object({
  basedOnTraceIds: z.array(z.string().min(1)).max(50).default([]),
  recognizedObservations: z.array(line).max(50).default([]),
  recognizedChildInterpretations: z.array(line).max(50).default([]),
  aiPossibilities: z.array(line).max(50).default([]),
  questionsForChild: z.array(line).max(50).default([]),
  boundaryReminder: z.string().min(1).max(2000),
});

export type AiResponse = z.infer<typeof AiResponseSchema>;
