// Application-level domain types. These mirror the Prisma models but are the
// shapes the server logic and the TraceAccessPolicy reason about.

export type SessionStatus = "ACTIVE" | "ENDED";

export interface Child {
  id: string;
  name: string;
  createdAt: Date;
}

export interface Session {
  id: string;
  childId: string;
  status: SessionStatus;
  createdAt: Date;
  endedAt: Date | null;
}

export type TraceType = "PHOTO" | "SOUND" | "VOICE" | "TEXT";

export interface Trace {
  id: string;
  sessionId: string;
  type: TraceType;
  content: string;
  // Server-internal storage. Never sent to the browser.
  storageKey: string | null;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  aiAccessAllowed: boolean;
  hidden: boolean;
  includeInStory: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export type AuditAction =
  | "CREATED"
  | "EDITED"
  | "DELETED"
  | "HIDDEN"
  | "UNHIDDEN"
  | "AI_ACCESS_GRANTED"
  | "AI_ACCESS_REVOKED"
  | "STORY_INCLUDED"
  | "STORY_EXCLUDED";

// Browser-safe projection of a trace. Deliberately omits storageKey and any
// filesystem detail; media is fetched via a route handler keyed by `id`.
export interface TraceView {
  id: string;
  sessionId: string;
  type: TraceType;
  content: string;
  originalName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  hasMedia: boolean;
  // Relative URL the browser can GET; null for TEXT traces.
  mediaUrl: string | null;
  aiAccessAllowed: boolean;
  hidden: boolean;
  includeInStory: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// The identity + intent under which an AI request is evaluated. Everything here
// is server-derived (childId from auth) or a plain reference (ids), never trusted
// content from the client.
export interface TraceAccessContext {
  childId: string;
  sessionId: string;
  selectedTraceIds: string[];
}

// Why a selected trace was refused entry to the AI boundary.
export type TraceRejectionReason =
  | "SESSION_NOT_FOUND"
  | "SESSION_NOT_OWNED"
  | "SESSION_NOT_ACTIVE"
  | "TRACE_NOT_FOUND"
  | "TRACE_WRONG_SESSION"
  | "TRACE_DELETED"
  | "TRACE_AI_ACCESS_DENIED";

export interface TraceRejection {
  traceId: string;
  reason: TraceRejectionReason;
}

// A trace that passed every gate and may be sent to the AI. Carries only
// textual metadata — the type and the author-written content/caption. It never
// includes storageKey or any reference to the original media bytes.
export interface AuthorizedTrace {
  id: string;
  type: TraceType;
  content: string;
}

// Fail-closed result. `ok: true` only when EVERY selected trace is authorized.
export type TraceAccessResult =
  | { ok: true; traces: AuthorizedTrace[] }
  | { ok: false; violations: TraceRejection[] };
