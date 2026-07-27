"use client";

// 纯前端"actions"。原本是 Next.js server actions（写服务器文件系统），
// 现在整个数据层搬到浏览器 IndexedDB（见 lib/client-store），因此这些函数
// 直接在客户端跑。导出名保持不变，上层组件 import 无需改动。
//
// 写操作完成后广播 `tracebound:changed` 事件，DataProvider 监听后重载数据、
// 触发 UI 刷新（替代原来的 revalidatePath）。

import { askAgent, brewAlchemy, type CreativeMode, type Persona } from "../lib/ai";
import {
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
  createIdeaCard,
  updateIdeaCard,
  deleteIdeaCard,
  listIdeaCards,
  getStory,
  saveFirstThought,
  deleteFirstThought,
  listFirstThoughts,
  readStoryBody,
  getAiSettings,
  saveAiSettings,
  appendEvent,
  exportEventsNdjson,
} from "../lib/client-store";
import type {
  MaterialKind,
  EventType,
  IdeaCard,
  StoryShelf,
  DecisionEntry,
} from "../lib/store";
import type { AiSettings, AiProvider, ExperimentCondition } from "../lib/ai-settings";

const KINDS: MaterialKind[] = ["观察", "感受", "想法", "对话", "声音", "画面"];
const MEDIA_KINDS = ["text", "photo", "audio"] as const;
type MediaKind = (typeof MEDIA_KINDS)[number];

export const DATA_CHANGED_EVENT = "tracebound:changed";

function refreshAll() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
  }
}

// CHI 埋点：把事件写进事件日志，读取当前实验条件一并记录，失败不影响主流程。
async function logEvent(
  type: EventType,
  payload?: Record<string, unknown>,
  storyId?: string
) {
  try {
    const settings = await getAiSettings();
    await appendEvent({ type, condition: settings.condition, storyId, payload });
  } catch (err) {
    console.error(`[events] failed to log ${type}:`, err);
  }
}

// ---------- materials (Traces) ----------

export async function createMaterialAction(input: {
  title: string;
  kind: string;
  tags: string;
  iNoticed?: string;
  itRemindsMe?: string;
  stillUnsure?: string;
  aiAllowed?: boolean;
  mediaKind?: string;
  media?: Blob;
}) {
  const kind: MaterialKind = (KINDS as string[]).includes(input.kind)
    ? (input.kind as MaterialKind)
    : "观察";
  const mediaKind: MediaKind =
    input.mediaKind && (MEDIA_KINDS as readonly string[]).includes(input.mediaKind)
      ? (input.mediaKind as MediaKind)
      : "text";
  const title = input.title.trim();
  const iNoticed = (input.iNoticed ?? "").trim();
  const itRemindsMe = (input.itRemindsMe ?? "").trim();
  const stillUnsure = (input.stillUnsure ?? "").trim();
  if (!title && !iNoticed && !itRemindsMe && !stillUnsure) {
    return { ok: false as const, message: "至少填一个字段再保存吧" };
  }
  const tags = input.tags
    ? input.tags.split(/[，,\s]+/).map((t) => t.trim()).filter(Boolean)
    : [];
  const m = await createMaterial({
    title,
    kind,
    tags,
    iNoticed,
    itRemindsMe,
    stillUnsure,
    aiAllowed: input.aiAllowed ?? true,
    mediaKind,
    media: input.media,
  });
  await logEvent("trace-capture", { traceId: m.id, mediaKind: m.mediaKind, aiAllowed: m.aiAllowed });
  refreshAll();
  return { ok: true as const, material: m };
}

export async function updateMaterialAction(
  id: string,
  patch: {
    title?: string;
    kind?: string;
    tags?: string;
    favorite?: boolean;
    iNoticed?: string;
    itRemindsMe?: string;
    stillUnsure?: string;
    aiAllowed?: boolean;
    mediaKind?: string;
    media?: Blob;
  }
) {
  const kind: MaterialKind | undefined = patch.kind
    ? (KINDS as string[]).includes(patch.kind)
      ? (patch.kind as MaterialKind)
      : "观察"
    : undefined;
  const mediaKind: MediaKind | undefined = patch.mediaKind
    ? (MEDIA_KINDS as readonly string[]).includes(patch.mediaKind)
      ? (patch.mediaKind as MediaKind)
      : undefined
    : undefined;
  const tags =
    patch.tags !== undefined
      ? patch.tags.split(/[，,\s]+/).map((t) => t.trim()).filter(Boolean)
      : undefined;
  await updateMaterial(id, {
    title: patch.title,
    kind,
    tags,
    favorite: patch.favorite,
    iNoticed: patch.iNoticed,
    itRemindsMe: patch.itRemindsMe,
    stillUnsure: patch.stillUnsure,
    aiAllowed: patch.aiAllowed,
    mediaKind,
    media: patch.media,
  });
  if (patch.aiAllowed !== undefined) {
    await logEvent("trace-ai-permission", { traceId: id, aiAllowed: patch.aiAllowed });
  }
  refreshAll();
}

export async function deleteMaterialAction(id: string) {
  await deleteMaterial(id);
  refreshAll();
}

// ---------- Idea Cards ----------

export async function createIdeaCardAction(input: {
  content: string;
  sourceKind: IdeaCard["sourceKind"];
  origin?: IdeaCard["origin"];
  decision?: IdeaCard["decision"];
  relationship?: string;
  sourceTraceIds?: string[];
  sourceIdeaIds?: string[];
  parentAlchemyId?: string | null;
}) {
  if (!input.content.trim()) {
    return { ok: false as const, message: "先写点内容再保存 Idea Card" };
  }
  const card = await createIdeaCard(input);
  await logEvent("idea-card-create", {
    ideaId: card.id,
    sourceKind: card.sourceKind,
    origin: card.origin,
    decision: card.decision,
    sourceTraceIds: card.sourceTraceIds,
  });
  refreshAll();
  return { ok: true as const, card };
}

export async function updateIdeaCardAction(
  id: string,
  patch: {
    content?: string;
    sourceKind?: IdeaCard["sourceKind"];
    origin?: IdeaCard["origin"];
    decision?: IdeaCard["decision"];
    relationship?: string;
  }
) {
  const card = await updateIdeaCard(id, patch);
  await logEvent("idea-card-update", { ideaId: id, ...patch });
  refreshAll();
  return card;
}

export async function deleteIdeaCardAction(id: string) {
  await deleteIdeaCard(id);
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
    shelf?: Partial<StoryShelf>;
    linkedMaterialIds?: string[];
    linkedIdeaIds?: string[];
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
  await logEvent("story-complete", { title: s?.title }, id);
  refreshAll();
  return s;
}

export async function reopenStoryAction(id: string) {
  const s = await reopenStory(id);
  refreshAll();
  return s;
}

export async function appendDecisionAction(
  storyId: string,
  entry: Omit<DecisionEntry, "timestamp">
) {
  const s = await getStory(storyId);
  if (!s) return;
  const newEntry: DecisionEntry = { ...entry, timestamp: new Date().toISOString() };
  const ledger = [...(s.decisionLedger ?? []), newEntry];
  await updateStory(storyId, { decisionLedger: ledger });
  await logEvent("decision", { ...newEntry }, storyId);
  refreshAll();
}

// ---------- alchemy ----------

export async function brewAction(input: { aId: string; bId: string; relationship?: string }) {
  const all = await listMaterials();
  const a = all.find((m) => m.id === input.aId);
  const b = all.find((m) => m.id === input.bId);
  if (!a || !b) return { ok: false as const, message: "有一份素材已找不到了。" };
  if (a.id === b.id) return { ok: false as const, message: "选两份不一样的素材才能炼金。" };
  if (!a.aiAllowed || !b.aiAllowed) {
    return { ok: false as const, message: "其中一份素材没有开启「允许 AI 读取」。" };
  }

  // 设计文档 §"两个实验条件"：Story Fusion Board 在两个条件下都相同（都可用），
  // 唯一差异是 AI 是否能直接访问并引用孩子的原始多模态痕迹及其来源。
  const settings = await getAiSettings();
  const traceBound = settings.condition === "trace-bound";

  const [aText, bText] = traceBound
    ? await Promise.all([readMaterialBody(a.id), readMaterialBody(b.id)])
    : ["", ""];
  const composeText = (m: typeof a, body: string) => {
    if (!traceBound) return "";
    const parts: string[] = [];
    if (body.trim()) parts.push(body);
    if (m.iNoticed) parts.push(`我注意到：${m.iNoticed}`);
    if (m.itRemindsMe) parts.push(`它让我想到：${m.itRemindsMe}`);
    if (m.stillUnsure) parts.push(`还不确定：${m.stillUnsure}`);
    return parts.join("\n");
  };
  const result = await brewAlchemy(
    {
      materialATitle: a.title,
      materialAKind: a.kind,
      materialAText: composeText(a, aText),
      materialBTitle: b.title,
      materialBKind: b.kind,
      materialBText: composeText(b, bText),
      relationship: input.relationship?.trim() || undefined,
    },
    settings
  );
  const rec = await saveAlchemy({
    materialAId: a.id,
    materialBId: b.id,
    materialATitle: a.title,
    materialBTitle: b.title,
    result,
  });
  await logEvent("alchemy-brew", {
    alchemyId: rec.id,
    materialAId: a.id,
    materialBId: b.id,
    relationship: input.relationship?.trim() || null,
  });
  refreshAll();
  return { ok: true as const, record: rec };
}

export async function deleteAlchemyAction(id: string) {
  await deleteAlchemy(id);
  refreshAll();
}

// ---------- ask Agent (World Witness / Story Coach) ----------

export async function askAgentAction(input: {
  persona: Persona;
  mode?: CreativeMode;
  userPrompt: string;
  storyId?: string;
  traceIds?: string[];
  ideaIds?: string[];
  includeShelf?: boolean;
  includeStoryBody?: boolean;
}) {
  const settings = await getAiSettings();
  const [allMaterials, allIdeas, story, allFirstThoughts, body] = await Promise.all([
    input.traceIds && input.traceIds.length > 0 ? listMaterials() : Promise.resolve([]),
    input.ideaIds && input.ideaIds.length > 0 ? listIdeaCards() : Promise.resolve([]),
    input.storyId && input.includeShelf ? getStory(input.storyId) : Promise.resolve(null),
    input.traceIds && input.traceIds.length > 0 ? listFirstThoughts() : Promise.resolve([]),
    input.storyId && input.includeStoryBody ? readStoryBody(input.storyId) : Promise.resolve(""),
  ]);
  const traces = input.traceIds
    ? allMaterials.filter((m) => input.traceIds!.includes(m.id) && m.aiAllowed)
    : [];
  const ideas = input.ideaIds ? allIdeas.filter((i) => input.ideaIds!.includes(i.id)) : [];
  const traceIdSet = new Set(traces.map((t) => t.id));
  const firstThoughts = allFirstThoughts.filter((f) => traceIdSet.has(f.traceId));

  const reply = await askAgent({
    persona: input.persona,
    mode: input.mode,
    userPrompt: input.userPrompt,
    settings,
    context: {
      traces: traces.length > 0 ? traces : undefined,
      ideas: ideas.length > 0 ? ideas : undefined,
      shelfSoFar: story?.shelf,
      storyBodySnippet: body || undefined,
      firstThoughts: firstThoughts.length > 0 ? firstThoughts : undefined,
    },
  });
  await logEvent(
    "agent-ask",
    {
      persona: input.persona,
      mode: input.mode,
      traceIds: input.traceIds ?? [],
      ideaIds: input.ideaIds ?? [],
      promptChars: input.userPrompt.length,
      replyChars: reply.length,
    },
    input.storyId
  );
  return { ok: true as const, reply };
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
  await logEvent("reflection", { prompt: rec.prompt }, input.storyId ?? undefined);
  refreshAll();
  return { ok: true as const, record: rec };
}

export async function deleteReflectionAction(id: string) {
  await deleteReflection(id);
  refreshAll();
}

// ---------- first thoughts (Pre-AI Baseline) ----------

export async function saveFirstThoughtAction(input: {
  traceId: string;
  actuallySawHeard: string;
  guessed: string;
  couldBecome: string;
}) {
  if (
    !input.actuallySawHeard.trim() &&
    !input.guessed.trim() &&
    !input.couldBecome.trim()
  ) {
    return { ok: false as const, message: "至少填一个问题的答案再保存吧" };
  }
  const rec = await saveFirstThought(input);
  await logEvent("first-thought", { traceId: input.traceId });
  refreshAll();
  return { ok: true as const, record: rec };
}

export async function deleteFirstThoughtAction(traceId: string) {
  await deleteFirstThought(traceId);
  refreshAll();
}

// ---------- outdoor mission (阶段1) ----------

export async function logOutdoorObserveAction(input: {
  dwellSeconds?: number;
  skippedPrompt?: boolean;
  noticed?: string;
  action?: "observe" | "skip" | "notice" | "record-intent";
}) {
  await logEvent("outdoor-observe", {
    dwellSeconds: input.dwellSeconds ?? 0,
    skippedPrompt: input.skippedPrompt ?? false,
    noticed: input.noticed ?? "",
    action: input.action ?? "observe",
  });
  return { ok: true as const };
}

// ---------- CHI 埋点日志导出 ----------

export async function exportEventsAction(): Promise<{ ok: true; ndjson: string; count: number }> {
  const ndjson = await exportEventsNdjson();
  const count = ndjson ? ndjson.split("\n").length : 0;
  return { ok: true, ndjson, count };
}

// ---------- AI settings ----------

export async function getAiSettingsAction(): Promise<AiSettings> {
  return await getAiSettings();
}

export async function saveAiSettingsAction(patch: {
  provider?: AiProvider;
  condition?: ExperimentCondition;
  anthropic?: { apiKey?: string; model?: string; baseUrl?: string };
  openaiCompat?: { apiKey?: string; model?: string; baseUrl?: string };
}): Promise<{ ok: true; settings: AiSettings }> {
  const current = await getAiSettings();
  const next = await saveAiSettings({
    provider: patch.provider,
    condition: patch.condition,
    anthropic: patch.anthropic
      ? {
          apiKey: patch.anthropic.apiKey ?? current.anthropic.apiKey,
          model: patch.anthropic.model ?? current.anthropic.model,
          baseUrl: patch.anthropic.baseUrl ?? current.anthropic.baseUrl,
        }
      : undefined,
    openaiCompat: patch.openaiCompat
      ? {
          apiKey: patch.openaiCompat.apiKey ?? current.openaiCompat.apiKey,
          model: patch.openaiCompat.model ?? current.openaiCompat.model,
          baseUrl: patch.openaiCompat.baseUrl ?? current.openaiCompat.baseUrl,
        }
      : undefined,
  });
  refreshAll();
  return { ok: true, settings: next };
}
