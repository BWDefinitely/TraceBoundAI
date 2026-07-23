"use server";

import { prisma } from "../../lib/prisma";
import { MockAiClient } from "../../ai/aiClient";
import {
  requestTraceBoundAi,
  type AiRequestOutcome,
} from "../../ai/traceBoundAiService";
import { AiRequestInputSchema } from "../../schemas/ai";

// MVP uses the deterministic mock client. Swapping in a real provider is a
// one-line change here; the policy/service contract is unchanged.
const ai = new MockAiClient();

// Server action for the Trace-Bound AI panel. `childId` MUST come from the
// server-side session/auth, never from the client — it is the identity the
// TraceAccessPolicy checks ownership against. Wiring here is a placeholder until
// auth lands; see the note returned to callers.
export async function requestTraceBoundAiAction(
  childId: string,
  input: unknown
): Promise<AiRequestOutcome> {
  // Re-validate at the boundary (the service also parses, but failing fast here
  // keeps the error close to the request).
  AiRequestInputSchema.parse(input);
  return requestTraceBoundAi({ prisma, ai }, childId, input);
}
