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
import type { AiProvider, AiSettings } from "./ai-settings";
import { defaultAiSettings } from "./ai-settings";
import { loadSecureSettings, saveSecureSettings } from "./secure-settings";
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
  type ImportBatch,
  type ImportImage,
  type ImportImageStatus,
  type StoryMetadata,
  type StoryStructure,
  emptyShelf,
  emptyMetadata,
  emptyStructure,
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
  metadata?: StoryMetadata;
  structure?: StoryStructure;
}): Promise<Story> {
  const id = uuid();
  const now = nowIso();
  const s: Story = {
    id,
    title: (input.title ?? "").trim() || "新故事",
    metadata: input.metadata ?? emptyMetadata(),
    structure: input.structure ?? emptyStructure(),
    body: input.body ?? "",
    aiWordCount: 0,
    userWordCount: 0,
    sceneImages: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
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
    metadata?: Partial<StoryMetadata>;
    structure?: Partial<StoryStructure>;
    aiWordCount?: number;
    userWordCount?: number;
    sceneImages?: Array<{ blobId: string; prompt: string; createdAt: string }>;
  }
): Promise<Story | null> {
  const s = await getStory(id);
  if (!s) return null;
  const next: Story = { ...s };
  if (patch.title !== undefined) next.title = patch.title.trim() || "新故事";
  if (patch.metadata) next.metadata = { ...next.metadata, ...patch.metadata };
  if (patch.structure) next.structure = { ...next.structure, ...patch.structure };
  if (patch.aiWordCount !== undefined) next.aiWordCount = patch.aiWordCount;
  if (patch.userWordCount !== undefined) next.userWordCount = patch.userWordCount;
  if (patch.sceneImages !== undefined) next.sceneImages = patch.sceneImages;
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
  storyId?: string;
  payload?: Record<string, unknown>;
}): Promise<EventLogEntry> {
  const entry: EventLogEntry = {
    id: uuid(),
    type: input.type,
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
    anthropic: { apiKey: "", model: "claude-sonnet-4-6", baseUrl: "" },
    openaiCompat: { apiKey: "", model: "gpt-4o-mini", baseUrl: "" },
    vision: {
      provider: "anthropic",
      apiKey: "",
      model: "claude-sonnet-4-6",
      baseUrl: "",
    },
    imageGeneration: {
      provider: "custom",
      apiKey: "",
      model: "gemini-2.0-flash-lite-image",
      baseUrl: "",
    },
  };
}

export async function getAiSettings(): Promise<AiSettings> {
  // 优先从加密存储读取
  try {
    const secureSettings = await loadSecureSettings();
    if (secureSettings) {
      return secureSettings;
    }
  } catch (err) {
    console.warn("读取加密设置失败，尝试从 IndexedDB 读取:", err);
  }
  
  // 回退到 IndexedDB（旧版本兼容）
  const fromDb = await idbGet<Partial<AiSettings>>(STORES.settings, SETTINGS_KEY);
  const defaults = defaultAiSettings();
  if (!fromDb) return defaults;
  
  const settings: AiSettings = {
    provider:
      fromDb.provider === "anthropic" ||
      fromDb.provider === "openai-compat" ||
      fromDb.provider === "mock"
        ? fromDb.provider
        : defaults.provider,
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
    vision: {
      provider: fromDb.vision?.provider ?? defaults.vision.provider,
      apiKey: fromDb.vision?.apiKey ?? defaults.vision.apiKey,
      model: fromDb.vision?.model ?? defaults.vision.model,
      baseUrl: fromDb.vision?.baseUrl ?? defaults.vision.baseUrl,
    },
    imageGeneration: {
      provider: fromDb.imageGeneration?.provider ?? defaults.imageGeneration.provider,
      apiKey: fromDb.imageGeneration?.apiKey ?? defaults.imageGeneration.apiKey,
      model: fromDb.imageGeneration?.model ?? defaults.imageGeneration.model,
      baseUrl: fromDb.imageGeneration?.baseUrl ?? defaults.imageGeneration.baseUrl,
    },
  };
  
  // 迁移到加密存储
  try {
    await saveSecureSettings(settings);
    // 删除旧的 IndexedDB 数据
    await idbDel(STORES.settings, SETTINGS_KEY);
    console.log("已将设置迁移到加密存储");
  } catch (err) {
    console.warn("迁移设置失败:", err);
  }
  
  return settings;
}

export async function saveAiSettings(patch: Partial<AiSettings>): Promise<AiSettings> {
  const current = await getAiSettings();
  const next: AiSettings = {
    provider: patch.provider ?? current.provider,
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
    vision: {
      provider: patch.vision?.provider ?? current.vision.provider,
      apiKey: patch.vision?.apiKey ?? current.vision.apiKey,
      model: patch.vision?.model ?? current.vision.model,
      baseUrl: patch.vision?.baseUrl ?? current.vision.baseUrl,
    },
    imageGeneration: {
      provider: patch.imageGeneration?.provider ?? current.imageGeneration.provider,
      apiKey: patch.imageGeneration?.apiKey ?? current.imageGeneration.apiKey,
      model: patch.imageGeneration?.model ?? current.imageGeneration.model,
      baseUrl: patch.imageGeneration?.baseUrl ?? current.imageGeneration.baseUrl,
    },
  };
  
  // 保存到加密存储
  await saveSecureSettings(next);
  
  return next;
}

// ---------- import batch ----------

export async function listImportBatches(): Promise<ImportBatch[]> {
  const rows = await idbGetAll<ImportBatch>(STORES.importBatches);
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getImportBatch(id: string): Promise<ImportBatch | null> {
  const all = await listImportBatches();
  return all.find((b) => b.id === id) ?? null;
}

export async function createImportBatch(images: ImportImage[]): Promise<ImportBatch> {
  const batch: ImportBatch = {
    id: uuid(),
    images,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  await idbPut(STORES.importBatches, batch);
  return batch;
}

export async function updateImportBatch(
  id: string,
  patch: { images?: ImportImage[] }
): Promise<ImportBatch | null> {
  const batch = await getImportBatch(id);
  if (!batch) return null;
  const next: ImportBatch = {
    ...batch,
    images: patch.images ?? batch.images,
    updatedAt: nowIso(),
  };
  await idbPut(STORES.importBatches, next);
  return next;
}

export async function deleteImportBatch(id: string): Promise<void> {
  await idbDelete(STORES.importBatches, id);
}

// ---------- Media Blob 存储 ----------

export async function saveMediaBlob(id: string, blob: Blob): Promise<void> {
  await idbSet(STORES.media, id, blob);
}

export async function getMediaBlob(id: string): Promise<Blob | null> {
  const blob = await idbGet<Blob>(STORES.media, id);
  return blob ?? null;
}

export async function deleteMediaBlob(id: string): Promise<void> {
  await idbDelete(STORES.media, id);
}
