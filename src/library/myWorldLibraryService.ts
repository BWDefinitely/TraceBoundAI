import type { PrismaClient } from "@prisma/client";
import type { TraceView } from "../domain/types";
import { toTraceView } from "../domain/traceView";
import { deleteFile } from "../storage/fileStorage";

// Raised when a trace doesn't exist or is already soft-deleted.
export class TraceNotFoundError extends Error {
  constructor(traceId: string) {
    super(`trace not found: ${traceId}`);
    this.name = "TraceNotFoundError";
  }
}

// Load a live (non-deleted) trace or throw. Shared guard for all mutations.
async function requireLiveTrace(prisma: PrismaClient, traceId: string) {
  const trace = await prisma.trace.findUnique({ where: { id: traceId } });
  if (!trace || trace.deletedAt !== null) {
    throw new TraceNotFoundError(traceId);
  }
  return trace;
}

// List a session's traces for the library. Excludes soft-deleted rows and
// returns browser-safe views (no storageKey).
export async function listLibrary(
  prisma: PrismaClient,
  sessionId: string
): Promise<TraceView[]> {
  const traces = await prisma.trace.findMany({
    where: { sessionId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return traces.map((t) => toTraceView(t as any));
}

// Edit the text content / caption. Audited only when the value actually changes.
export async function editTrace(
  prisma: PrismaClient,
  traceId: string,
  content: string
): Promise<TraceView> {
  const existing = await requireLiveTrace(prisma, traceId);
  const next = content.trim();

  if (next === existing.content) {
    return toTraceView(existing as any); // no-op, no audit
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.trace.update({
      where: { id: traceId },
      data: { content: next },
    });
    await tx.auditEvent.create({
      data: {
        traceId,
        action: "EDITED",
        detail: JSON.stringify({ field: "content" }),
      },
    });
    return t;
  });
  return toTraceView(updated as any);
}

// Soft-delete a trace and remove its underlying media file. Idempotent-ish:
// deleting an already-deleted trace throws TraceNotFoundError.
export async function deleteTrace(
  prisma: PrismaClient,
  traceId: string
): Promise<void> {
  const existing = await requireLiveTrace(prisma, traceId);

  await prisma.$transaction(async (tx) => {
    await tx.trace.update({
      where: { id: traceId },
      data: { deletedAt: new Date() },
    });
    await tx.auditEvent.create({
      data: { traceId, action: "DELETED" },
    });
  });

  // Remove bytes after the DB commit. Best-effort; the trace is already excluded
  // from AI/library by the soft-delete regardless of file removal success.
  if (existing.storageKey) {
    await deleteFile(existing.storageKey);
  }
}

// --- Boolean permission/state toggles --------------------------------------
// Each helper flips one flag and audits ONLY on a real transition.

async function setFlag(
  prisma: PrismaClient,
  traceId: string,
  field: "hidden" | "aiAccessAllowed" | "includeInStory",
  value: boolean,
  auditFor: (from: boolean, to: boolean) => string | null
): Promise<TraceView> {
  const existing = await requireLiveTrace(prisma, traceId);
  const current = existing[field] as boolean;

  if (current === value) {
    return toTraceView(existing as any); // no change -> no audit
  }

  const action = auditFor(current, value);

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.trace.update({
      where: { id: traceId },
      data: { [field]: value },
    });
    if (action) {
      await tx.auditEvent.create({
        data: {
          traceId,
          action: action as any,
          detail: JSON.stringify({ field, from: current, to: value }),
        },
      });
    }
    return t;
  });
  return toTraceView(updated as any);
}

export function setHidden(prisma: PrismaClient, traceId: string, hidden: boolean) {
  return setFlag(prisma, traceId, "hidden", hidden, (_f, to) =>
    to ? "HIDDEN" : "UNHIDDEN"
  );
}

export function setAiAccess(
  prisma: PrismaClient,
  traceId: string,
  allowed: boolean
) {
  return setFlag(prisma, traceId, "aiAccessAllowed", allowed, (_f, to) =>
    to ? "AI_ACCESS_GRANTED" : "AI_ACCESS_REVOKED"
  );
}

export function setIncludeInStory(
  prisma: PrismaClient,
  traceId: string,
  include: boolean
) {
  return setFlag(prisma, traceId, "includeInStory", include, (_f, to) =>
    to ? "STORY_INCLUDED" : "STORY_EXCLUDED"
  );
}
