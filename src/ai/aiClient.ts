import type { ModelPrompt } from "./promptBuilder";
import type { AiResponse } from "../schemas/ai";

// The model boundary. An implementation takes a ModelPrompt (textual metadata
// only) and returns a raw, UNTRUSTED object that the service validates against
// AiResponseSchema. Keeping this an interface means the real provider can be
// swapped in without touching the policy/service logic.
export interface AiClient {
  complete(prompt: ModelPrompt): Promise<unknown>;
}

// Deterministic mock client for the MVP and tests. It reflects only the traces
// it was given (proving the service passes just the authorized set) and never
// authors a plot. Output shape matches AiResponseSchema.
export class MockAiClient implements AiClient {
  async complete(prompt: ModelPrompt): Promise<unknown> {
    const ids = prompt.traces.map((t) => t.id);

    const response: AiResponse = {
      basedOnTraceIds: ids,
      recognizedObservations: prompt.traces.map(
        (t) => `You recorded a ${t.type.toLowerCase()}: ${t.content || "(no caption)"}`
      ),
      recognizedChildInterpretations: [
        "You seem to be figuring out what these moments mean to you.",
      ],
      aiPossibilities: [
        "One possibility is these traces connect around a place you care about.",
        "Another is they mark a change you noticed over time.",
      ],
      questionsForChild: [
        "Which of these feels most important to you?",
        "What were you feeling when you captured them?",
      ],
      boundaryReminder:
        "These are only suggestions to think about — your story stays yours to write.",
    };
    return response;
  }
}
