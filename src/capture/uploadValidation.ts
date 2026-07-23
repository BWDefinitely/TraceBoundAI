import type { TraceType } from "../domain/types";

// Size ceilings per media class. Text traces carry no file.
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // 25 MB

const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AUDIO_MIMES = new Set([
  "audio/webm",
  "audio/ogg",
  "audio/mpeg",
  "audio/wav",
]);

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

// PHOTO expects an image; SOUND and VOICE both expect audio (VOICE is the
// browser-recorded variant, SOUND is an uploaded ambient clip). TEXT takes no file.
export function validateUpload(
  type: TraceType,
  mimeType: string,
  sizeBytes: number
): ValidationResult {
  if (type === "TEXT") {
    return { ok: false, error: "TEXT traces do not accept file uploads" };
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    return { ok: false, error: "file is empty" };
  }

  if (type === "PHOTO") {
    if (!IMAGE_MIMES.has(mimeType)) {
      return { ok: false, error: `unsupported image type: ${mimeType}` };
    }
    if (sizeBytes > MAX_IMAGE_BYTES) {
      return { ok: false, error: "image exceeds 10 MB limit" };
    }
    return { ok: true };
  }

  // SOUND or VOICE
  if (!AUDIO_MIMES.has(mimeType)) {
    return { ok: false, error: `unsupported audio type: ${mimeType}` };
  }
  if (sizeBytes > MAX_AUDIO_BYTES) {
    return { ok: false, error: "audio exceeds 25 MB limit" };
  }
  return { ok: true };
}
