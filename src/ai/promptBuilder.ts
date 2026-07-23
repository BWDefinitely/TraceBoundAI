import type { AuthorizedTrace } from "../domain/types";

// The prompt payload handed to the model client. This is the ONLY thing that
// crosses to the model. It is built exclusively from policy-authorized traces
// and contains textual metadata only — id, type, and author-written content.
// No storageKey, no file bytes, no media URL ever appears here.
export interface ModelPrompt {
  system: string;
  // Structured, so a client can format it however it needs without re-parsing.
  question: string;
  traces: Array<{ id: string; type: string; content: string }>;
  // Flat text rendering, convenient for text-completion style clients.
  text: string;
}

const SYSTEM_INSTRUCTION = [
  "You are a careful companion helping a child reflect on traces they collected.",
  "You may ONLY reason about the trace metadata provided below.",
  "Never invent events, never author a plot or story, never fill in missing facts.",
  "Separate what the child observed and interpreted from your own possibilities.",
  "Always include an explicit boundary reminder that these are suggestions, not the child's story.",
  "Respond as JSON matching the required schema.",
].join(" ");

// Build the model prompt from authorized traces + the child's question.
// `traces` MUST already be the policy-approved set (the service passes exactly
// what evaluateTraceAccess returned). This function does not touch the DB or the
// filesystem, so it cannot reach unauthorized content.
export function buildModelPrompt(
  authorized: AuthorizedTrace[],
  childQuestion: string
): ModelPrompt {
  const traces = authorized.map((t) => ({
    id: t.id,
    type: t.type,
    // Trim to keep the payload textual and bounded; empty content stays empty.
    content: t.content.trim(),
  }));

  const traceLines = traces
    .map((t, i) => `Trace ${i + 1} [${t.type}] (id=${t.id}): ${t.content || "(no caption)"}`)
    .join("\n");

  const text = [
    SYSTEM_INSTRUCTION,
    "",
    "Traces the child explicitly selected and permitted:",
    traceLines,
    "",
    `Child's question: ${childQuestion.trim()}`,
  ].join("\n");

  return {
    system: SYSTEM_INSTRUCTION,
    question: childQuestion.trim(),
    traces,
    text,
  };
}
