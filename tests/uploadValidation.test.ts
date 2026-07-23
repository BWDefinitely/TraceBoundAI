import { describe, it, expect } from "vitest";
import {
  validateUpload,
  MAX_IMAGE_BYTES,
  MAX_AUDIO_BYTES,
} from "../src/capture/uploadValidation";
import {
  generateStorageKey,
  extensionForMime,
} from "../src/storage/fileStorage";

describe("upload validation", () => {
  it("accepts a valid photo", () => {
    expect(validateUpload("PHOTO", "image/png", 1024)).toEqual({ ok: true });
  });

  it("rejects a non-image for PHOTO", () => {
    const r = validateUpload("PHOTO", "audio/webm", 1024);
    expect(r.ok).toBe(false);
  });

  it("rejects oversize images", () => {
    const r = validateUpload("PHOTO", "image/jpeg", MAX_IMAGE_BYTES + 1);
    expect(r.ok).toBe(false);
  });

  it("accepts audio for VOICE and SOUND", () => {
    expect(validateUpload("VOICE", "audio/webm", 2048).ok).toBe(true);
    expect(validateUpload("SOUND", "audio/mpeg", 2048).ok).toBe(true);
  });

  it("rejects oversize audio", () => {
    expect(validateUpload("VOICE", "audio/webm", MAX_AUDIO_BYTES + 1).ok).toBe(false);
  });

  it("rejects empty files", () => {
    expect(validateUpload("PHOTO", "image/png", 0).ok).toBe(false);
  });

  it("rejects file uploads for TEXT", () => {
    expect(validateUpload("TEXT", "image/png", 100).ok).toBe(false);
  });
});

describe("safe storage keys", () => {
  it("builds a key from server inputs with an allow-listed extension", () => {
    const key = generateStorageKey("sess-1", "image/jpeg");
    expect(key).toMatch(/^sess-1\/[a-f0-9]{32}\.jpg$/);
  });

  it("ignores/strips path-traversal attempts in sessionId", () => {
    const key = generateStorageKey("../../etc", "image/png");
    // The dots and slashes are stripped, leaving only id-alphabet chars.
    expect(key.startsWith("etc/")).toBe(true);
    expect(key).not.toContain("..");
  });

  it("rejects unsupported mime types", () => {
    expect(extensionForMime("application/x-msdownload")).toBeNull();
    expect(() => generateStorageKey("sess-1", "application/x-msdownload")).toThrow();
  });
});
