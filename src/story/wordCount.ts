// Derive a word count from plain text. Kept as a single pure function so the
// editor's live count and the server's stored view agree exactly.
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  // Split on any run of Unicode whitespace.
  return trimmed.split(/\s+/u).length;
}
