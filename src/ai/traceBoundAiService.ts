import type { PrismaClient } from "@prisma/client";
import type { AiClient } from "./aiClient";
import { buildModelPrompt, type ModelPrompt } from "./promptBuilder";
import { evaluateTraceAccess } from "../policy/traceAccessPolicy";
import { AiRequestInputSchema, AiResponseSchema, type AiResponse } from "../schemas/ai";
import type { TraceRejection } from "../domain/types";

// Outcome of a Trace-Bound AI request. Fail-closed: unless `ok` is true, nothing
// was sent to the model (ACCESS_DENIED) or the model's reply was unusable.
export type AiRequestOutcome =
  | { ok: true; response: AiResponse; requestId: string }
  | { ok: false; reason: "ACCESS_DENIED"; violations: TraceRejection[] }
  | { ok: false; reason: "INVALID_RESPONSE"; detail: string };

export interface TraceBoundAiDeps {
  prisma: PrismaClient;
  ai: AiClient;
}

/**
 * The single entry point for asking the AI about traces.
 *
 * Order is load-bearing:
 *   1. Validate the request shape (Zod).
 *   2. Enforce TraceAccessPolicy on the SERVER. If any selected trace is not
 *      authorized (unselected-for-this-request is impossible by construction;
 *      revoked/deleted/foreign/other-session are rejected), we return
 *      ACCESS_DENIED and NEVER build a prompt or call the model.
 *   3. Build the prompt from ONLY the policy-approved traces' textual metadata.
 *   4. Call the model, validate its response against the schema.
 *   5. Cross-check basedOnTraceIds ⊆ authorized ids (defense-in-depth).
 *   6. Persist an audit record of exactly which traces crossed the boundary.
 */
export async function requestTraceBoundAi(
  deps: TraceBoundAiDeps,
  childId: string,
  rawInput: unknown
): Promise<AiRequestOutcome> {
  const { prisma, ai } = deps;
  const input = AiRequestInputSchema.parse(rawInput);

  // --- GATE: server-side policy enforcement, before anything reaches the AI ---
  const access = await evaluateTraceAccess(prisma, {
    childId,
    sessionId: input.sessionId,
    selectedTraceIds: input.selectedTraceIds,
  });

  if (!access.ok) {
    // No prompt is built, no model call is made. The content of denied traces
    // never leaves the database.
    return { ok: false, reason: "ACCESS_DENIED", violations: access.violations };
  }

  const authorizedIds = new Set(access.traces.map((t) => t.id));

  // --- Build prompt from authorized textual metadata only ---
  const prompt: ModelPrompt = buildModelPrompt(access.traces, input.prompt);

  // --- Call model + validate untrusted response ---
  const raw = await ai.complete(prompt);
  const parsed = AiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, reason: "INVALID_RESPONSE", detail: parsed.error.message };
  }

  // Defense-in-depth: the model must not reference any trace we didn't authorize.
  const strayIds = parsed.data.basedOnTraceIds.filter((id) => !authorizedIds.has(id));
  if (strayIds.length > 0) {
    return {
      ok: false,
      reason: "INVALID_RESPONSE",
      detail: `response references unauthorized traces: ${strayIds.join(", ")}`,
    };
  }

  // --- Persist audit: exactly which traces crossed the boundary ---
  const record = await prisma.aiRequest.create({
    data: {
      sessionId: input.sessionId,
      prompt: prompt.text,
      response: JSON.stringify(parsed.data),
      traces: {
        create: access.traces.map((t) => ({ traceId: t.id })),
      },
    },
  });

  return { ok: true, response: parsed.data, requestId: record.id };
}
