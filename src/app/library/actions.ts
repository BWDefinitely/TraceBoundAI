"use server";

import { prisma } from "../../lib/prisma";
import type { TraceView } from "../../domain/types";
import {
  editTrace,
  deleteTrace,
  setHidden,
  setAiAccess,
  setIncludeInStory,
} from "../../library/myWorldLibraryService";

// Server actions for the My World Library. All mutations run on the server; the
// client only sends trace ids and primitive values, and receives browser-safe
// TraceViews (never storageKey). The underlying service records AuditEvents for
// meaningful permission/state changes.

export async function editTraceAction(
  traceId: string,
  content: string
): Promise<TraceView> {
  return editTrace(prisma, traceId, content);
}

export async function deleteTraceAction(traceId: string): Promise<void> {
  await deleteTrace(prisma, traceId);
}

export async function setHiddenAction(
  traceId: string,
  hidden: boolean
): Promise<TraceView> {
  return setHidden(prisma, traceId, hidden);
}

export async function setAiAccessAction(
  traceId: string,
  allowed: boolean
): Promise<TraceView> {
  return setAiAccess(prisma, traceId, allowed);
}

export async function setIncludeInStoryAction(
  traceId: string,
  include: boolean
): Promise<TraceView> {
  return setIncludeInStory(prisma, traceId, include);
}
