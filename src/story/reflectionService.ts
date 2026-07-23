import type { PrismaClient } from "@prisma/client";
import type { StoryReflectionView, ReflectionSourceType } from "../domain/story";
import {
  CreateReflectionSchema,
  UpdateReflectionSchema,
  type CreateReflectionInput,
  type UpdateReflectionInput,
} from "../schemas/story";
import { StoryNotFoundError } from "./storyService";

export class ReflectionNotFoundError extends Error {
  constructor(id: string) {
    super(`reflection not found: ${id}`);
    this.name = "ReflectionNotFoundError";
  }
}

function toView(r: any): StoryReflectionView {
  return {
    id: r.id,
    storyId: r.storyId,
    sourceType: r.sourceType as ReflectionSourceType,
    startOffset: r.startOffset,
    endOffset: r.endOffset,
    selectedText: r.selectedText,
    note: r.note,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Associate a selected span of the child's story with a source type.
 *
 * The source type is REQUIRED and comes entirely from the child's choice —
 * this function performs NO inference, NO AI classification, and applies NO
 * default. The child's reflection is the primary account of authorship.
 *
 * We validate the offsets against the current body and store a snapshot of the
 * selected text so the record stands on its own even if the body changes later.
 */
export async function createReflection(
  prisma: PrismaClient,
  rawInput: CreateReflectionInput
): Promise<StoryReflectionView> {
  const input = CreateReflectionSchema.parse(rawInput);

  const story = await prisma.story.findUnique({ where: { id: input.storyId } });
  if (!story) throw new StoryNotFoundError(input.storyId);

  // Offsets must fall within the current body.
  if (input.endOffset > story.body.length) {
    throw new Error("selection range is outside the story body");
  }
  // The snapshot must match what's actually at that range — guards against a
  // stale client selection being recorded against shifted text.
  const actual = story.body.slice(input.startOffset, input.endOffset);
  if (actual !== input.selectedText) {
    throw new Error("selected text does not match the story at that range");
  }

  const created = await prisma.storyReflection.create({
    data: {
      storyId: input.storyId,
      // Zod validates it against the enum values; cast for the Prisma enum type.
      sourceType: input.sourceType as ReflectionSourceType,
      startOffset: input.startOffset,
      endOffset: input.endOffset,
      selectedText: input.selectedText,
      note: input.note,
    },
  });
  return toView(created);
}

// Re-account for a span: change its source type and/or note. Still the child's
// explicit choice — no inference.
export async function updateReflection(
  prisma: PrismaClient,
  id: string,
  rawPatch: UpdateReflectionInput
): Promise<StoryReflectionView> {
  const patch = UpdateReflectionSchema.parse(rawPatch);
  const existing = await prisma.storyReflection.findUnique({ where: { id } });
  if (!existing) throw new ReflectionNotFoundError(id);

  const data: { sourceType?: ReflectionSourceType; note?: string } = {};
  if (patch.sourceType !== undefined)
    data.sourceType = patch.sourceType as ReflectionSourceType;
  if (patch.note !== undefined) data.note = patch.note;

  const updated = await prisma.storyReflection.update({ where: { id }, data });
  return toView(updated);
}

export async function deleteReflection(
  prisma: PrismaClient,
  id: string
): Promise<void> {
  const existing = await prisma.storyReflection.findUnique({ where: { id } });
  if (!existing) throw new ReflectionNotFoundError(id);
  await prisma.storyReflection.delete({ where: { id } });
}

export async function listReflections(
  prisma: PrismaClient,
  storyId: string
): Promise<StoryReflectionView[]> {
  const rows = await prisma.storyReflection.findMany({
    where: { storyId },
    orderBy: { startOffset: "asc" },
  });
  return rows.map(toView);
}
