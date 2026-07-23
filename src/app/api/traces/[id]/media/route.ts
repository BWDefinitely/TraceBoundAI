import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { readFile } from "../../../../../storage/fileStorage";

export const runtime = "nodejs";

// GET /api/traces/:id/media
// Serves media bytes by trace id. The storageKey never appears in the URL or
// response, so the browser learns nothing about the filesystem layout.
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;

  const trace = await prisma.trace.findUnique({ where: { id } });
  // Deleted or non-media traces expose no bytes.
  if (!trace || trace.deletedAt !== null || !trace.storageKey || !trace.mimeType) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  try {
    const bytes = await readFile(trace.storageKey);
    return new NextResponse(bytes as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": trace.mimeType,
        "Content-Length": String(bytes.byteLength),
        "Cache-Control": "private, max-age=0, no-store",
      },
    });
  } catch {
    // File missing on disk (e.g. mid-delete). Do not leak the reason.
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
