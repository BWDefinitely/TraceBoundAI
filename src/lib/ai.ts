import Anthropic from "@anthropic-ai/sdk";
import type { Material, IdeaCard, StoryShelf, FirstThought } from "./store";
import type { AiSettings } from "./ai-settings";

// AI 层：为「灵感炼金」联想两份素材 + 双 Agent 辅助故事创作。
//
// 现在整个应用是纯前端（数据在浏览器 IndexedDB）。AI 调用也在浏览器里直接发起，
// Provider / API key / Model / Base URL 通过前端「AI 设置」抽屉配置，存 IndexedDB。
// 调用方需把 settings 作为参数传进来（见 askAgent 的 settings 参数）。

// Persona / CreativeMode / CreativeModeInfo / CREATIVE_MODES / NarrativeMove /
// NARRATIVE_MOVES 已抽到 ./ai-modes（不依赖 store.ts，可安全被 client 组件引用）。
// 这里 re-export，保持服务端对 ai.ts 的老引用不变。
export {
  CREATIVE_MODES,
  NARRATIVE_MOVES,
  type Persona,
  type CreativeMode,
  type CreativeModeInfo,
  type NarrativeMove,
} from "./ai-modes";
import type { Persona, CreativeMode } from "./ai-modes";

const SYSTEM_PROMPTS: Record<Persona, string> = {
  alchemy:
    '你是儿童写作陪伴助手，负责在两份素材之间做温柔的联想。你只能给灵感的火花，不替孩子完成故事。语言要贴近孩子的感受。',
  'world-witness':
    '你是 World Witness（世界见证者），专注于帮孩子从真实痕迹（Trace）中发现细节和可能性。你的回应必须贴近孩子实际采集到的东西——不编造不在 Trace 里的内容。只给"看见"的建议，不搭故事结构。语言朴实、好奇、鼓励探索。给出 2-3 个观察角度，而非直接写故事。**严禁直接生成正文段落**。',
  'story-coach':
    '你是 Story Coach（故事教练），专注于帮孩子把 Trace 变成叙事结构（主人公、目标、冲突、转折）。你给出多个方向选项让孩子挑，而不是替孩子完成。提问多于陈述。每次回复给 2-3 个不同方向的建议，让孩子有选择权。**严禁直接生成正文段落**。语言温暖、启发式、尊重孩子的选择。',
};

// 模式对应的附加提示（放在 system prompt 后面）
const MODE_PROMPT_APPEND: Record<CreativeMode, string> = {
  'open-up':
    '\n\n【当前模式 · Open Up】孩子说"没想法 / 思路单一"。请从他采集的 Traces 里挑一条，给出 3 种不同解读：一种现实向、一种幻想向、一种情感向。每种都以"如果……会怎样？"结尾，邀请孩子接着想。控制在 200 字内。',
  'build-on':
    '\n\n【当前模式 · Build On】孩子说"有开头但故事走不下去"。请**不要**替他写正文。从下面的经典叙事动作里挑 2-3 个可能适合他现状的动作，并说明它们在他的故事里可能长什么样：计划失败 / 新线索出现 / 意外相遇 / 秘密被发现 / 内心动摇。每条都以选择题方式列出。控制在 250 字内。',
  'look-again':
    '\n\n【当前模式 · Look Again】孩子说"感觉故事离开了真实的 Trace 太远"。请把他关联的 Trace 的具体细节（我注意到 / 它让我想到 / 还不确定）与他当前故事的部分并排提出问题——例如："你写的 X 是你看到的，还是想象出来的？"每次至多 3 个观察类问题。语言像小声在他身边提醒，不指责。控制在 200 字内。',
};

export interface AlchemyInput {
  materialATitle: string;
  materialAKind: string;
  materialAText: string;
  materialBTitle: string;
  materialBKind: string;
  materialBText: string;
  relationship?: string;   // 由儿童在合成前选择/描述的两条素材关系
}

export type AiProvider = "mock" | "anthropic" | "openai-compat";

export function providerOf(s: AiSettings): AiProvider {
  return s.provider;
}

export function conditionOf(s: AiSettings) {
  return s.condition;
}

export function modelLabelOf(s: AiSettings): string {
  if (s.provider === "anthropic") return s.anthropic.model || "claude-opus-4-8";
  if (s.provider === "openai-compat") return s.openaiCompat.model || "(未设置模型)";
  return "本地模拟";
}

function buildAlchemyUserText(input: AlchemyInput): string {
  const relLine = input.relationship
    ? `\n孩子已经决定了这两条素材之间的关系：**${input.relationship}**。请顺着这个关系方向来联想，不要另起炉灶。\n`
    : "";
  return (
    `我把两份素材放进炼金釜，请你帮我把它们联想成一段小小的故事火花。\n\n` +
    `【素材一 · ${input.materialAKind}】${input.materialATitle}\n${input.materialAText}\n\n` +
    `【素材二 · ${input.materialBKind}】${input.materialBTitle}\n${input.materialBText}\n${relLine}\n` +
    `请用温暖的口吻写给一个正在学习写作的孩子看。要求：\n` +
    `1) 先用一句话点出这两份素材之间意想不到的联系（如果孩子给了关系方向，就顺着那个方向）；\n` +
    `2) 再用 3-4 句给出一段可作为故事开头的场景，让孩子有画面感；\n` +
    `3) 最后给出两个可继续追问的小问题，激发孩子自己往下写。\n` +
    `全篇不超过 180 字，用中文。**严禁替孩子写完整故事**。`
  );
}

export async function brewAlchemy(input: AlchemyInput, settings: AiSettings): Promise<string> {
  return await askAgent({
    persona: 'alchemy',
    userPrompt: buildAlchemyUserText(input),
    settings,
  });
}

// ========== 通用 Agent 调用接口 ==========

export interface AgentContext {
  traces?: Material[];
  ideas?: IdeaCard[];
  shelfSoFar?: Partial<StoryShelf>;
  storyBodySnippet?: string;   // Look Again 需要故事正文最新片段
  firstThoughts?: FirstThought[];
}

// 设计文档 §"Trace-Bound AI 条件"：AI 回应必须显示"基于照片 P3 和声音 S2"
// 依据 mediaKind 生成一个短代号（P/S/R），并按 traces 出现顺序编号。
function traceAttributionTag(traces: Material[]): string {
  if (traces.length === 0) return '';
  const parts = traces.map((t, i) => {
    const prefix =
      t.mediaKind === 'photo' ? 'P' :
      t.mediaKind === 'audio' ? 'S' : 'R';
    return `${prefix}${i + 1}`;
  });
  return `基于 ${parts.join(' 和 ')}`;
}

// 设计文档 §"Topic-Based AI 条件"：AI 回应仍显示来源标签，但只引用孩子当前
// 写下的内容——形如"基于你当前写下的'神秘地点'和'重复声音'"。这里从当前
// Idea Cards（优先）或 Story Shelf 的文本里取 1-2 个短片段作为引用。
function topicAttributionTag(context?: AgentContext): string {
  const quote = (s: string) => `“${s.trim().replace(/\s+/g, '').slice(0, 12)}”`;
  const picks: string[] = [];
  for (const idea of context?.ideas ?? []) {
    if (idea.content?.trim()) picks.push(quote(idea.content));
    if (picks.length >= 2) break;
  }
  if (picks.length < 2 && context?.shelfSoFar) {
    const slots = ['protagonist', 'goal', 'event', 'difficulty', 'turn', 'ending'] as const;
    for (const k of slots) {
      const text = context.shelfSoFar[k]?.text;
      if (text?.trim()) picks.push(quote(text));
      if (picks.length >= 2) break;
    }
  }
  if (picks.length === 0) return '';
  return `基于你当前写下的 ${picks.join(' 和 ')}`;
}

export async function askAgent(input: {
  persona: Persona;
  mode?: CreativeMode;         // 可选：如果指定则叠加模式特定 prompt
  userPrompt: string;
  context?: AgentContext;
  settings: AiSettings;
}): Promise<string> {
  const settings = input.settings;
  const provider = settings.provider;
  const condition = settings.condition;
  let systemPrompt = SYSTEM_PROMPTS[input.persona];
  if (input.mode) systemPrompt += MODE_PROMPT_APPEND[input.mode];

  // 设计文档 §"两个实验条件"：topic-based 条件下 AI 不能读取儿童原始
  // 多模态痕迹（照片/声音/视频/现场语音）及其 pre-AI 想法，只能读统一任务 +
  // 当前 Idea Card + Story Shelf + 正文。这里在 trace-bound 之外剥离 traces / firstThoughts。
  const context: AgentContext | undefined =
    condition === "topic-based" && input.context
      ? { ...input.context, traces: undefined, firstThoughts: undefined }
      : input.context;
  if (condition === "topic-based") {
    systemPrompt +=
      "\n\n【当前实验条件 · Topic-Based】你看不到孩子的原始照片、声音、视频或现场语音，也看不到他在 AI 出现前记录的想法。你只能读取统一的故事任务、孩子当前写下的 Idea Card、Story Shelf 和正文。回应里不要假装看过任何现场素材，也不要使用「P3 / S2」这类痕迹代号。引用来源时，只引用孩子当前写下的内容，例如「基于你当前写下的‘神秘地点’和‘重复声音’」。";
  }

  // 把 context 序列化到 userPrompt 前面
  let fullPrompt = input.userPrompt;
  if (context?.traces && context.traces.length > 0) {
    const ftMap = new Map<string, FirstThought>();
    for (const f of context.firstThoughts ?? []) ftMap.set(f.traceId, f);
    const traceList = context.traces
      .map((t) => {
        const parts = [
          `- **${t.title}** (${t.kind})`,
          `  我注意到：${t.iNoticed || '(空)'}`,
          `  它让我想到：${t.itRemindsMe || '(空)'}`,
        ];
        if (t.stillUnsure) parts.push(`  还不确定：${t.stillUnsure}`);
        const ft = ftMap.get(t.id);
        if (ft) {
          parts.push(`  【Pre-AI 想法】实际：${ft.actuallySawHeard || '(空)'} / 猜测：${ft.guessed || '(空)'} / 可能变成：${ft.couldBecome || '(空)'}`);
        }
        return parts.join('\n');
      })
      .join('\n');
    fullPrompt = `【孩子采集的 Traces】\n${traceList}\n\n${fullPrompt}`;
  }
  if (context?.ideas && context.ideas.length > 0) {
    const ideaList = context.ideas.map((i) => `- ${i.content.slice(0, 80)}...`).join('\n');
    fullPrompt = `【已有的 Idea Cards】\n${ideaList}\n\n${fullPrompt}`;
  }
  if (context?.shelfSoFar) {
    const shelf = context.shelfSoFar;
    const slots = ['protagonist', 'goal', 'event', 'difficulty', 'turn', 'ending'] as const;
    const filled = slots.filter((k) => shelf[k]?.text).map((k) => `${k}: ${shelf[k]!.text}`);
    if (filled.length > 0) {
      fullPrompt = `【故事已填写的部分】\n${filled.join('\n')}\n\n${fullPrompt}`;
    }
  }
  if (context?.storyBodySnippet && context.storyBodySnippet.trim()) {
    fullPrompt = `【故事正文的最新片段】\n${context.storyBodySnippet.slice(-400)}\n\n${fullPrompt}`;
  }

  try {
    let reply: string;
    if (provider === "anthropic") reply = await callAnthropic(systemPrompt, fullPrompt, settings);
    else if (provider === "openai-compat") reply = await callOpenAiCompat(systemPrompt, fullPrompt, settings);
    else reply = mockAgentResponse(input.persona, input.mode, fullPrompt);

    // 设计文档 §"两个实验条件"：两个条件都要显示来源标签，只是引用对象不同。
    //   trace-bound：引用痕迹代号 —— "基于照片 P3 和声音 S2"。
    //   topic-based：引用孩子当前写下的内容 —— "基于你当前写下的‘神秘地点’和‘重复声音’"。
    const tag =
      condition === "topic-based"
        ? topicAttributionTag(context)
        : traceAttributionTag(context?.traces ?? []);
    if (tag && !reply.startsWith(tag)) {
      reply = `${tag}——\n\n${reply}`;
    }
    return reply;
  } catch (err) {
    console.error(`[ai] askAgent(${input.persona}) failed, falling back to mock:`, err);
    let reply = mockAgentResponse(input.persona, input.mode, fullPrompt, (err as Error).message);
    const tag =
      condition === "topic-based"
        ? topicAttributionTag(context)
        : traceAttributionTag(context?.traces ?? []);
    if (tag && !reply.startsWith(tag)) reply = `${tag}——\n\n${reply}`;
    return reply;
  }
}

async function callAnthropic(
  systemPrompt: string,
  userPrompt: string,
  settings: AiSettings
): Promise<string> {
  const apiKey = settings.anthropic.apiKey.trim();
  if (!apiKey) throw new Error("Anthropic API Key 未配置（去左侧「AI 设置」抽屉里填一下）");
  const model = settings.anthropic.model.trim() || "claude-opus-4-8";
  const baseURL = settings.anthropic.baseUrl.trim() || undefined;

  // 纯前端调用：Anthropic SDK 默认禁止在浏览器直连，这里显式放开。
  const client = new Anthropic({ apiKey, baseURL, dangerouslyAllowBrowser: true });
  const resp = await client.messages.create({
    model,
    max_tokens: 800,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = resp.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text) throw new Error("Claude 返回内容为空");
  return text;
}

async function callOpenAiCompat(
  systemPrompt: string,
  userPrompt: string,
  settings: AiSettings
): Promise<string> {
  const base = settings.openaiCompat.baseUrl.trim().replace(/\/+$/, "");
  const key = settings.openaiCompat.apiKey.trim();
  const model = settings.openaiCompat.model.trim();
  if (!base) throw new Error("Base URL 未配置（去「AI 设置」抽屉里填一下）");
  if (!key) throw new Error("API Key 未配置（去「AI 设置」抽屉里填一下）");
  if (!model) throw new Error("Model 未配置（去「AI 设置」抽屉里填一下）");

  const resp = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      max_tokens: 800,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`${resp.status} ${resp.statusText} ${body.slice(0, 200)}`);
  }
  const json = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("模型返回内容为空");
  return text;
}

function mockAgentResponse(
  persona: Persona,
  mode: CreativeMode | undefined,
  _userPrompt: string,
  fallbackReason?: string
): string {
  const note = fallbackReason ? `（AI 调用失败，本次由本地模拟：${fallbackReason}）\n\n` : "";

  // 模式优先
  if (mode === 'open-up') {
    return (
      note +
      `**Open Up · 打开更多可能**\n\n` +
      `从你的一份 Trace 出发，试着分三种方向解读它：\n\n` +
      `1. **现实向**：它就是它本来的样子，主人公只是恰好经过。如果……主人公其实认识这个东西背后的人呢？\n` +
      `2. **幻想向**：它是一个通往别处的入口。如果……穿过它就能看到平常看不到的世界呢？\n` +
      `3. **情感向**：它让主人公想到了一件旧事。如果……这件旧事其实还没结束呢？\n\n` +
      `你更想往哪个方向走一步？`
    );
  }
  if (mode === 'build-on') {
    return (
      note +
      `**Build On · 让故事继续**\n\n` +
      `从你已经写下的部分看，这里有几种常见的故事动作可能适合：\n\n` +
      `**A · 计划失败**：主人公原本想做的事没成功。这会让 TA 不得不想别的办法——用得上你哪份 Trace 吗？\n\n` +
      `**B · 新线索出现**：一个之前没注意的细节忽然变得重要。它可以是你 Trace 里的一个小东西。\n\n` +
      `**C · 内心动摇**：主人公开始怀疑自己想要的到底是什么。你的 Trace 里有能触发这种怀疑的场景吗？\n\n` +
      `选一个试试？`
    );
  }
  if (mode === 'look-again') {
    return (
      note +
      `**Look Again · 回去重看**\n\n` +
      `一起把故事和 Trace 并排看看：\n\n` +
      `· 你在正文里写的场景，是从 Trace 里的哪一处来的？还是想象加出来的？\n` +
      `· 你的 Trace 里"我注意到"和"还不确定"部分里，有没有还没用上的细节？\n` +
      `· 如果重听/重看一次你的 Trace，你会发现什么之前没写进去的？`
    );
  }

  // Persona-only fallback（比如 alchemy）
  if (persona === 'alchemy') {
    return (
      note +
      `两份看似不相关的素材，其实都在讲"变化"这件事。\n\n` +
      `想象一下：它们像两只小手在半空中拉在一起，让原本安静的场景动了起来。你会看到一个新的角色悄悄从这条缝里走出来。\n\n` +
      `问问自己：\n` +
      `· 如果它们是一对朋友，会先说什么？\n` +
      `· 它们相遇时，天气、光线、空气是什么味道的？`
    );
  }

  if (persona === 'world-witness') {
    return (
      note +
      `我看到你采集的这些痕迹里，有很多细节可以继续探索：\n\n` +
      `1. 你注意到的那个细节，如果再往深处看，会看到什么？\n` +
      `2. 那个声音/画面，让你想到了什么以前的事情吗？\n` +
      `3. 如果把这两个痕迹放在一起，它们会发生什么对话？`
    );
  }

  if (persona === 'story-coach') {
    return (
      note +
      `根据你的痕迹，这里有几个方向可以选：\n\n` +
      `**方向 A**：把主人公设定成一个正在寻找某样东西的角色，你的痕迹可以成为线索。\n\n` +
      `**方向 B**：从一个小小的困难开始（比如迷路、找不到东西），然后用你的痕迹帮主人公解决。\n\n` +
      `**方向 C**：两个完全不同的角色相遇了，你的痕迹是他们相遇的地方或原因。\n\n` +
      `你觉得哪个方向更接近你想写的故事？`
    );
  }

  return note + "（未知 Persona）";
}
