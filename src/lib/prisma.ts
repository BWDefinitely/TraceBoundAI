import type { PrismaClient } from "@prisma/client";
import { InMemoryPrisma, seedDemoData } from "./memoryDb";

// Backend selection:
//   - DATABASE_URL set   -> real PrismaClient (PostgreSQL).
//   - DATABASE_URL unset -> in-memory client, seeded with demo data.
//
// This lets `npm run dev` run with NO database configured. The in-memory data
// lives only in process memory and resets on restart — for local exploration
// and demos only, never for real users.
//
// The in-memory client is cast to PrismaClient: it implements exactly the subset
// of methods the services call (the same subset the unit tests exercise).

function createClient(): PrismaClient {
  if (process.env.DATABASE_URL) {
    // Lazy require so the app doesn't need a generated client / DB to run the
    // in-memory path.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient: RealPrismaClient } = require("@prisma/client");
    return new RealPrismaClient();
  }

  const mem = new InMemoryPrisma();
  seedDemoData(mem);
  if (process.env.NODE_ENV !== "test") {
    // Make the fallback obvious in dev logs.
    console.warn(
      "[prisma] DATABASE_URL not set — using in-memory demo database (data resets on restart)."
    );
  }
  return mem as unknown as PrismaClient;
}

// Reuse a single instance across hot reloads in dev.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
