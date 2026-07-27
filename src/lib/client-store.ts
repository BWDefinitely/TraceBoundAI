// 浏览器本地数据层。所有读写走 IndexedDB（见 idb.ts），完全在客户端运行，
// 因此部署到 Vercel 也不会碰服务器文件系统。函数签名尽量与旧的服务端 store 一致，
// 方便上层调用面平滑迁移。
//
// 媒体（图片/音频）以 Blob 形式存进 media store，key = 素材 id。

"use client";

import {
  STORES,
  idbGetAll,
  idbPut,
  idbDelete,
  idbGet,
  idbSet,
  idbDel,
} from "./idb";
import type { AiProvider, AiSettings, ExperimentCondition } from "./ai-settings";
import {
  type Material,
  type MaterialKind,
  type Story,
  type StoryShelf,
  type AlchemyRecord,
  type IdeaCard,
  type IdeaOrigin,
  type IdeaDecision,
  type Reflection,
  type FirstThought,
  type DecisionEntry,
  type EventType,
  type EventLogEntry,
  emptyShelf,
  migrateMaterial,
  migrateIdeaCard,
  migrateStory,
  defaultIdeaOrigin,
} from "./store";

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function nowIso() {
  return new Date().toISOString();
}

// ---------- materials ----------

export async function listMaterials(): Promise<Material[]> {
  const rows = await idbGetAll<Material>(STORES.materials);
  return rows.map(migrateMaterial).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function readMaterialBody(id: string): Promise<string> {
  return (await idbGet<string>(STORES.materialBodies, id)) ?? "";
}

// 媒体 Blob（图片/音频）读写
export async function readMaterialMedia(id: string): Promise<Blob | undefined> {
  return await idbGet<Blob>(STORES.media, id);
}

export async function createMaterial(input: {
  title: string;
  kind: MaterialKind;
  body?: string;
  tags?: string[];
  iNoticed?: string;
  itRemindsMe?: string;
  stillUnsure?: string;
  aiAllowed?: boolean;
  mediaKind?: 'text' | 'photo' | 'audio';
  media?: Blob;
}): Promise<Material> {
  const id = uuid();
  const now = nowIso();
  const m: Material = {
    id,
    title: input.title.trim() || "未命名素材",
    kind: input.kind,
    tags: input.tags ?? [],
    createdAt: now,
    updatedAt: now,
    favorite: false,
    iNoticed: input.iNoticed ?? '',
    itRemindsMe: input.itRemindsMe ?? '',
    stillUnsure: input.stillUnsure ?? '',
    aiAllowed: input.aiAllowed ?? true,
    mediaKind: input.mediaKind ?? 'text',
  };
  await idbSet(STORES.materialBodies, id, input.body ?? '');
  if (input.media) await idbSet(STORES.media, id, input.media);
  await idbPut(STORES.materials, m);
  return m;
}

export async function updateMaterial(
  id: string,
  patch: {
    title?: string;
    kind?: MaterialKind;
    body?: string;
    tags?: string[];
    favorite?: boolean;
    iNoticed?: string;
    itRemindsMe?: string;
    stillUnsure?: string;
    aiAllowed?: boolean;
    mediaKind?: 'text' | 'photo' | 'audio';
    media?: Blob;
  }
): Promise<Material | null> {
  const rows = await idbGetAll<Material>(STORES.materials);
  const cur = rows.find((r) => r.id === id);
  if (!cur) return null;
  const next = migrateMaterial({ ...cur });
  if (patch.title !== undefined) next.title = patch.title.trim() || "未命名素材";
  if (patch.kind !== undefined) next.kind = patch.kind;
  if (patch.tags !== undefined) next.tags = patch.tags;
  if (patch.favorite !== undefined) next.favorite = patch.favorite;
  if (patch.iNoticed !== undefined) next.iNoticed = patch.iNoticed;
  if (patch.itRemindsMe !== undefined) next.itRemindsMe = patch.itRemindsMe;
  if (patch.stillUnsure !== undefined) next.stillUnsure = patch.stillUnsure;
  if (patch.aiAllowed !== undefined) next.aiAllowed = patch.aiAllowed;
  if (patch.mediaKind !== undefined) next.mediaKind = patch.mediaKind;
  next.updatedAt = nowIso();
  await idbPut(STORES.materials, next);
  if (patch.body !== undefined) await idbSet(STORES.materialBodies, id, patch.body);
  if (patch.media !== undefined) await idbSet(STORES.media, id, patch.media);
  return next;
}

export async function deleteMaterial(id: string): Promise<void> {
  await idbDelete(STORES.materials, id);
  await idbDel(STORES.materialBodies, id);
  await idbDel(STORES.media, id);
}

export async function getMaterial(id: string): Promise<Material | null> {
  const rows = await idbGetAll<Material>(STORES.materials);
  const m = rows.find((r) => r.id === id);
  return m ? migrateMaterial(m) : null;
}

// ---------- ideas ----------

export async function listIdeaCards(): Promise<IdeaCard[]> {
  const rows = await idbGetAll<IdeaCard>(STORES.ideas);
  return rows.map(migrateIdeaCard).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getIdeaCard(id: string): Promise<IdeaCard | null> {
  const rows = await idbGetAll<IdeaCard>(STORES.ideas);
  const c = rows.find((r) => r.id === id);
  return c ? migrateIdeaCard(c) : null;
}

export async function createIdeaCard(input: {
  content: string;
  sourceKind: 'ai-inspired' | 'child-edited' | 'combined';
  origin?: IdeaOrigin;
  decision?: IdeaDecision;
  relationship?: string;
  sourceTraceIds?: string[];
  sourceIdeaIds?: string[];
  parentAlchemyId?: string | null;
}): Promise<IdeaCard> {
  const card: IdeaCard = {
    id: uuid(),
    content: input.content,
    sourceKind: input.sourceKind,
    origin: defaultIdeaOrigin(input.sourceKind, input.origin),
    decision: input.decision ?? 'keep',
    relationship: input.relationship,
    sourceTraceIds: input.sourceTraceIds ?? [],
    sourceIdeaIds: input.sourceIdeaIds ?? [],
    parentAlchemyId: input.parentAlchemyId ?? null,
    createdAt: nowIso(),
  };
  await idbPut(STORES.ideas, card);
  return card;
}

export async function updateIdeaCard(
  id: string,
  patch: {
    content?: string;
    sourceKind?: IdeaCard['sourceKind'];
    origin?: IdeaOrigin;
    decision?: IdeaDecision;
    relationship?: string;
  }
): Promise<IdeaCard | null> {
  const rows = await idbGetAll<IdeaCard>(STORES.ideas);
  const cur = rows.find((r) => r.id === id);
  if (!cur) return null;
  const next = migrateIdeaCard({ ...cur });
  if (patch.content !== undefined) next.content = patch.content;
  if (patch.sourceKind !== undefined) next.sourceKind = patch.sourceKind;
  if (patch.origin !== undefined) next.origin = patch.origin;
  if (patch.decision !== undefined) next.decision = patch.decision;
  if (patch.relationship !== undefined) next.relationship = patch.relationship;
  await idbPut(STORES.ideas, next);
  return next;
}

export async function deleteIdeaCard(id: string): Promise<void> {
  await idbDelete(STORES.ideas, id);
}

// ---------- stories ----------

export async function listStories(): Promise<Story[]> {
  const rows = await idbGetAll<any>(STORES.stories);
  return rows.map(migrateStory).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function readStoryBody(id: string): Promise<string> {
  return (await idbGet<string>(STORES.storyBodies, id)) ?? "";
}

export async function getStory(id: string): Promise<Story | null> {
  const all = await listStories();
  return all.find((r) => r.id === id) ?? null;
}

export async function createStory(input: {
  title?: string;
  body?: string;
  shelf?: StoryShelf;
  linkedMaterialIds?: string[];
  linkedIdeaIds?: string[];
}): Promise<Story> {
  const id = uuid();
  const now = nowIso();
  const s: Story = {
    id,
    title: (input.title ?? "").trim() || "新故事",
    shelf: input.shelf ?? emptyShelf(),
    createdAt: now,
    updatedAt: now,
    linkedMaterialIds: input.linkedMaterialIds ?? [],
    linkedIdeaIds: input.linkedIdeaIds ?? [],
    completedAt: null,
    decisionLedger: [],
  };
  await idbSet(STORES.storyBodies, id, input.body ?? "");
  await idbPut(STORES.stories, s);
  return s;
}

export async function completeStory(id: string): Promise<Story | null> {
  const s = await getStory(id);
  if (!s) return null;
  const now = nowIso();
  const next: Story = { ...s, completedAt: now, updatedAt: now };
  await idbPut(STORES.stories, next);
  return next;
}

export async function reopenStory(id: string): Promise<Story | null> {
  const s = await getStory(id);
  if (!s) return null;
  const next: Story = { ...s, completedAt: null, updatedAt: nowIso() };
  await idbPut(STORES.stories, next);
  return next;
}

export async function updateStory(
  id: string,
  patch: {
    title?: string;
    body?: string;
    shelf?: Partial<StoryShelf>;
    linkedMaterialIds?: string[];
    linkedIdeaIds?: string[];
    decisionLedger?: DecisionEntry[];
  }
): Promise<Story | null> {
  const s = await getStory(id);
  if (!s) return null;
  const next: Story = { ...s };
  if (patch.title !== undefined) next.title = patch.title.trim() || "新故事";
  if (patch.shelf) next.shelf = { ...next.shelf, ...patch.shelf };
  if (patch.linkedMaterialIds !== undefined) next.linkedMaterialIds = patch.linkedMaterialIds;
  if (patch.linkedIdeaIds !== undefined) next.linkedIdeaIds = patch.linkedIdeaIds;
  if (patch.decisionLedger !== undefined) next.decisionLedger = patch.decisionLedger;
  next.updatedAt = nowIso();
  await idbPut(STORES.stories, next);
  if (patch.body !== undefined) await idbSet(STORES.storyBodies, id, patch.body);
  return next;
}

export async function deleteStory(id: string): Promise<void> {
  await idbDelete(STORES.stories, id);
  await idbDel(STORES.storyBodies, id);
}

// ---------- alchemy ----------

export async function listAlchemy(): Promise<AlchemyRecord[]> {
  const rows = await idbGetAll<AlchemyRecord>(STORES.alchemy);
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function saveAlchemy(input: {
  materialAId: string;
  materialBId: string;
  materialATitle: string;
  materialBTitle: string;
  result: string;
}): Promise<AlchemyRecord> {
  const rec: AlchemyRecord = { id: uuid(), ...input, createdAt: nowIso() };
  await idbPut(STORES.alchemy, rec);
  return rec;
}

export async function deleteAlchemy(id: string): Promise<void> {
  await idbDelete(STORES.alchemy, id);
}

// ---------- reflections ----------

export async function listReflections(): Promise<Reflection[]> {
  const rows = await idbGetAll<Reflection>(STORES.reflections);
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function saveReflection(input: {
  storyId: string | null;
  prompt: string;
  answer: string;
}): Promise<Reflection> {
  const rec: Reflection = {
    id: uuid(),
    storyId: input.storyId,
    prompt: input.prompt,
    answer: input.answer,
    createdAt: nowIso(),
  };
  await idbPut(STORES.reflections, rec);
  return rec;
}

export async function deleteReflection(id: string): Promise<void> {
  await idbDelete(STORES.reflections, id);
}

// ---------- first thoughts (Pre-AI Baseline) ----------

export async function listFirstThoughts(): Promise<FirstThought[]> {
  return await idbGetAll<FirstThought>(STORES.firstThoughts);
}

export async function getFirstThought(traceId: string): Promise<FirstThought | null> {
  return (await idbGet<FirstThought>(STORES.firstThoughts, traceId)) ?? null;
}

export async function saveFirstThought(input: {
  traceId: string;
  actuallySawHeard: string;
  guessed: string;
  couldBecome: string;
}): Promise<FirstThought> {
  const existing = await getFirstThought(input.traceId);
  const now = nowIso();
  const entry: FirstThought = existing
    ? { ...existing, ...input, updatedAt: now }
    : { ...input, createdAt: now, updatedAt: now };
  await idbPut(STORES.firstThoughts, entry);
  return entry;
}

export async function deleteFirstThought(traceId: string): Promise<void> {
  await idbDelete(STORES.firstThoughts, traceId);
}

// ---------- CHI event log ----------

export async function listEvents(): Promise<EventLogEntry[]> {
  const rows = await idbGetAll<EventLogEntry>(STORES.events);
  return rows.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
}

export async function appendEvent(input: {
  type: EventType;
  condition: ExperimentCondition;
  storyId?: string;
  payload?: Record<string, unknown>;
}): Promise<EventLogEntry> {
  const entry: EventLogEntry = {
    id: uuid(),
    type: input.type,
    condition: input.condition,
    storyId: input.storyId,
    payload: input.payload ?? {},
    timestamp: nowIso(),
  };
  await idbPut(STORES.events, entry);
  return entry;
}

export async function exportEventsNdjson(): Promise<string> {
  const rows = await listEvents();
  return rows.map((r) => JSON.stringify(r)).join("\n");
}

// ---------- AI settings ----------

const SETTINGS_KEY = "ai";

function defaultAiSettings(): AiSettings {
  return {
    provider: "mock",
    condition: "trace-bound",
    anthropic: { apiKey: "", model: "claude-opus-4-8", baseUrl: "" },
    openaiCompat: { apiKey: "", model: "", baseUrl: "" },
  };
}

export async function getAiSettings(): Promise<AiSettings> {
  const fromDb = await idbGet<Partial<AiSettings>>(STORES.settings, SETTINGS_KEY);
  const defaults = defaultAiSettings();
  if (!fromDb) return defaults;
  return {
    provider:
      fromDb.provider === "anthropic" ||
      fromDb.provider === "openai-compat" ||
      fromDb.provider === "mock"
        ? fromDb.provider
        : defaults.provider,
    condition:
      fromDb.condition === "trace-bound" || fromDb.condition === "topic-based"
        ? fromDb.condition
        : defaults.condition,
    anthropic: {
      apiKey: fromDb.anthropic?.apiKey ?? defaults.anthropic.apiKey,
      model: fromDb.anthropic?.model ?? defaults.anthropic.model,
      baseUrl: fromDb.anthropic?.baseUrl ?? defaults.anthropic.baseUrl,
    },
    openaiCompat: {
      apiKey: fromDb.openaiCompat?.apiKey ?? defaults.openaiCompat.apiKey,
      model: fromDb.openaiCompat?.model ?? defaults.openaiCompat.model,
      baseUrl: fromDb.openaiCompat?.baseUrl ?? defaults.openaiCompat.baseUrl,
    },
  };
}

export async function saveAiSettings(patch: Partial<AiSettings>): Promise<AiSettings> {
  const current = await getAiSettings();
  const next: AiSettings = {
    provider: patch.provider ?? current.provider,
    condition: patch.condition ?? current.condition,
    anthropic: {
      apiKey: patch.anthropic?.apiKey ?? current.anthropic.apiKey,
      model: patch.anthropic?.model ?? current.anthropic.model,
      baseUrl: patch.anthropic?.baseUrl ?? current.anthropic.baseUrl,
    },
    openaiCompat: {
      apiKey: patch.openaiCompat?.apiKey ?? current.openaiCompat.apiKey,
      model: patch.openaiCompat?.model ?? current.openaiCompat.model,
      baseUrl: patch.openaiCompat?.baseUrl ?? current.openaiCompat.baseUrl,
    },
  };
  await idbSet(STORES.settings, SETTINGS_KEY, next);
  return next;
}
