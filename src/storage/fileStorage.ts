import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

// Root of media storage. Kept OUTSIDE anything the web server serves statically,
// so files are only reachable through our authenticated route handler.
const STORAGE_ROOT =
  process.env.TRACE_STORAGE_ROOT ?? path.join(process.cwd(), ".storage", "traces");

// Map of accepted mime types -> canonical extension. The extension is chosen by
// US, never taken from the client-supplied filename, to avoid path/extension
// injection (e.g. "evil.php", "../../x", trailing dots on Windows).
const EXTENSION_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

export function extensionForMime(mimeType: string): string | null {
  return EXTENSION_BY_MIME[mimeType] ?? null;
}

/**
 * Generate a safe, server-controlled storage key. The key is a RELATIVE path
 * (sessionId/<random>.<ext>) built only from validated inputs — the random
 * component is hex, and the extension comes from our allow-list. No component of
 * the client filename is used. This value is never exposed to the browser.
 */
export function generateStorageKey(sessionId: string, mimeType: string): string {
  const ext = extensionForMime(mimeType);
  if (!ext) {
    throw new Error(`unsupported mime type: ${mimeType}`);
  }
  // sessionId is a server-generated cuid, but guard anyway: strip anything that
  // is not part of the known id alphabet so it can't traverse directories.
  const safeSession = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safeSession) {
    throw new Error("invalid sessionId for storage key");
  }
  const rand = randomBytes(16).toString("hex");
  return `${safeSession}/${rand}.${ext}`;
}

// Resolve a storage key to an absolute path, guaranteeing it stays within
// STORAGE_ROOT. Any attempt to escape the root throws.
function resolveWithinRoot(storageKey: string): string {
  const abs = path.resolve(STORAGE_ROOT, storageKey);
  const rootWithSep = path.resolve(STORAGE_ROOT) + path.sep;
  if (abs !== path.resolve(STORAGE_ROOT) && !abs.startsWith(rootWithSep)) {
    throw new Error("resolved path escapes storage root");
  }
  return abs;
}

export async function saveFile(storageKey: string, data: Buffer): Promise<void> {
  const abs = resolveWithinRoot(storageKey);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, data);
}

export async function readFile(storageKey: string): Promise<Buffer> {
  const abs = resolveWithinRoot(storageKey);
  return fs.readFile(abs);
}

// Best-effort delete. Missing file is not an error (delete is idempotent).
export async function deleteFile(storageKey: string): Promise<void> {
  const abs = resolveWithinRoot(storageKey);
  await fs.rm(abs, { force: true });
}
