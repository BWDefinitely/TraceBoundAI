import type { BridgeCardView, BridgeFieldKey } from "../domain/bridge";
import { BRIDGE_FIELD_KEYS } from "../domain/bridge";

// A scaffold prompt is a QUESTION that invites the author (child/adult) to fill
// in a field themselves. It deliberately contains NO story text, NO plot, NO
// generated narrative — just an open question. This is a mock: it is fully
// deterministic and uses no AI. It exists to show where a future (opt-in,
// boundary-respecting) assist could ask questions without ever authoring content.

export interface ScaffoldPrompt {
  field: BridgeFieldKey;
  question: string;
}

// One fixed, open-ended question per field. Phrased to elicit the AUTHOR's own
// words. None of these describe or invent events.
const QUESTIONS: Record<BridgeFieldKey, string> = {
  observation:
    "What did you actually notice here — what did you see or hear?",
  childInterpretation:
    "What do you think was happening, and what did it mean to you?",
  childImagination:
    "If you imagined more about this moment, what might you add?",
  storyFunction:
    "How could this fit into your story, and what part might it play?",
};

/**
 * Return scaffold questions for a card. By default, asks only about fields that
 * are still empty (whitespace-only counts as empty) — nudging the author toward
 * the blanks without touching the ones they've written.
 *
 * IMPORTANT: this returns questions only. It never reads, merges, rewrites, or
 * generates field content, and it never proposes a plot.
 */
export function scaffoldQuestions(
  card: BridgeCardView,
  opts: { onlyEmpty?: boolean } = {}
): ScaffoldPrompt[] {
  const onlyEmpty = opts.onlyEmpty ?? true;
  const prompts: ScaffoldPrompt[] = [];

  for (const field of BRIDGE_FIELD_KEYS) {
    const isEmpty = card[field].trim().length === 0;
    if (!onlyEmpty || isEmpty) {
      prompts.push({ field, question: QUESTIONS[field] });
    }
  }
  return prompts;
}

// Convenience: a single next question — the first empty field, or null if the
// author has written something in all four.
export function nextScaffoldQuestion(card: BridgeCardView): ScaffoldPrompt | null {
  return scaffoldQuestions(card, { onlyEmpty: true })[0] ?? null;
}
