// 纯类型定义 + 迁移辅助。数据实际读写全部在浏览器 IndexedDB 里完成
// （见 client-store.ts）。此文件不再触碰 node:fs / node:crypto，可安全被
// 客户端组件引用，部署到 Vercel（serverless 只读文件系统）也不会报错。

export type { AiProvider, AiSettings, ExperimentCondition } from "./ai-settings";
import type { AiProvider, AiSettings, ExperimentCondition } from "./ai-settings";

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
  mediaKind: 'text' | 'photo' | 'audio';  // 多模态：真实图片/音频存 IndexedDB 的 media store
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

// 设计文档 §"来源关系" 六类
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
  condition: ExperimentCondition;
  storyId?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ---------- 迁移辅助（被 client-store 复用） ----------

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
  let shelf = r.shelf;
  if (!shelf && r.storyline) {
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
