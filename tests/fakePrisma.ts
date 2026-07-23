// Re-export the in-memory client for use by tests. The implementation is in
// src/lib/memoryDb.ts, so tests and the runtime dev server share one canonical
// in-memory backend (no drift).

export { InMemoryPrisma as FakePrisma } from "../src/lib/memoryDb";
