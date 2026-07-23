import { describe, it, expect, beforeEach, vi } from "vitest";
import { FakePrisma } from "./fakePrisma";

// Mock the storage module so deleteTrace can run without touching the disk, and
// so we can assert the underlying file is removed.
const deleteFileMock = vi.fn(async (_key: string) => {});
vi.mock("../src/storage/fileStorage", () => ({
  deleteFile: (key: string) => deleteFileMock(key),
}));

import {
  deleteTrace,
  listLibrary,
  TraceNotFoundError,
} from "../src/library/myWorldLibraryService";

const asPrisma = (p: FakePrisma) => p as unknown as any;

describe("deletion", () => {
  let db: FakePrisma;
  beforeEach(() => {
    db = new FakePrisma();
    deleteFileMock.mockClear();
  });

  it("soft-deletes: sets deletedAt and records DELETED", async () => {
    const t = db.seedTrace();
    await deleteTrace(asPrisma(db), t.id);

    const row = await db.trace.findUnique({ where: { id: t.id } });
    expect(row?.deletedAt).not.toBeNull();
    expect(db.auditFor(t.id).map((e) => e.action)).toContain("DELETED");
  });

  it("removes the backing media file when present", async () => {
    const t = db.seedTrace({ type: "PHOTO", storageKey: "sess-1/abc.jpg" });
    await deleteTrace(asPrisma(db), t.id);
    expect(deleteFileMock).toHaveBeenCalledWith("sess-1/abc.jpg");
  });

  it("does not attempt file removal for TEXT traces", async () => {
    const t = db.seedTrace({ type: "TEXT", storageKey: null });
    await deleteTrace(asPrisma(db), t.id);
    expect(deleteFileMock).not.toHaveBeenCalled();
  });

  it("excludes deleted traces from the library listing", async () => {
    const keep = db.seedTrace({ content: "keep" });
    const drop = db.seedTrace({ content: "drop" });
    await deleteTrace(asPrisma(db), drop.id);

    const list = await listLibrary(asPrisma(db), "sess-1");
    const ids = list.map((v) => v.id);
    expect(ids).toContain(keep.id);
    expect(ids).not.toContain(drop.id);
  });

  it("deleting an already-deleted trace throws", async () => {
    const t = db.seedTrace();
    await deleteTrace(asPrisma(db), t.id);
    await expect(deleteTrace(asPrisma(db), t.id)).rejects.toBeInstanceOf(
      TraceNotFoundError
    );
  });

  it("library views never expose storageKey", async () => {
    db.seedTrace({ type: "PHOTO", storageKey: "sess-1/secret.jpg", mimeType: "image/jpeg" });
    const list = await listLibrary(asPrisma(db), "sess-1");
    expect(JSON.stringify(list)).not.toContain("secret.jpg");
    expect(list[0].mediaUrl).toMatch(/^\/api\/traces\/.+\/media$/);
  });
});
