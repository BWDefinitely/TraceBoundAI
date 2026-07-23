import type { PrismaClient } from "@prisma/client";
import type {
  StoryView,
  StoryReflectionView,
  ReflectionSourceType,
} from "../domain/story";
import { countWords } from "./wordCount";
import {
  CreateStorySchema,
  SaveStorySchema,
  type CreateStoryInput,
  type SaveStoryInput,
} from "../schemas/story";

export class StoryNotFoundError extends Error {
  constructor(id: string) {
    super(`story not found: ${id}`);
    this.name = "StoryNotFoundError";
  }
}

function toReflectionView(r: any): StoryReflectionView {
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

function toStoryView(story: any): StoryView {
  return {
    id: story.id,
    sessionId: story.sessionId,
    title: story.title,
    body: story.body,
    // Derived, never stored — cannot drift from the body.
    wordCount: countWords(story.body),
    reflections: (story.reflections ?? []).map(toReflectionView),
    createdAt: story.createdAt,
    updatedAt: story.updatedAt,
  };
}

const includeReflections = {
  reflections: { orderBy: { startOffset: "asc" } },
} as const;

async function loadStory(prisma: PrismaClient, id: string) {
  const story = await prisma.story.findUnique({
    where: { id },
    include: includeReflections,
  });
  if (!story) throw new StoryNotFoundError(id);
  return story;
}

export async function createStory(
  prisma: PrismaClient,
  rawInput: CreateStoryInput
): Promise<StoryView> {
  const input = CreateStorySchema.parse(rawInput);
  const story = await prisma.story.create({
    data: { sessionId: input.sessionId, title: input.title, body: input.body },
    include: includeReflections,
  });
  return toStoryView(story);
}

// Save the story. Manual save and autosave share this path — the distinction is
// purely a UI concern (autosave calls it on a debounce, manual on a click).
// Only the provided fields are written.
export async function saveStory(
  prisma: PrismaClient,
  id: string,
  rawPatch: SaveStoryInput
): Promise<StoryView> {
  const patch = SaveStorySchema.parse(rawPatch);
  await loadStory(prisma, id); // existence guard

  const data: { title?: string; body?: string } = {};
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.body !== undefined) data.body = patch.body;

  await prisma.story.update({ where: { id }, data });
  return toStoryView(await loadStory(prisma, id));
}

export async function getStory(prisma: PrismaClient, id: string): Promise<StoryView> {
  return toStoryView(await loadStory(prisma, id));
}
