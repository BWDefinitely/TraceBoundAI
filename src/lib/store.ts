import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

// 本地文件存储。所有数据写到用户家目录下的 TraceBound/ 里：
//
//   ~/TraceBound/
//     materials/
//       index.json                    素材元数据数组
//       <id>.txt                      素材正文（纯文本）
//     stories/
//       index.json                    故事元数据数组（含故事线四段）
//       <id>.txt                      故事正文
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
}

export interface StorylineBeat {
  qi: string;
  cheng: string;
  zhuan: string;
  he: string;
}

export interface Story {
  id: string;
  title: string;
  storyline: StorylineBeat;
  createdAt: string;
  updatedAt: string;
  linkedMaterialIds: string[];
  completedAt: string | null;
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

export interface Reflection {
  id: string;
  storyId: string | null;
  prompt: string;
  answer: string;
  createdAt: string;
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
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
  body: string;
  tags?: string[];
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
  };
  await writeAtomic(path.join(materialsDir(), `${id}.txt`), input.body);
  const rows = await readJson<Material[]>(materialsIndex(), []);
  rows.push(m);
  await writeJson(materialsIndex(), rows);
  return m;
}

export async function updateMaterial(
  id: string,
  patch: { title?: string; kind?: MaterialKind; body?: string; tags?: string[]; favorite?: boolean }
): Promise<Material | null> {
  const rows = await readJson<Material[]>(materialsIndex(), []);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return null;
  const next = { ...rows[i] };
  if (patch.title !== undefined) next.title = patch.title.trim() || "未命名素材";
  if (patch.kind !== undefined) next.kind = patch.kind;
  if (patch.tags !== undefined) next.tags = patch.tags;
  if (patch.favorite !== undefined) next.favorite = patch.favorite;
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

// ---------- stories ----------

const storiesDir = () => path.join(ROOT, "stories");
const storiesIndex = () => path.join(storiesDir(), "index.json");

const emptyStoryline = (): StorylineBeat => ({ qi: "", cheng: "", zhuan: "", he: "" });

export async function listStories(): Promise<Story[]> {
  const rows = await readJson<Story[]>(storiesIndex(), []);
  // 迁移旧数据：给缺失的字段补默认
  const migrated = rows.map((r) => ({
    ...r,
    completedAt: r.completedAt ?? null,
    linkedMaterialIds: r.linkedMaterialIds ?? [],
    storyline: r.storyline ?? emptyStoryline(),
  }));
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
  const rows = await readJson<Story[]>(storiesIndex(), []);
  return rows.find((r) => r.id === id) ?? null;
}

export async function createStory(input: {
  title?: string;
  body?: string;
  storyline?: StorylineBeat;
  linkedMaterialIds?: string[];
}): Promise<Story> {
  const id = randomUUID();
  const now = nowIso();
  const s: Story = {
    id,
    title: (input.title ?? "").trim() || "新故事",
    storyline: input.storyline ?? emptyStoryline(),
    createdAt: now,
    updatedAt: now,
    linkedMaterialIds: input.linkedMaterialIds ?? [],
    completedAt: null,
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
    storyline?: Partial<StorylineBeat>;
    linkedMaterialIds?: string[];
  }
): Promise<Story | null> {
  const rows = await readJson<Story[]>(storiesIndex(), []);
  const i = rows.findIndex((r) => r.id === id);
  if (i === -1) return null;
  const next = { ...rows[i] };
  if (patch.title !== undefined) next.title = patch.title.trim() || "新故事";
  if (patch.storyline) next.storyline = { ...next.storyline, ...patch.storyline };
  if (patch.linkedMaterialIds !== undefined) next.linkedMaterialIds = patch.linkedMaterialIds;
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
