"use server";

import { prisma } from "../../lib/prisma";
import type { BridgeCardView } from "../../domain/bridge";
import type { TraceView } from "../../domain/types";
import type { ScaffoldPrompt } from "../../bridge/mockScaffold";
import {
  scaffoldQuestions,
  nextScaffoldQuestion,
} from "../../bridge/mockScaffold";
import {
  createBridgeCard,
  updateBridgeFields,
  saveDraft,
  setBridgeTraces,
  getSourcePreview,
  getBridgeCard,
  listBridgeCards,
} from "../../bridge/bridgeService";
import {
  CreateBridgeCardSchema,
  UpdateBridgeFieldsSchema,
  SetBridgeTracesSchema,
  type UpdateBridgeFieldsInput,
} from "../../schemas/bridge";

// Server actions for the Trace-to-Story Bridge. The client sends ids + field
// text and receives browser-safe BridgeCardViews (no storageKey). Field edits
// are per-field and never merged; nothing here calls AI.

export async function createBridgeCardAction(
  input: unknown
): Promise<BridgeCardView> {
  return createBridgeCard(prisma, CreateBridgeCardSchema.parse(input));
}

export async function updateBridgeFieldsAction(
  id: string,
  patch: UpdateBridgeFieldsInput
): Promise<BridgeCardView> {
  return updateBridgeFields(prisma, id, UpdateBridgeFieldsSchema.parse(patch));
}

export async function saveDraftAction(
  id: string,
  patch?: UpdateBridgeFieldsInput
): Promise<BridgeCardView> {
  return saveDraft(prisma, id, patch);
}

export async function setBridgeTracesAction(
  id: string,
  traceIds: string[]
): Promise<BridgeCardView> {
  const parsed = SetBridgeTracesSchema.parse({ traceIds });
  return setBridgeTraces(prisma, id, parsed.traceIds);
}

export async function getSourcePreviewAction(id: string): Promise<TraceView[]> {
  return getSourcePreview(prisma, id);
}

export async function getBridgeCardAction(id: string): Promise<BridgeCardView> {
  return getBridgeCard(prisma, id);
}

export async function listBridgeCardsAction(
  sessionId: string
): Promise<BridgeCardView[]> {
  return listBridgeCards(prisma, sessionId);
}

// Mock scaffold: returns questions only, generated deterministically. No AI,
// no plot. Provided as a server action so the UI can request prompts uniformly.
export async function scaffoldQuestionsAction(
  id: string,
  onlyEmpty = true
): Promise<ScaffoldPrompt[]> {
  const card = await getBridgeCard(prisma, id);
  return scaffoldQuestions(card, { onlyEmpty });
}

export async function nextScaffoldQuestionAction(
  id: string
): Promise<ScaffoldPrompt | null> {
  const card = await getBridgeCard(prisma, id);
  return nextScaffoldQuestion(card);
}
