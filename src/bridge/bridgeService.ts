import type { PrismaClient } from "@prisma/client";
import type { BridgeCardView, BridgeFieldKey } from "../domain/bridge";
import { BRIDGE_FIELD_KEYS } from "../domain/bridge";
import type { TraceView } from "../domain/types";
import { toTraceView } from "../domain/traceView";
import {
  CreateBridgeCardSchema,
  UpdateBridgeFieldsSchema,
  SetBridgeTracesSchema,
  type CreateBridgeCardInput,
  type UpdateBridgeFieldsInput,
} from "../schemas/bridge";

export class BridgeCardNotFoundError extends Error {
  constructor(id: string) {
    super(`bridge card not found: ${id}`);
    this.name = "BridgeCardNotFoundError";
  }
}

// A card is loaded with its trace links so we can build the source preview.
type CardWithTraces = any;

function toBridgeCardView(card: CardWithTraces): BridgeCardView {
  // card.traces is the BridgeCardTrace[] join, each with a `trace` relation.
  const links = (card.traces ?? []) as Array<{ trace: any }>;
  // Only surface live (non-deleted) traces in the view; deleted sources drop out.
  const traces: TraceView[] = links
    .map((l) => l.trace)
    .filter((t) => t && t.deletedAt === null)
    .map((t) => toTraceView(t));

  return {
    id: card.id,
    sessionId: card.sessionId,
    observation: card.observation,
    childInterpretation: card.childInterpretation,
    childImagination: card.childImagination,
    storyFunction: card.storyFunction,
    status: card.status,
    traceIds: traces.map((t) => t.id),
    traces,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
  };
}

const includeTraces = { traces: { include: { trace: true } } } as const;

async function loadCard(prisma: PrismaClient, id: string): Promise<CardWithTraces> {
  const card = await prisma.bridgeCard.findUnique({
    where: { id },
    include: includeTraces,
  });
  if (!card) throw new BridgeCardNotFoundError(id);
  return card;
}

// Verify the given trace ids exist and belong to the card's session (and are
// not deleted). Prevents linking traces from another session or dangling ids.
async function assertTracesLinkable(
  prisma: PrismaClient,
  sessionId: string,
  traceIds: string[]
): Promise<void> {
  if (traceIds.length === 0) return;
  const found = await prisma.trace.findMany({
    where: { id: { in: traceIds }, sessionId, deletedAt: null },
    select: { id: true },
  });
  if (found.length !== traceIds.length) {
    throw new Error("one or more traces are invalid for this session");
  }
}

export async function createBridgeCard(
  prisma: PrismaClient,
  rawInput: CreateBridgeCardInput
): Promise<BridgeCardView> {
  // Parse here so defaults (empty fields, empty traceIds) are always applied,
  // whether the caller pre-validated or not.
  const input = CreateBridgeCardSchema.parse(rawInput);
  const fields = input.fields;
  await assertTracesLinkable(prisma, input.sessionId, input.traceIds);

  const card = await prisma.$transaction(async (tx) => {
    const created = await tx.bridgeCard.create({
      data: {
        sessionId: input.sessionId,
        observation: fields.observation,
        childInterpretation: fields.childInterpretation,
        childImagination: fields.childImagination,
        storyFunction: fields.storyFunction,
        status: "DRAFT",
        traces: {
          create: input.traceIds.map((traceId) => ({ traceId })),
        },
      },
      include: includeTraces,
    });
    return created;
  });
  return toBridgeCardView(card);
}

// Update one or more of the four fields. Each field is written to its own
// column — the fields are never concatenated or merged. Editing does not change
// status; use saveDraft to mark SAVED.
export async function updateBridgeFields(
  prisma: PrismaClient,
  id: string,
  patch: UpdateBridgeFieldsInput
): Promise<BridgeCardView> {
  const parsed = UpdateBridgeFieldsSchema.parse(patch);
  await loadCard(prisma, id); // existence guard

  // Build a data object containing only the provided field keys.
  const data: Partial<Record<BridgeFieldKey, string>> = {};
  for (const key of BRIDGE_FIELD_KEYS) {
    if (parsed[key] !== undefined) data[key] = parsed[key] as string;
  }

  await prisma.bridgeCard.update({ where: { id }, data });
  return toBridgeCardView(await loadCard(prisma, id));
}

// Save the current card as a draft snapshot. Optionally applies a final field
// patch in the same call, then flips status to SAVED. Idempotent on status.
export async function saveDraft(
  prisma: PrismaClient,
  id: string,
  patch?: UpdateBridgeFieldsInput
): Promise<BridgeCardView> {
  await loadCard(prisma, id);

  const data: Partial<Record<BridgeFieldKey, string>> & { status: "SAVED" } = {
    status: "SAVED",
  };
  if (patch) {
    const parsed = UpdateBridgeFieldsSchema.parse(patch);
    for (const key of BRIDGE_FIELD_KEYS) {
      if (parsed[key] !== undefined) data[key] = parsed[key] as string;
    }
  }

  await prisma.bridgeCard.update({ where: { id }, data });
  return toBridgeCardView(await loadCard(prisma, id));
}

// Replace the card's trace selection. Validates every id against the session.
export async function setBridgeTraces(
  prisma: PrismaClient,
  id: string,
  traceIds: string[]
): Promise<BridgeCardView> {
  const { traceIds: ids } = SetBridgeTracesSchema.parse({ traceIds });
  const card = await loadCard(prisma, id);
  await assertTracesLinkable(prisma, card.sessionId, ids);

  await prisma.$transaction(async (tx) => {
    await tx.bridgeCardTrace.deleteMany({ where: { bridgeCardId: id } });
    if (ids.length > 0) {
      await tx.bridgeCardTrace.createMany({
        data: ids.map((traceId) => ({ bridgeCardId: id, traceId })),
      });
    }
  });
  return toBridgeCardView(await loadCard(prisma, id));
}

// Source preview: the live traces a card references, as browser-safe views.
// This is what the UI renders next to the four fields so the author can see the
// evidence the card is built on.
export async function getSourcePreview(
  prisma: PrismaClient,
  id: string
): Promise<TraceView[]> {
  const card = await loadCard(prisma, id);
  return toBridgeCardView(card).traces;
}

export async function getBridgeCard(
  prisma: PrismaClient,
  id: string
): Promise<BridgeCardView> {
  return toBridgeCardView(await loadCard(prisma, id));
}

export async function listBridgeCards(
  prisma: PrismaClient,
  sessionId: string
): Promise<BridgeCardView[]> {
  const cards = await prisma.bridgeCard.findMany({
    where: { sessionId },
    include: includeTraces,
    orderBy: { createdAt: "desc" },
  });
  return cards.map(toBridgeCardView);
}
