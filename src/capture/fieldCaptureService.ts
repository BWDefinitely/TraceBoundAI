import type { PrismaClient } from "@prisma/client";
import type { TraceType, TraceView } from "../domain/types";
import { toTraceView } from "../domain/traceView";
import { validateUpload } from "./uploadValidation";
import { generateStorageKey, saveFile } from "../storage/fileStorage";

// --- TEXT capture ----------------------------------------------------------

export async function createTextTrace(
  prisma: PrismaClient,
  input: { sessionId: string; content: string }
): Promise<TraceView> {
  const content = input.content.trim();
  if (!content) {
    throw new Error("text trace requires non-empty content");
  }
  const trace = await prisma.$transaction(async (tx) => {
    const t = await tx.trace.create({
      data: { sessionId: input.sessionId, type: "TEXT", content },
    });
    await tx.auditEvent.create({
      data: { traceId: t.id, action: "CREATED", detail: JSON.stringify({ type: "TEXT" }) },
    });
    return t;
  });
  return toTraceView(trace as any);
}

// --- Media capture (PHOTO / SOUND / VOICE) ---------------------------------

export interface MediaCaptureInput {
  sessionId: string;
  type: Exclude<TraceType, "TEXT">;
  originalName: string;
  mimeType: string;
  data: Buffer;
  // Optional caption/transcript stored in `content`.
  content?: string;
}

export async function createMediaTrace(
  prisma: PrismaClient,
  input: MediaCaptureInput
): Promise<TraceView> {
  const sizeBytes = input.data.byteLength;

  const validation = validateUpload(input.type, input.mimeType, sizeBytes);
  if (!validation.ok) {
    throw new Error(validation.error);
  }

  // Server generates the storage key; the client filename is retained only as a
  // display label (originalName), never used to build a path.
  const storageKey = generateStorageKey(input.sessionId, input.mimeType);
  await saveFile(storageKey, input.data);

  const trace = await prisma.$transaction(async (tx) => {
    const t = await tx.trace.create({
      data: {
        sessionId: input.sessionId,
        type: input.type,
        content: input.content?.trim() ?? "",
        storageKey,
        originalName: input.originalName,
        mimeType: input.mimeType,
        sizeBytes,
      },
    });
    await tx.auditEvent.create({
      data: {
        traceId: t.id,
        action: "CREATED",
        detail: JSON.stringify({ type: input.type, sizeBytes }),
      },
    });
    return t;
  });

  return toTraceView(trace as any);
}
