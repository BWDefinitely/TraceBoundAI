import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

export type { AiProvider, AiSettings, ExperimentCondition } from "./ai-settings";
import type { AiProvider, AiSettings, ExperimentCondition } from "./ai-settings";

// 本地文件存储。所有数据写到用户家目录下的 TraceBound/ 里：
//
//   ~/TraceBound/
//     materials/
//       index.json                    素材元数据数组
//       <id>.txt                      素材正文（纯文本）
//     stories/
//       index.json                    故事元数据数组（含 6 槽位 shelf）
//       <id>.txt                      故事正文
//     ideas/
//       index.json                    Idea Card 数组
//     alchemy/
//       index.json                    炼金记录数组（两素材 + AI 联想）
//     reflections/
//       index.json                    反思条目数组
//
// 全部读写走原子写：先写 tmp，再 rename。孩子的资料不会因中断而损坏。

const ROOT = process.env.TRACEBOUND_HOME || path.join(os.homedir(), "TraceBound");

export type MaterialKind = "观察" | "感受" | "想法" | "对话" | "声音" | "画面";

export interface Material {
  id: string;
  title: string;
  kind: MaterialKind;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  favorite: boolean;
  // Phase A: Trace 三问表单
  iNoticed: string;          // "我注意到"
  itRemindsMe: string;       // "它让我想到"
  stillUnsure: string;       // "还不确定"
  aiAllowed: boolean;        // 允许 AI 读取
  mediaKind: 'text' | 'photo' | 'audio';  // 多模态占位，默认 'text'
}

export interface StoryShelfSlot {
  text: string;
  sources: Array<{ kind: 'trace' | 'idea'; id: string }>;
}

export interface StoryShelf {
  protagonist: StoryShelfSlot;
  goal: StoryShelfSlot;
  event: StoryShelfSlot;
  difficulty: StoryShelfSlot;
  turn: StoryShelfSlot;
  ending: StoryShelfSlot;
}

// 设计文档 §"来源关系" 六类：
//   child-originated   儿童独立提出
//   trace-elicited     由 trace 直接引出（重看素材后想到）
//   ai-elicited        AI 的提问启发孩子想到
//   ai-adopted         采用了 AI 的方向
//   ai-transformed     在 AI 建议基础上改写
//   ai-rejected        看过但明确拒绝
export type SourceRelation =
  | 'child-originated'
  | 'trace-elicited'
  | 'ai-elicited'
  | 'ai-adopted'
  | 'ai-transformed'
  | 'ai-rejected';

export interface DecisionEntry {
  slotKey: 'protagonist' | 'goal' | 'event' | 'difficulty' | 'turn' | 'ending';
  proposer: 'child' | 'ai';
  aiPersona?: 'world-witness' | 'story-coach';
  fromTrace: boolean;
  action: 'adopted' | 'modified' | 'combined' | 'rejected';
  sourceRelation?: SourceRelation;
  reason?: string;
  timestamp: string;
}

export interface Story {
  id: string;
  title: string;
  shelf: StoryShelf;
  createdAt: string;
  updatedAt: string;
  linkedMaterialIds: string[];
  linkedIdeaIds: string[];
  completedAt: string | null;
  decisionLedger: DecisionEntry[];
}

export interface AlchemyRecord {
  id: string;
  materialAId: string;
  materialBId: string;
  materialATitle: string;
  materialBTitle: string;
  result: string;
  createdAt: string;
}

// 设计文档 §9 Idea Card 的确认机制
// origin：想法如何产生（6 项）
// decision：孩子对这张 Idea Card 的决定（4 项）
// 旧数据里没有这两个字段，读时按 sourceKind 迁移。
export type IdeaOrigin =
  | 'pre-ai'          // AI 出现前我已经想到
  | 'trace-relook'    // 重新看素材后想到
  | 'ai-question'     // AI 的问题启发了我
  | 'ai-direction'    // 我采用了 AI 的一个方向
  | 'ai-modified'     // 我改变了 AI 的建议
  | 'ai-combined';    // 我和 AI 的想法组合而成

export type IdeaDecision = 'keep' | 'refine' | 'shelve' | 'discard';

export interface IdeaCard {
  id: string;
  content: string;
  sourceKind: 'ai-inspired' | 'child-edited' | 'combined';
  origin?: IdeaOrigin;
  decision?: IdeaDecision;
  relationship?: string;      // 若来自 Story Fusion：两条线索之间的关系描述
  sourceTraceIds: string[];
  sourceIdeaIds: string[];
  parentAlchemyId: string | null;
  createdAt: string;
}

export interface Reflection {
  id: string;
  storyId: string | null;
  prompt: string;
  answer: string;
  createdAt: string;
}

// First Thoughts（Pre-AI Baseline）—— 需求文档 §3.4
// 针对每条 Trace，孩子在 AI 介入前记录三个问题的初始想法。
// 一条 Trace 只能有一份 FirstThought（若已存在则覆盖），保证是"最初的"想法。
export interface FirstThought {
  traceId: string;
  actuallySawHeard: string;      // 实际看到/听到什么？
  guessed: string;               // 猜测是什么？
  couldBecome: string;           // 故事中可能变成什么？
  createdAt: string;
  updatedAt: string;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err?.code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeAtomic(file: string, contents: string) {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, contents, "utf8");
  await fs.rename(tmp, file);
}

async function writeJson(file: string, value: unknown) {
  await writeAtomic(file, JSON.stringify(value, null, 2));
}

function nowIso() {
  return new Date().toISOString();
}

export function homeRoot() {
  return ROOT;
}

// ---------- materials ----------

const materialsDir = () => path.join(ROOT, "materials");
const materialsIndex = () => path.join(materialsDir(), "index.json");

export async function listMaterials(): Promise<Material[]> {
  const rows = await readJson<Material[]>(materialsIndex(), []);
  // Lazy migration: add new fields with defaults
  const migrated = rows.map((r) => ({
    ...r,
    iNoticed: r.iNoticed ?? '',
    itRemindsMe: r.itRemindsMe ?? '',
    stillUnsure: r.stillUnsure ?? '',
    aiAllowed: r.aiAllowed ?? true,
    mediaKind: r.mediaKind ?? 'text' as const,
  }));
  return migrated.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function readMaterialBody(id: string): Promise<string> {
  const file = path.join(materialsDir(), `${id}.txt`);
  try {
    return await fs.readFile(file, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return "";
    throw err;
  }
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
}): Promise<Material> {
  const id = randomUUID();
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
  await writeAtomic(path.join(materialsDir(), `${id}.txt`), input.body ?? '');
  const rows = await readJson<Material[]>(materialsIndex(), []);
  rows.push(m);
  await writeJson(materialsIndex(), rows);
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
  }
): Promise<Material | null> {
  const rows = await readJson<Material[]>(materialsIndex(), []);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return null;
  const next = { ...rows[i] };
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
  rows[i] = next;
  await writeJson(materialsIndex(), rows);
  if (patch.body !== undefined) {
    await writeAtomic(path.join(materialsDir(), `${id}.txt`), patch.body);
  }
  return next;
}

export async function deleteMaterial(id: string): Promise<void> {
  const rows = await readJson<Material[]>(materialsIndex(), []);
  const next = rows.filter((r) => r.id !== id);
  await writeJson(materialsIndex(), next);
  try {
    await fs.unlink(path.join(materialsDir(), `${id}.txt`));
  } catch {
    // 文件已不在也没关系
  }
}

export async function getMaterial(id: string): Promise<Material | null> {
  const rows = await readJson<Material[]>(materialsIndex(), []);
  return rows.find((r) => r.id === id) ?? null;
}

// ---------- ideas ----------

const ideasDir = () => path.join(ROOT, "ideas");
const ideasIndex = () => path.join(ideasDir(), "index.json");

export async function listIdeaCards(): Promise<IdeaCard[]> {
  const rows = await readJson<IdeaCard[]>(ideasIndex(), []);
  // 迁移旧数据：为缺 origin/decision 的旧卡按 sourceKind 补默认
  const migrated = rows.map((r) => {
    if (r.origin && r.decision) return r;
    const origin: IdeaOrigin =
      r.origin ??
      (r.sourceKind === 'ai-inspired'
        ? 'ai-direction'
        : r.sourceKind === 'combined'
          ? 'ai-combined'
          : 'ai-modified');
    const decision: IdeaDecision = r.decision ?? 'keep';
    return { ...r, origin, decision };
  });
  return migrated.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getIdeaCard(id: string): Promise<IdeaCard | null> {
  const rows = await readJson<IdeaCard[]>(ideasIndex(), []);
  return rows.find((r) => r.id === id) ?? null;
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
  const id = randomUUID();
  const card: IdeaCard = {
    id,
    content: input.content,
    sourceKind: input.sourceKind,
    origin:
      input.origin ??
      (input.sourceKind === 'ai-inspired'
        ? 'ai-direction'
        : input.sourceKind === 'combined'
          ? 'ai-combined'
          : 'ai-modified'),
    decision: input.decision ?? 'keep',
    relationship: input.relationship,
    sourceTraceIds: input.sourceTraceIds ?? [],
    sourceIdeaIds: input.sourceIdeaIds ?? [],
    parentAlchemyId: input.parentAlchemyId ?? null,
    createdAt: nowIso(),
  };
  const rows = await readJson<IdeaCard[]>(ideasIndex(), []);
  rows.push(card);
  await writeJson(ideasIndex(), rows);
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
  const rows = await readJson<IdeaCard[]>(ideasIndex(), []);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return null;
  const next = { ...rows[i] };
  if (patch.content !== undefined) next.content = patch.content;
  if (patch.sourceKind !== undefined) next.sourceKind = patch.sourceKind;
  if (patch.origin !== undefined) next.origin = patch.origin;
  if (patch.decision !== undefined) next.decision = patch.decision;
  if (patch.relationship !== undefined) next.relationship = patch.relationship;
  rows[i] = next;
  await writeJson(ideasIndex(), rows);
  return next;
}

export async function deleteIdeaCard(id: string): Promise<void> {
  const rows = await readJson<IdeaCard[]>(ideasIndex(), []);
  const next = rows.filter((r) => r.id !== id);
  await writeJson(ideasIndex(), next);
}

// ---------- stories ----------

const storiesDir = () => path.join(ROOT, "stories");
const storiesIndex = () => path.join(storiesDir(), "index.json");

const emptyShelf = (): StoryShelf => ({
  protagonist: { text: '', sources: [] },
  goal: { text: '', sources: [] },
  event: { text: '', sources: [] },
  difficulty: { text: '', sources: [] },
  turn: { text: '', sources: [] },
  ending: { text: '', sources: [] },
});

export async function listStories(): Promise<Story[]> {
  const rows = await readJson<Story[]>(storiesIndex(), []);
  // 迁移旧数据：从 4-beat storyline 到 6-slot shelf
  const migrated = rows.map((r: any) => {
    let shelf = r.shelf;
    if (!shelf && r.storyline) {
      // 旧 4-beat 映射到 6-slot
      shelf = {
        protagonist: { text: r.storyline.qi || '', sources: [] },
        goal: { text: '', sources: [] },
        event: { text: r.storyline.cheng || '', sources: [] },
        difficulty: { text: r.storyline.zhuan || '', sources: [] },
        turn: { text: '', sources: [] },
        ending: { text: r.storyline.he || '', sources: [] },
      };
    }
    return {
      ...r,
      shelf: shelf ?? emptyShelf(),
      completedAt: r.completedAt ?? null,
      linkedMaterialIds: r.linkedMaterialIds ?? [],
      linkedIdeaIds: r.linkedIdeaIds ?? [],
      decisionLedger: r.decisionLedger ?? [],
    };
  });
  return migrated.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export async function readStoryBody(id: string): Promise<string> {
  const file = path.join(storiesDir(), `${id}.txt`);
  try {
    return await fs.readFile(file, "utf8");
  } catch (err: any) {
    if (err?.code === "ENOENT") return "";
    throw err;
  }
}

export async function getStory(id: string): Promise<Story | null> {
  // 复用 listStories 里的迁移逻辑
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
  const id = randomUUID();
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
  await writeAtomic(path.join(storiesDir(), `${id}.txt`), input.body ?? "");
  const rows = await readJson<Story[]>(storiesIndex(), []);
  rows.push(s);
  await writeJson(storiesIndex(), rows);
  return s;
}

export async function completeStory(id: string): Promise<Story | null> {
  const rows = await readJson<Story[]>(storiesIndex(), []);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return null;
  const now = nowIso();
  const next: Story = { ...rows[i], completedAt: now, updatedAt: now };
  rows[i] = next;
  await writeJson(storiesIndex(), rows);
  return next;
}

export async function reopenStory(id: string): Promise<Story | null> {
  const rows = await readJson<Story[]>(storiesIndex(), []);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return null;
  const next: Story = { ...rows[i], completedAt: null, updatedAt: nowIso() };
  rows[i] = next;
  await writeJson(storiesIndex(), rows);
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
  const rows = await readJson<Story[]>(storiesIndex(), []);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return null;
  const next = { ...rows[i] };
  if (patch.title !== undefined) next.title = patch.title.trim() || "新故事";
  if (patch.shelf) {
    next.shelf = { ...next.shelf, ...patch.shelf };
  }
  if (patch.linkedMaterialIds !== undefined) next.linkedMaterialIds = patch.linkedMaterialIds;
  if (patch.linkedIdeaIds !== undefined) next.linkedIdeaIds = patch.linkedIdeaIds;
  if (patch.decisionLedger !== undefined) next.decisionLedger = patch.decisionLedger;
  next.updatedAt = nowIso();
  rows[i] = next;
  await writeJson(storiesIndex(), rows);
  if (patch.body !== undefined) {
    await writeAtomic(path.join(storiesDir(), `${id}.txt`), patch.body);
  }
  return next;
}

export async function deleteStory(id: string): Promise<void> {
  const rows = await readJson<Story[]>(storiesIndex(), []);
  const next = rows.filter((r) => r.id !== id);
  await writeJson(storiesIndex(), next);
  try {
    await fs.unlink(path.join(storiesDir(), `${id}.txt`));
  } catch {
    // 文件已不在
  }
}

// ---------- alchemy ----------

const alchemyDir = () => path.join(ROOT, "alchemy");
const alchemyIndex = () => path.join(alchemyDir(), "index.json");

export async function listAlchemy(): Promise<AlchemyRecord[]> {
  const rows = await readJson<AlchemyRecord[]>(alchemyIndex(), []);
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function saveAlchemy(input: {
  materialAId: string;
  materialBId: string;
  materialATitle: string;
  materialBTitle: string;
  result: string;
}): Promise<AlchemyRecord> {
  const rec: AlchemyRecord = {
    id: randomUUID(),
    ...input,
    createdAt: nowIso(),
  };
  const rows = await readJson<AlchemyRecord[]>(alchemyIndex(), []);
  rows.push(rec);
  await writeJson(alchemyIndex(), rows);
  return rec;
}

export async function deleteAlchemy(id: string): Promise<void> {
  const rows = await readJson<AlchemyRecord[]>(alchemyIndex(), []);
  await writeJson(alchemyIndex(), rows.filter((r) => r.id !== id));
}

// ---------- reflections ----------

const reflectionsDir = () => path.join(ROOT, "reflections");
const reflectionsIndex = () => path.join(reflectionsDir(), "index.json");

export async function listReflections(): Promise<Reflection[]> {
  const rows = await readJson<Reflection[]>(reflectionsIndex(), []);
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function saveReflection(input: {
  storyId: string | null;
  prompt: string;
  answer: string;
}): Promise<Reflection> {
  const rec: Reflection = {
    id: randomUUID(),
    storyId: input.storyId,
    prompt: input.prompt,
    answer: input.answer,
    createdAt: nowIso(),
  };
  const rows = await readJson<Reflection[]>(reflectionsIndex(), []);
  rows.push(rec);
  await writeJson(reflectionsIndex(), rows);
  return rec;
}

export async function deleteReflection(id: string): Promise<void> {
  const rows = await readJson<Reflection[]>(reflectionsIndex(), []);
  await writeJson(reflectionsIndex(), rows.filter((r) => r.id !== id));
}

// ---------- first thoughts (Pre-AI Baseline) ----------
// 需求文档 §3.4：每条 Trace 至多一份 FirstThought，覆写而不追加。
// 存在 materials 目录下的独立索引文件里。

const firstThoughtsIndex = () => path.join(ROOT, "materials", "first-thoughts.json");

export async function listFirstThoughts(): Promise<FirstThought[]> {
  return readJson<FirstThought[]>(firstThoughtsIndex(), []);
}

export async function getFirstThought(traceId: string): Promise<FirstThought | null> {
  const rows = await listFirstThoughts();
  return rows.find((r) => r.traceId === traceId) ?? null;
}

export async function saveFirstThought(input: {
  traceId: string;
  actuallySawHeard: string;
  guessed: string;
  couldBecome: string;
}): Promise<FirstThought> {
  const rows = await listFirstThoughts();
  const i = rows.findIndex((r) => r.traceId === input.traceId);
  const now = nowIso();
  let entry: FirstThought;
  if (i === -1) {
    entry = { ...input, createdAt: now, updatedAt: now };
    rows.push(entry);
  } else {
    entry = { ...rows[i], ...input, updatedAt: now };
    rows[i] = entry;
  }
  await writeJson(firstThoughtsIndex(), rows);
  return entry;
}

export async function deleteFirstThought(traceId: string): Promise<void> {
  const rows = await listFirstThoughts();
  await writeJson(firstThoughtsIndex(), rows.filter((r) => r.traceId !== traceId));
}

// ---------- CHI event log (埋点日志) ----------
// 设计文档 §4 / §"系统自动保存的数据"：完整记录采集、trace 选择、AI 授权、
// pre-AI ideas、AI 提示与建议、Idea Card 修改、Story Shelf 变化、写作历史、
// Agent 使用、来源回顾等事件流，用于 CHI 分析导出。
// 单纯追加写（append-only），存在 ~/TraceBound/logs/events.json。

export type EventType =
  | 'outdoor-observe'        // 户外慢观察（停留 / 跳过提示）
  | 'trace-capture'          // 采集一条 trace
  | 'trace-select'           // 选择 trace 带入故事
  | 'trace-ai-permission'    // 修改 trace 的 AI 读取授权
  | 'first-thought'          // 保存 pre-AI 想法
  | 'alchemy-brew'           // Story Fusion Board 合成
  | 'idea-card-create'       // 创建 Idea Card
  | 'idea-card-update'       // 修改 Idea Card
  | 'agent-ask'              // 召唤 World Witness / Story Coach
  | 'decision'               // 记录一条叙事决定
  | 'story-complete'         // 完成故事
  | 'reflection';            // 来源回顾 / 反思

export interface EventLogEntry {
  id: string;
  type: EventType;
  condition: ExperimentCondition;
  storyId?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

const eventsFile = () => path.join(ROOT, "logs", "events.json");

export async function listEvents(): Promise<EventLogEntry[]> {
  const rows = await readJson<EventLogEntry[]>(eventsFile(), []);
  return rows;
}

export async function appendEvent(input: {
  type: EventType;
  condition: ExperimentCondition;
  storyId?: string;
  payload?: Record<string, unknown>;
}): Promise<EventLogEntry> {
  const entry: EventLogEntry = {
    id: randomUUID(),
    type: input.type,
    condition: input.condition,
    storyId: input.storyId,
    payload: input.payload ?? {},
    timestamp: nowIso(),
  };
  const rows = await readJson<EventLogEntry[]>(eventsFile(), []);
  rows.push(entry);
  await writeJson(eventsFile(), rows);
  return entry;
}

// 导出为 NDJSON 文本（每行一个事件），便于 CHI 分析工具消费。
export async function exportEventsNdjson(): Promise<string> {
  const rows = await listEvents();
  return rows.map((r) => JSON.stringify(r)).join("\n");
}

// ---------- AI settings (本地控制的 API key / provider / model) ----------
// 保存在 ~/TraceBound/settings/ai.json，覆盖环境变量。
// 首次未创建文件时，会退回读取 process.env（老部署方式兼容）。

const settingsFile = () => path.join(ROOT, "settings", "ai.json");

function defaultAiSettings(): AiSettings {
  const envProvider = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  let provider: AiProvider = "mock";
  if (envProvider === "anthropic" || envProvider === "openai-compat" || envProvider === "mock") {
    provider = envProvider as AiProvider;
  } else if (process.env.ANTHROPIC_API_KEY) {
    provider = "anthropic";
  } else if (process.env.AI_API_KEY && process.env.AI_BASE_URL) {
    provider = "openai-compat";
  }
  const envCondition = (process.env.EXPERIMENT_CONDITION ?? "").trim().toLowerCase();
  const condition: ExperimentCondition =
    envCondition === "topic-based" ? "topic-based" : "trace-bound";
  return {
    provider,
    condition,
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY ?? "",
      model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8",
      baseUrl: process.env.ANTHROPIC_BASE_URL ?? "",
    },
    openaiCompat: {
      apiKey: process.env.AI_API_KEY ?? "",
      model: process.env.AI_MODEL ?? "",
      baseUrl: process.env.AI_BASE_URL ?? "",
    },
  };
}

export async function getAiSettings(): Promise<AiSettings> {
  const fromFile = await readJson<Partial<AiSettings> | null>(settingsFile(), null);
  const defaults = defaultAiSettings();
  if (!fromFile) return defaults;
  return {
    provider:
      fromFile.provider === "anthropic" ||
      fromFile.provider === "openai-compat" ||
      fromFile.provider === "mock"
        ? fromFile.provider
        : defaults.provider,
    condition:
      fromFile.condition === "trace-bound" || fromFile.condition === "topic-based"
        ? fromFile.condition
        : defaults.condition,
    anthropic: {
      apiKey: fromFile.anthropic?.apiKey ?? defaults.anthropic.apiKey,
      model: fromFile.anthropic?.model ?? defaults.anthropic.model,
      baseUrl: fromFile.anthropic?.baseUrl ?? defaults.anthropic.baseUrl,
    },
    openaiCompat: {
      apiKey: fromFile.openaiCompat?.apiKey ?? defaults.openaiCompat.apiKey,
      model: fromFile.openaiCompat?.model ?? defaults.openaiCompat.model,
      baseUrl: fromFile.openaiCompat?.baseUrl ?? defaults.openaiCompat.baseUrl,
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
  await writeJson(settingsFile(), next);
  return next;
}

