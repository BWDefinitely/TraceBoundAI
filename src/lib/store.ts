// 纯类型定义 + 迁移辅助。数据实际读写全部在浏览器 IndexedDB 里完成
// （见 client-store.ts）。此文件不再触碰 node:fs / node:crypto，可安全被
// 客户端组件引用，部署到 Vercel（serverless 只读文件系统）也不会报错。

export type { AiProvider, AiSettings } from "./ai-settings";
import type { AiProvider, AiSettings } from "./ai-settings";

export type MaterialKind = "观察" | "感受" | "想法" | "对话" | "人物" | "物品";

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
  mediaKind: 'text' | 'photo' | 'audio';  // 多模态：真实图片/音频存 IndexedDB 的 media store
}

// ========== 新版故事结构（起承转合 + 时地人事） ==========

export interface StoryMetadata {
  time: string;      // 时间
  place: string;     // 地点
  people: string[];  // 人物（可多个）
  event: string;     // 事件
}

export interface StorySlot {
  text: string;
  linkedMaterials: string[];  // 拖拽到此槽位的素材卡 ID
}

export interface StoryStructure {
  discovery: StorySlot;   // 发现
  goal: StorySlot;        // 目标
  accident: StorySlot;    // 意外
  action: StorySlot;      // 行动
  change: StorySlot;      // 改变
}

export interface Story {
  id: string;
  title: string;
  metadata: StoryMetadata;    // 时间/地点/人物/事件
  structure: StoryStructure;  // 起承转合，每个槽位可拖拽素材
  body: string;               // 正文
  aiWordCount: number;        // AI 生成字数
  userWordCount: number;      // 用户自写字数
  sceneImages?: Array<{ blobId: string; prompt: string; description?: string; createdAt: string }>;      // 生成的场景图片（存 media store 的 Blob ID）
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

// ========== 旧版兼容（迁移用） ==========

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

// 旧版 Story 结构（仅用于迁移）
export interface LegacyStory {
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

// ========== 批量图片导入 ==========

export type ImportImageStatus = 'pending' | 'saved' | 'discarded';

export interface ImportImage {
  id: string;
  blobId: string;           // 存在 media store 的 Blob ID
  materialName?: string;    // 素材名字
  status: ImportImageStatus;
  whyTook?: string;         // 我为什么拍它
  myThoughts?: string;      // 我的想法
  guidanceHint?: string;    // AI观察指导提示
  kind?: MaterialKind;      // 素材类型
}

export interface ImportBatch {
  id: string;
  images: ImportImage[];
  createdAt: string;
  updatedAt: string;
}

// 设计文档 §9 Idea Card 的确认机制
export type IdeaOrigin =
  | 'pre-ai'
  | 'trace-relook'
  | 'ai-question'
  | 'ai-direction'
  | 'ai-modified'
  | 'ai-combined';

export type IdeaDecision = 'keep' | 'refine' | 'shelve' | 'discard';

export interface IdeaCard {
  id: string;
  content: string;
  sourceKind: 'ai-inspired' | 'child-edited' | 'combined';
  origin?: IdeaOrigin;
  decision?: IdeaDecision;
  relationship?: string;
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
export interface FirstThought {
  traceId: string;
  actuallySawHeard: string;
  guessed: string;
  couldBecome: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- CHI event log 类型 ----------
export type EventType =
  | 'outdoor-observe'
  | 'trace-capture'
  | 'trace-select'
  | 'trace-ai-permission'
  | 'first-thought'
  | 'alchemy-brew'
  | 'idea-card-create'
  | 'idea-card-update'
  | 'agent-ask'
  | 'decision'
  | 'story-complete'
  | 'reflection';

export interface EventLogEntry {
  id: string;
  type: EventType;
  storyId?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ---------- 迁移辅助（被 client-store 复用） ----------

export const emptyMetadata = (): StoryMetadata => ({
  time: '',
  place: '',
  people: [],
  event: '',
});

export const emptyStorySlot = (): StorySlot => ({
  text: '',
  linkedMaterials: [],
});

export const emptyStructure = (): StoryStructure => ({
  discovery: emptyStorySlot(),
  goal: emptyStorySlot(),
  accident: emptyStorySlot(),
  action: emptyStorySlot(),
  change: emptyStorySlot(),
});

export const emptyShelf = (): StoryShelf => ({
  protagonist: { text: '', sources: [] },
  goal: { text: '', sources: [] },
  event: { text: '', sources: [] },
  difficulty: { text: '', sources: [] },
  turn: { text: '', sources: [] },
  ending: { text: '', sources: [] },
});

export function migrateMaterial(r: Material): Material {
  return {
    ...r,
    iNoticed: r.iNoticed ?? '',
    itRemindsMe: r.itRemindsMe ?? '',
    stillUnsure: r.stillUnsure ?? '',
    aiAllowed: r.aiAllowed ?? true,
    mediaKind: r.mediaKind ?? 'text',
  };
}

export function migrateIdeaCard(r: IdeaCard): IdeaCard {
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
}

export function migrateStory(r: any): Story {
  // 如果已经是新版结构，直接返回
  if (r.metadata && r.structure) {
    return {
      ...r,
      metadata: r.metadata ?? emptyMetadata(),
      structure: r.structure ?? emptyStructure(),
      aiWordCount: r.aiWordCount ?? 0,
      userWordCount: r.userWordCount ?? 0,
      sceneImages: r.sceneImages ?? [],
      completedAt: r.completedAt ?? null,
    };
  }

  // 旧版迁移：shelf → structure（简化映射，起承转合为空）
  return {
    id: r.id,
    title: r.title || '未命名故事',
    metadata: emptyMetadata(),
    structure: emptyStructure(),
    body: '',
    aiWordCount: 0,
    userWordCount: 0,
    sceneImages: [],
    createdAt: r.createdAt || new Date().toISOString(),
    updatedAt: r.updatedAt || new Date().toISOString(),
    completedAt: r.completedAt ?? null,
  };
}

export function defaultIdeaOrigin(
  sourceKind: IdeaCard['sourceKind'],
  origin?: IdeaOrigin
): IdeaOrigin {
  return (
    origin ??
    (sourceKind === 'ai-inspired'
      ? 'ai-direction'
      : sourceKind === 'combined'
        ? 'ai-combined'
        : 'ai-modified')
  );
}
