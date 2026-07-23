"use server";

import { revalidatePath } from "next/cache";
import { brewAlchemy } from "../lib/ai";
import {
  MaterialKind,
  createMaterial,
  deleteMaterial,
  updateMaterial,
  createStory,
  updateStory,
  deleteStory,
  completeStory,
  reopenStory,
  readMaterialBody,
  saveAlchemy,
  deleteAlchemy,
  listMaterials,
  saveReflection,
  deleteReflection,
} from "../lib/store";

const KINDS: MaterialKind[] = ["观察", "感受", "想法", "对话", "声音", "画面"];

function refreshAll() {
  revalidatePath("/", "layout");
}

// ---------- materials ----------

export async function createMaterialAction(input: {
  title: string;
  kind: string;
  body: string;
  tags: string;
}) {
  const kind: MaterialKind = (KINDS as string[]).includes(input.kind)
    ? (input.kind as MaterialKind)
    : "观察";
  const body = input.body ?? "";
  const title = input.title.trim();
  if (!body.trim() && !title) {
    return { ok: false as const, message: "写一点点内容再保存吧" };
  }
  const tags = input.tags
    ? input.tags
        .split(/[，,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    : [];
  const m = await createMaterial({ title, kind, body, tags });
  refreshAll();
  return { ok: true as const, material: m };
}

export async function updateMaterialAction(
  id: string,
  patch: { title?: string; kind?: string; body?: string; tags?: string; favorite?: boolean }
) {
  const kind: MaterialKind | undefined = patch.kind
    ? ((KINDS as string[]).includes(patch.kind) ? (patch.kind as MaterialKind) : "观察")
    : undefined;
  const tags = patch.tags !== undefined
    ? patch.tags
        .split(/[，,\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
    : undefined;
  await updateMaterial(id, {
    title: patch.title,
    kind,
    body: patch.body,
    tags,
    favorite: patch.favorite,
  });
  refreshAll();
}

export async function deleteMaterialAction(id: string) {
  await deleteMaterial(id);
  refreshAll();
}

// ---------- stories ----------

export async function createStoryAction(title = "新故事") {
  const s = await createStory({ title, body: "" });
  refreshAll();
  return { id: s.id };
}

export async function saveStoryAction(
  id: string,
  patch: {
    title?: string;
    body?: string;
    storyline?: { qi?: string; cheng?: string; zhuan?: string; he?: string };
    linkedMaterialIds?: string[];
  }
) {
  await updateStory(id, patch);
  refreshAll();
}

export async function deleteStoryAction(id: string) {
  await deleteStory(id);
  refreshAll();
}

export async function completeStoryAction(id: string) {
  const s = await completeStory(id);
  refreshAll();
  return s;
}

export async function reopenStoryAction(id: string) {
  const s = await reopenStory(id);
  refreshAll();
  return s;
}

// ---------- alchemy ----------

export async function brewAction(input: { aId: string; bId: string }) {
  const all = await listMaterials();
  const a = all.find((m) => m.id === input.aId);
  const b = all.find((m) => m.id === input.bId);
  if (!a || !b) return { ok: false as const, message: "有一份素材已找不到了。" };
  if (a.id === b.id) return { ok: false as const, message: "选两份不一样的素材才能炼金。" };

  const [aText, bText] = await Promise.all([readMaterialBody(a.id), readMaterialBody(b.id)]);
  const result = await brewAlchemy({
    materialATitle: a.title,
    materialAKind: a.kind,
    materialAText: aText,
    materialBTitle: b.title,
    materialBKind: b.kind,
    materialBText: bText,
  });
  const rec = await saveAlchemy({
    materialAId: a.id,
    materialBId: b.id,
    materialATitle: a.title,
    materialBTitle: b.title,
    result,
  });
  refreshAll();
  return { ok: true as const, record: rec };
}

export async function deleteAlchemyAction(id: string) {
  await deleteAlchemy(id);
  refreshAll();
}

// ---------- reflections ----------

export async function saveReflectionAction(input: {
  storyId: string | null;
  prompt: string;
  answer: string;
}) {
  if (!input.answer.trim()) return { ok: false as const, message: "写一两句再保存吧。" };
  const rec = await saveReflection({
    storyId: input.storyId,
    prompt: input.prompt.trim() || "我的反思",
    answer: input.answer,
  });
  refreshAll();
  return { ok: true as const, record: rec };
}

export async function deleteReflectionAction(id: string) {
  await deleteReflection(id);
  refreshAll();
}
