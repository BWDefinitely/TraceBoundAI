// In-memory, Prisma-compatible client. Implements exactly the subset of methods
// the services use, so the whole app can run with NO database configured. It is
// used both by the unit tests (via tests/fakePrisma.ts) and, at runtime, when
// DATABASE_URL is unset (see src/lib/prisma.ts).
//
// Data lives only in process memory: it resets on restart. This is for local
// exploration and demos, never for real users.

import { randomUUID } from "node:crypto";

interface TraceRow {
  id: string;
  sessionId: string;
  type: string;
  content: string;
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

interface AuditRow {
  id: string;
  traceId: string;
  action: string;
  detail: string | null;
  createdAt: Date;
}

export class InMemoryPrisma {
  traces: TraceRow[] = [];
  auditEvents: AuditRow[] = [];

  // Seed a trace with overridable fields (used by tests and the demo seed).
  seedTrace(overrides: Partial<TraceRow> = {}): TraceRow {
    const now = new Date();
    const row: TraceRow = {
      id: randomUUID(),
      sessionId: "sess-1",
      type: "TEXT",
      content: "hello",
      storageKey: null,
      originalName: null,
      mimeType: null,
      sizeBytes: null,
      aiAccessAllowed: false,
      hidden: false,
      includeInStory: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      ...overrides,
    };
    this.traces.push(row);
    return row;
  }

  trace = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.traces.find((t) => t.id === where.id) ?? null,

    findMany: async ({
      where,
      orderBy,
    }: {
      where?: { sessionId?: string; deletedAt?: null; id?: { in: string[] } };
      orderBy?: { createdAt?: "asc" | "desc" };
    } = {}) => {
      let rows = this.traces.slice();
      if (where?.sessionId) rows = rows.filter((t) => t.sessionId === where.sessionId);
      if (where && "deletedAt" in where && where.deletedAt === null)
        rows = rows.filter((t) => t.deletedAt === null);
      if (where?.id?.in) rows = rows.filter((t) => where.id!.in.includes(t.id));
      if (orderBy?.createdAt === "desc")
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return rows;
    },

    create: async ({ data }: { data: Partial<TraceRow> }) => {
      const now = new Date();
      const row: TraceRow = {
        id: randomUUID(),
        sessionId: data.sessionId!,
        type: data.type ?? "TEXT",
        content: data.content ?? "",
        storageKey: data.storageKey ?? null,
        originalName: data.originalName ?? null,
        mimeType: data.mimeType ?? null,
        sizeBytes: data.sizeBytes ?? null,
        aiAccessAllowed: data.aiAccessAllowed ?? false,
        hidden: data.hidden ?? false,
        includeInStory: data.includeInStory ?? false,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      this.traces.push(row);
      return row;
    },

    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<TraceRow>;
    }) => {
      const row = this.traces.find((t) => t.id === where.id);
      if (!row) throw new Error("record not found");
      Object.assign(row, data);
      row.updatedAt = new Date();
      return row;
    },
  };

  auditEvent = {
    create: async ({ data }: { data: Partial<AuditRow> }) => {
      const row: AuditRow = {
        id: randomUUID(),
        traceId: data.traceId!,
        action: data.action!,
        detail: data.detail ?? null,
        createdAt: new Date(),
      };
      this.auditEvents.push(row);
      return row;
    },
  };

  // Sessions. Defaults to an owned, ACTIVE session.
  sessions: Array<{ id: string; childId: string; status: string }> = [];

  seedSession(overrides: Partial<{ id: string; childId: string; status: string }> = {}) {
    const row = { id: "sess-1", childId: "child-1", status: "ACTIVE", ...overrides };
    this.sessions.push(row);
    return row;
  }

  session = {
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.sessions.find((s) => s.id === where.id) ?? null,
  };

  // AI requests + the trace join, recording exactly what crossed the boundary.
  aiRequests: any[] = [];
  aiRequestTraces: Array<{ aiRequestId: string; traceId: string }> = [];

  aiRequest = {
    create: async ({ data }: { data: any }) => {
      const row = {
        id: randomUUID(),
        sessionId: data.sessionId,
        prompt: data.prompt,
        response: data.response ?? null,
        createdAt: new Date(),
      };
      this.aiRequests.push(row);
      for (const link of data.traces?.create ?? []) {
        this.aiRequestTraces.push({ aiRequestId: row.id, traceId: link.traceId });
      }
      return row;
    },
  };

  bridgeCards: any[] = [];
  bridgeCardTraces: Array<{ bridgeCardId: string; traceId: string }> = [];

  private hydrateCard(card: any) {
    const links = this.bridgeCardTraces
      .filter((l) => l.bridgeCardId === card.id)
      .map((l) => ({
        bridgeCardId: l.bridgeCardId,
        traceId: l.traceId,
        trace: this.traces.find((t) => t.id === l.traceId) ?? null,
      }));
    return { ...card, traces: links };
  }

  bridgeCard = {
    create: async ({ data }: { data: any }) => {
      const now = new Date();
      const card = {
        id: randomUUID(),
        sessionId: data.sessionId,
        observation: data.observation ?? "",
        childInterpretation: data.childInterpretation ?? "",
        childImagination: data.childImagination ?? "",
        storyFunction: data.storyFunction ?? "",
        status: data.status ?? "DRAFT",
        createdAt: now,
        updatedAt: now,
      };
      this.bridgeCards.push(card);
      for (const link of data.traces?.create ?? []) {
        this.bridgeCardTraces.push({ bridgeCardId: card.id, traceId: link.traceId });
      }
      return this.hydrateCard(card);
    },

    findUnique: async ({ where }: { where: { id: string } }) => {
      const card = this.bridgeCards.find((c) => c.id === where.id);
      return card ? this.hydrateCard(card) : null;
    },

    findMany: async ({
      where,
      orderBy,
    }: {
      where?: { sessionId?: string };
      orderBy?: { createdAt?: "asc" | "desc" };
    } = {}) => {
      let rows = this.bridgeCards.slice();
      if (where?.sessionId) rows = rows.filter((c) => c.sessionId === where.sessionId);
      if (orderBy?.createdAt === "desc")
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return rows.map((c) => this.hydrateCard(c));
    },

    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const card = this.bridgeCards.find((c) => c.id === where.id);
      if (!card) throw new Error("record not found");
      Object.assign(card, data);
      card.updatedAt = new Date();
      return this.hydrateCard(card);
    },
  };

  bridgeCardTrace = {
    deleteMany: async ({ where }: { where: { bridgeCardId: string } }) => {
      const before = this.bridgeCardTraces.length;
      this.bridgeCardTraces = this.bridgeCardTraces.filter(
        (l) => l.bridgeCardId !== where.bridgeCardId
      );
      return { count: before - this.bridgeCardTraces.length };
    },
    createMany: async ({
      data,
    }: {
      data: Array<{ bridgeCardId: string; traceId: string }>;
    }) => {
      this.bridgeCardTraces.push(...data);
      return { count: data.length };
    },
  };

  stories: any[] = [];
  storyReflections: any[] = [];

  private hydrateStory(s: any) {
    const reflections = this.storyReflections
      .filter((r) => r.storyId === s.id)
      .sort((a, b) => a.startOffset - b.startOffset);
    return { ...s, reflections };
  }

  story = {
    create: async ({ data }: { data: any }) => {
      const now = new Date();
      const s = {
        id: data.id ?? randomUUID(),
        sessionId: data.sessionId,
        title: data.title ?? "",
        body: data.body ?? "",
        createdAt: now,
        updatedAt: now,
      };
      this.stories.push(s);
      return this.hydrateStory(s);
    },
    findUnique: async ({ where }: { where: { id: string } }) => {
      const s = this.stories.find((x) => x.id === where.id);
      return s ? this.hydrateStory(s) : null;
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const s = this.stories.find((x) => x.id === where.id);
      if (!s) throw new Error("record not found");
      Object.assign(s, data);
      s.updatedAt = new Date();
      return this.hydrateStory(s);
    },
  };

  storyReflection = {
    create: async ({ data }: { data: any }) => {
      const now = new Date();
      const r = {
        id: randomUUID(),
        storyId: data.storyId,
        sourceType: data.sourceType,
        startOffset: data.startOffset,
        endOffset: data.endOffset,
        selectedText: data.selectedText,
        note: data.note ?? "",
        createdAt: now,
        updatedAt: now,
      };
      this.storyReflections.push(r);
      return r;
    },
    findUnique: async ({ where }: { where: { id: string } }) =>
      this.storyReflections.find((r) => r.id === where.id) ?? null,
    findMany: async ({ where }: { where?: { storyId?: string } } = {}) => {
      let rows = this.storyReflections.slice();
      if (where?.storyId) rows = rows.filter((r) => r.storyId === where.storyId);
      return rows.sort((a, b) => a.startOffset - b.startOffset);
    },
    update: async ({ where, data }: { where: { id: string }; data: any }) => {
      const r = this.storyReflections.find((x) => x.id === where.id);
      if (!r) throw new Error("record not found");
      Object.assign(r, data);
      r.updatedAt = new Date();
      return r;
    },
    delete: async ({ where }: { where: { id: string } }) => {
      const i = this.storyReflections.findIndex((r) => r.id === where.id);
      if (i === -1) throw new Error("record not found");
      return this.storyReflections.splice(i, 1)[0];
    },
  };

  async $transaction<T>(fn: (tx: this) => Promise<T>): Promise<T> {
    return fn(this);
  }

  // Query helper for assertions (used by tests).
  auditFor(traceId: string) {
    return this.auditEvents.filter((e) => e.traceId === traceId);
  }
}

// Build a demo dataset for DB-free dev: one child, one active session, a story,
// and a few traces (some AI-permitted, one not) so the UI has content to show.
export function seedDemoData(db: InMemoryPrisma) {
  db.seedSession({ id: "sess-1", childId: "child-1", status: "ACTIVE" });

  db.seedTrace({
    id: "trace-photo-1",
    sessionId: "sess-1",
    type: "PHOTO",
    content: "A red kite caught in a tree",
    aiAccessAllowed: true,
  });
  db.seedTrace({
    id: "trace-text-1",
    sessionId: "sess-1",
    type: "TEXT",
    content: "The wind was loud that afternoon",
    aiAccessAllowed: true,
  });
  db.seedTrace({
    id: "trace-voice-1",
    sessionId: "sess-1",
    type: "VOICE",
    content: "I recorded the birds near the pond",
    // Intentionally NOT AI-permitted, to demonstrate the policy blocking it.
    aiAccessAllowed: false,
  });

  void db.story.create({
    data: {
      id: "story-1",
      sessionId: "sess-1",
      title: "My kite day",
      body: "The kite flew over the hill and I felt free.",
    },
  } as any);
}
