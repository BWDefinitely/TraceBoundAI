import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import type { TraceType } from "../../../../domain/types";
import {
  createMediaTrace,
  createTextTrace,
} from "../../../../capture/fieldCaptureService";

export const runtime = "nodejs";

// POST /api/traces/upload
// multipart/form-data: sessionId, type, [content], [file]
// Handles both TEXT (no file) and media (PHOTO/SOUND/VOICE) capture.
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const sessionId = String(form.get("sessionId") ?? "");
  const type = String(form.get("type") ?? "") as TraceType;
  const content = form.get("content");

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!["PHOTO", "SOUND", "VOICE", "TEXT"].includes(type)) {
    return NextResponse.json({ error: "invalid trace type" }, { status: 400 });
  }

  try {
    if (type === "TEXT") {
      const view = await createTextTrace(prisma, {
        sessionId,
        content: typeof content === "string" ? content : "",
      });
      return NextResponse.json(view, { status: 201 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }
    const data = Buffer.from(await file.arrayBuffer());
    const view = await createMediaTrace(prisma, {
      sessionId,
      type,
      originalName: file.name,
      mimeType: file.type,
      data,
      content: typeof content === "string" ? content : undefined,
    });
    return NextResponse.json(view, { status: 201 });
  } catch (err) {
    // Validation and storage errors surface as 400; the message is safe (no paths).
    const message = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
