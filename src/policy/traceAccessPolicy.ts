import type { PrismaClient } from "@prisma/client";
import type {
  TraceAccessContext,
  TraceAccessResult,
  TraceRejection,
} from "../domain/types";

/**
 * TraceAccessPolicy — the single server-side gate that decides which trace
 * content may cross the boundary into an AI request.
 *
 * INVARIANT (fail-closed): a trace's content is returned ONLY if all hold:
 *   1. it belongs to the active session,
 *   2. its session is owned by the requesting child and is ACTIVE,
 *   3. aiAccessAllowed === true,
 *   4. it is not soft-deleted (deletedAt === null),
 *   5. the child explicitly selected it for THIS request.
 *
 * If ANY selected trace fails ANY check, the whole request is rejected. We never
 * silently drop a bad trace and proceed — partial success could leak the fact
 * that a denied/deleted trace exists, and blurs the child's consent.
 */
export async function evaluateTraceAccess(
  prisma: PrismaClient,
  ctx: TraceAccessContext
): Promise<TraceAccessResult> {
  const { childId, sessionId, selectedTraceIds } = ctx;

  // Nothing selected -> nothing authorized. Fail closed.
  if (selectedTraceIds.length === 0) {
    return { ok: false, violations: [] };
  }

  const session = await prisma.session.findUnique({ where: { id: sessionId } });

  if (!session) {
    return {
      ok: false,
      violations: selectedTraceIds.map((traceId) => ({
        traceId,
        reason: "SESSION_NOT_FOUND" as const,
      })),
    };
  }
  if (session.childId !== childId) {
    return {
      ok: false,
      violations: selectedTraceIds.map((traceId) => ({
        traceId,
        reason: "SESSION_NOT_OWNED" as const,
      })),
    };
  }
  if (session.status !== "ACTIVE") {
    return {
      ok: false,
      violations: selectedTraceIds.map((traceId) => ({
        traceId,
        reason: "SESSION_NOT_ACTIVE" as const,
      })),
    };
  }

  // Load only the selected traces. We evaluate each against the invariant.
  const traces = await prisma.trace.findMany({
    where: { id: { in: selectedTraceIds } },
  });
  const byId = new Map(traces.map((t) => [t.id, t]));

  const violations: TraceRejection[] = [];
  // Iterate the SELECTION (not the DB rows) so a missing/foreign id is caught.
  for (const traceId of selectedTraceIds) {
    const trace = byId.get(traceId);
    if (!trace) {
      violations.push({ traceId, reason: "TRACE_NOT_FOUND" });
      continue;
    }
    if (trace.sessionId !== sessionId) {
      violations.push({ traceId, reason: "TRACE_WRONG_SESSION" });
      continue;
    }
    if (trace.deletedAt !== null) {
      violations.push({ traceId, reason: "TRACE_DELETED" });
      continue;
    }
    if (!trace.aiAccessAllowed) {
      violations.push({ traceId, reason: "TRACE_AI_ACCESS_DENIED" });
      continue;
    }
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }

  // Every selected trace passed. Return content in the child's selection order.
  return {
    ok: true,
    traces: selectedTraceIds.map((id) => {
      const t = byId.get(id)!;
      // Textual metadata only: type + author content. No storageKey, no media.
      return { id: t.id, type: t.type, content: t.content };
    }),
  };
}
