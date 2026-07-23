"use server";

import { prisma } from "../../lib/prisma";
import type { StoryView, StoryReflectionView } from "../../domain/story";
import { createStory, saveStory, getStory } from "../../story/storyService";
import {
  createReflection,
  updateReflection,
  deleteReflection,
  listReflections,
} from "../../story/reflectionService";
import {
  CreateStorySchema,
  SaveStorySchema,
  CreateReflectionSchema,
  UpdateReflectionSchema,
  type SaveStoryInput,
  type CreateReflectionInput,
  type UpdateReflectionInput,
} from "../../schemas/story";

// --- Story ---

export async function createStoryAction(input: unknown): Promise<StoryView> {
  return createStory(prisma, CreateStorySchema.parse(input));
}

// Shared by manual save and autosave. The client decides cadence; the server
// treats both identically.
export async function saveStoryAction(
  id: string,
  patch: SaveStoryInput
): Promise<StoryView> {
  return saveStory(prisma, id, SaveStorySchema.parse(patch));
}

export async function getStoryAction(id: string): Promise<StoryView> {
  return getStory(prisma, id);
}

// --- Reflections ---

export async function createReflectionAction(
  input: CreateReflectionInput
): Promise<StoryReflectionView> {
  return createReflection(prisma, CreateReflectionSchema.parse(input));
}

export async function updateReflectionAction(
  id: string,
  patch: UpdateReflectionInput
): Promise<StoryReflectionView> {
  return updateReflection(prisma, id, UpdateReflectionSchema.parse(patch));
}

export async function deleteReflectionAction(id: string): Promise<void> {
  return deleteReflection(prisma, id);
}

export async function listReflectionsAction(
  storyId: string
): Promise<StoryReflectionView[]> {
  return listReflections(prisma, storyId);
}
