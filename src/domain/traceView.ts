import type { Trace, TraceView } from "./types";

// Project a full Trace (server-side, incl. storageKey) into a browser-safe view.
// This is the ONLY sanctioned way to hand a trace to the client: it strips
// storageKey and returns a relative media URL keyed by id instead of any path.
export function toTraceView(trace: Trace): TraceView {
  const hasMedia = trace.storageKey !== null;
  return {
    id: trace.id,
    sessionId: trace.sessionId,
    type: trace.type,
    content: trace.content,
    originalName: trace.originalName,
    mimeType: trace.mimeType,
    sizeBytes: trace.sizeBytes,
    hasMedia,
    mediaUrl: hasMedia ? `/api/traces/${trace.id}/media` : null,
    aiAccessAllowed: trace.aiAccessAllowed,
    hidden: trace.hidden,
    includeInStory: trace.includeInStory,
    createdAt: trace.createdAt,
    updatedAt: trace.updatedAt,
  };
}
