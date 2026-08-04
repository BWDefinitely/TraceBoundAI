import Anthropic from "@anthropic-ai/sdk";
import type { Material, IdeaCard, FirstThought } from "./store";
import type { AiSettings } from "./ai-settings";

// AI 层：为「灵感炼金」联想两份素材 + 双 Agent 辅助故事创作。
//
// 现在整个应用是纯前端（数据在浏览器 IndexedDB）。AI 调用也在浏览器里直接发起，
// Provider / API key / Model / Base URL 通过前端「AI 设置」抽屉配置，存 IndexedDB。
// 调用方需把 settings 作为参数传进来（见 askAgent 的 settings 参数）。

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
  relationship?: string;
}

export type AiProvider = "mock" | "anthropic" | "openai-compat";

export function providerOf(s: AiSettings): AiProvider {
  return s.provider;
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
  storyBodySnippet?: string;
  firstThoughts?: FirstThought[];
}

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

export async function askAgent(input: {
  persona: Persona;
  mode?: CreativeMode;
  userPrompt: string;
  context?: AgentContext;
  settings: AiSettings;
}): Promise<string> {
  const settings = input.settings;
  const provider = settings.provider;
  let systemPrompt = SYSTEM_PROMPTS[input.persona];
  if (input.mode) systemPrompt += MODE_PROMPT_APPEND[input.mode];

  const context = input.context;

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
  if (context?.storyBodySnippet && context.storyBodySnippet.trim()) {
    fullPrompt = `【故事正文的最新片段】\n${context.storyBodySnippet.slice(-400)}\n\n${fullPrompt}`;
  }

  try {
    let reply: string;
    if (provider === "anthropic") reply = await callAnthropic(systemPrompt, fullPrompt, settings);
    else if (provider === "openai-compat") reply = await callOpenAiCompat(systemPrompt, fullPrompt, settings);
    else reply = mockAgentResponse(input.persona, input.mode, fullPrompt);

    // 添加来源标签
    const tag = traceAttributionTag(context?.traces ?? []);
    if (tag && !reply.startsWith(tag)) {
      reply = `${tag}——\n\n${reply}`;
    }
    return reply;
  } catch (err) {
    console.error(`[ai] askAgent(${input.persona}) failed, falling back to mock:`, err);
    let reply = mockAgentResponse(input.persona, input.mode, fullPrompt, (err as Error).message);
    const tag = traceAttributionTag(context?.traces ?? []);
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

// ========== 图片识别（Vision） ==========

// 决定读图用哪个 provider：优先 vision 自身配置（有 key），否则回退主引擎
function resolveVisionProvider(settings: AiSettings): "anthropic" | "openai-compat" | "custom" | "mock" {
  const v = settings.vision;
  if (v && v.apiKey && v.provider) return v.provider;
  if (settings.provider === "anthropic" && settings.anthropic.apiKey) return "anthropic";
  if (settings.provider === "openai-compat" && settings.openaiCompat.apiKey) return "openai-compat";
  return "mock";
}

export async function readImage(imageBlob: Blob, settings: AiSettings): Promise<string> {
  // vision 未单独配置时，回退复用主引擎（anthropic / openai-compat）
  const provider = resolveVisionProvider(settings);
  console.log("[readImage] provider:", provider, "settings:", { 
    visionApiKey: settings.vision.apiKey?.slice(0, 10) + "...",
    anthropicApiKey: settings.anthropic.apiKey?.slice(0, 10) + "...",
    visionModel: settings.vision.model,
    anthropicModel: settings.anthropic.model,
  });
  const systemPrompt = 
    "你是图片分析助手。用简洁、生动的语言描述图片内容，重点关注可能用于故事创作的元素：" +
    "场景、人物、物品、氛围、情绪等。控制在 80-120 字。用中文回答。";
  const userPrompt = "请描述这张图片，重点关注可以用于故事创作的元素。";

  try {
    let description: string;
    if (provider === "anthropic") {
      description = await callAnthropicVision(systemPrompt, userPrompt, imageBlob, settings);
    } else if (provider === "openai-compat") {
      description = await callOpenAiCompatVision(systemPrompt, userPrompt, imageBlob, settings);
    } else if (provider === "custom") {
      description = await callCustomVision(imageBlob, settings);
    } else {
      description = mockImageDescription();
    }
    return description;
  } catch (err) {
    console.error("[ai] readImage failed, falling back to mock:", err);
    return mockImageDescription((err as Error).message);
  }
}

// 基于用户输入生成观察指导（一句话提示）
export async function generateObservationGuidance(
  imageBlob: Blob, 
  whyTook: string, 
  myThoughts: string, 
  settings: AiSettings
): Promise<string> {
  const provider = resolveVisionProvider(settings);
  console.log("[generateObservationGuidance] provider:", provider);
  
  const systemPrompt = 
    "你是专业的观察指导助手。基于用户拍摄这张照片的原因和想法，结合图片实际内容，" +
    "生成一句话的观察指导，提示用户可能尚未注意到的细节或角度。" +
    "控制在30字以内。用中文回答，语言简洁有力。";
  
  const userPrompt = 
    `用户拍摄原因：${whyTook || "(未填写)"}\n` +
    `用户的想法：${myThoughts || "(未填写)"}\n\n` +
    `请结合图片内容，提供一句话的观察指导，帮助用户发现更多细节。`;

  try {
    let guidance: string;
    if (provider === "anthropic") {
      guidance = await callAnthropicVision(systemPrompt, userPrompt, imageBlob, settings);
    } else if (provider === "openai-compat") {
      guidance = await callOpenAiCompatVision(systemPrompt, userPrompt, imageBlob, settings);
    } else if (provider === "custom") {
      guidance = mockObservationGuidance(whyTook, myThoughts);
    } else {
      guidance = mockObservationGuidance(whyTook, myThoughts);
    }
    
    // 确保不超过30字
    if (guidance.length > 30) {
      guidance = guidance.substring(0, 30) + "...";
    }
    
    return guidance;
  } catch (err) {
    console.error("[ai] generateObservationGuidance failed, falling back to mock:", err);
    return mockObservationGuidance(whyTook, myThoughts, (err as Error).message);
  }
}

function mockObservationGuidance(whyTook: string, myThoughts: string, fallbackReason?: string): string {
  const guidances = [
    "注意光影的对比和色彩的层次感",
    "观察画面中的留白与构图平衡",
    "关注细节中的情绪表达",
    "思考前景与背景的呼应关系",
    "留意画面中的线条引导视线",
  ];
  const guidance = guidances[Math.floor(Math.random() * guidances.length)];
  return fallbackReason ? `（模拟：${fallbackReason.slice(0, 10)}）${guidance}` : guidance;
}

// 生成图片的简单描述词（AI 读图，≤30字）。用于 Step1 素材卡里的「AI生成观察」。
export async function generateImageDescription(imageBlob: Blob, settings: AiSettings): Promise<string> {
  const provider = resolveVisionProvider(settings);
  const systemPrompt =
    "你是图片描述助手。用最简单、口语化的一句话描述图片里最重要的内容，" +
    "不超过 30 个字，不要加修饰和评价，直接给出描述。用中文回答。";
  const userPrompt = "请用不超过 30 个字，简单描述这张图片里最主要的内容。";

  try {
    let description: string;
    if (provider === "anthropic") {
      description = await callAnthropicVision(systemPrompt, userPrompt, imageBlob, settings);
    } else if (provider === "openai-compat") {
      description = await callOpenAiCompatVision(systemPrompt, userPrompt, imageBlob, settings);
    } else if (provider === "custom") {
      description = mockImageShortDescription();
    } else {
      description = mockImageShortDescription();
    }
    // 兜底截断到 30 字
    if (description.length > 30) {
      description = description.slice(0, 30);
    }
    return description.trim();
  } catch (err) {
    console.error("[ai] generateImageDescription failed, falling back to mock:", err);
    return mockImageShortDescription();
  }
}

function mockImageShortDescription(): string {
  const list = [
    "阳光下安静的小角落",
    "一只正在打盹的小猫",
    "雨后闪着光的小路",
    "堆满旧书的小小书店",
    "窗台上晒太阳的花盆",
  ];
  return list[Math.floor(Math.random() * list.length)];
}

// 安全地把 Blob 转 base64（分块避免 String.fromCharCode(...largeArray) 栈溢出）
async function blobToBase64(imageBlob: Blob): Promise<string> {
  const bytes = new Uint8Array(await imageBlob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000; // 32KB 每块
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function callAnthropicVision(
  systemPrompt: string,
  userPrompt: string,
  imageBlob: Blob,
  settings: AiSettings
): Promise<string> {
  const apiKey = settings.vision.apiKey || settings.anthropic.apiKey;
  if (!apiKey) throw new Error("Vision API Key 未配置");
  const model = settings.vision.model || settings.anthropic.model || "claude-sonnet-4-6";
  const baseURL = settings.vision.baseUrl || settings.anthropic.baseUrl || undefined;

  // 转换 Blob 为 base64
  const base64 = await blobToBase64(imageBlob);
  const mediaType = imageBlob.type || "image/jpeg";

  const client = new Anthropic({ apiKey, baseURL, dangerouslyAllowBrowser: true });
  const resp = await client.messages.create({
    model,
    max_tokens: 300,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data: base64,
            },
          },
          {
            type: "text",
            text: userPrompt,
          },
        ],
      },
    ],
  });

  const text = resp.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text) throw new Error("Claude Vision 返回内容为空");
  return text;
}

async function callOpenAiCompatVision(
  systemPrompt: string,
  userPrompt: string,
  imageBlob: Blob,
  settings: AiSettings
): Promise<string> {
  const base = (settings.vision.baseUrl || settings.openaiCompat.baseUrl).trim().replace(/\/+$/, "");
  const key = settings.vision.apiKey || settings.openaiCompat.apiKey;
  const model = settings.vision.model || settings.openaiCompat.model;
  if (!base || !key || !model) throw new Error("OpenAI Vision 配置不完整");

  // 转换 Blob 为 base64 data URL
  const base64 = await blobToBase64(imageBlob);
  const dataUrl = `data:${imageBlob.type || "image/jpeg"};base64,${base64}`;

  const resp = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            { type: "text", text: userPrompt },
          ],
        },
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
  if (!text) throw new Error("OpenAI Vision 返回内容为空");
  return text;
}

async function callCustomVision(imageBlob: Blob, settings: AiSettings): Promise<string> {
  const base = settings.vision.baseUrl.trim().replace(/\/+$/, "");
  const key = settings.vision.apiKey;
  if (!base) throw new Error("自定义 Vision API Base URL 未配置");

  const formData = new FormData();
  formData.append("image", imageBlob);
  if (key) formData.append("api_key", key);

  const resp = await fetch(`${base}/describe`, {
    method: "POST",
    body: formData,
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`${resp.status} ${resp.statusText} ${body.slice(0, 200)}`);
  }
  const json = (await resp.json()) as { description?: string };
  const text = json.description?.trim() ?? "";
  if (!text) throw new Error("自定义 Vision API 返回内容为空");
  return text;
}

function mockImageDescription(fallbackReason?: string): string {
  const descriptions = [
    "照片中是一个安静的角落，阳光透过窗户洒在桌子上，桌上放着一本打开的书和一杯冒着热气的茶。",
    "图片展示了一条铺满落叶的小路，两旁的树木枝叶交错，形成了一个天然的拱门。远处有模糊的人影。",
    "画面中是一只橘猫蜷缩在窗台上，窗外是灰蒙蒙的天空，猫咪的眼睛半睁半闭，似乎在思考什么。",
    "照片拍摄了一个老旧的书店，书架高耸入云，昏黄的灯光让整个空间充满了温暖而神秘的氛围。",
    "图中是雨后的街道，地面反射着霓虹灯的光芒，远处有人撑着伞匆匆走过，留下模糊的身影。",
  ];
  const desc = descriptions[Math.floor(Math.random() * descriptions.length)];
  return fallbackReason
    ? `（AI 调用失败，本次由本地模拟：${fallbackReason}）\n\n${desc}`
    : desc;
}

// ========== 图片生成（Image Generation） ==========

// 决定生图用哪个 provider：优先 imageGeneration 自身配置（有 key），否则回退 openai-compat（若有key）
function resolveImageGenProvider(settings: AiSettings): "dall-e-3" | "custom" | "mock" {
  const ig = settings.imageGeneration;
  
  // 如果配置了生图 provider
  if (ig && ig.provider) {
    // dall-e-3 需要 apiKey
    if (ig.provider === "dall-e-3" && ig.apiKey) {
      return "dall-e-3";
    }
    // custom 只需要 baseUrl，apiKey 是可选的
    if (ig.provider === "custom" && ig.baseUrl) {
      return "custom";
    }
  }
  
  // 如果主引擎是 openai-compat 且有 key，尝试用 dall-e-3
  if (settings.provider === "openai-compat" && settings.openaiCompat.apiKey) {
    return "dall-e-3";
  }
  
  return "mock";
}

export async function generateImage(prompt: string, settings: AiSettings): Promise<Blob> {
  const provider = resolveImageGenProvider(settings);

  try {
    let blob: Blob;
    if (provider === "dall-e-3") {
      blob = await callDallE3(prompt, settings);
    } else if (provider === "custom") {
      blob = await callCustomImageGen(prompt, settings);
    } else {
      blob = mockGeneratedImage();
    }
    return blob;
  } catch (err) {
    console.error("[ai] generateImage failed, falling back to mock:", err);
    return mockGeneratedImage();
  }
}

async function callDallE3(prompt: string, settings: AiSettings): Promise<Blob> {
  const base = settings.imageGeneration.baseUrl?.trim().replace(/\/+$/, "") || settings.openaiCompat.baseUrl || "https://api.openai.com/v1";
  const key = settings.imageGeneration.apiKey || settings.openaiCompat.apiKey;
  const model = settings.imageGeneration.model || "dall-e-3";
  if (!key) throw new Error("DALL-E API Key 未配置");

  const resp = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      prompt,
      n: 1,
      size: "1024x1024", // DALL-E 3 默认 1:1
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`${resp.status} ${resp.statusText} ${body.slice(0, 200)}`);
  }
  const json = (await resp.json()) as { data?: Array<{ url?: string }> };
  const url = json.data?.[0]?.url;
  if (!url) throw new Error("DALL-E 返回的图片 URL 为空");

  // 下载图片
  const imgResp = await fetch(url);
  if (!imgResp.ok) throw new Error("下载生成的图片失败");
  return await imgResp.blob();
}

async function callCustomImageGen(prompt: string, settings: AiSettings): Promise<Blob> {
  const base = settings.imageGeneration.baseUrl?.trim().replace(/\/+$/, "");
  const key = settings.imageGeneration.apiKey;
  const model = settings.imageGeneration.model || "gemini-2.0-flash-lite-image";
  if (!base) throw new Error("自定义生图 API Base URL 未配置");

  // 检查是否应该使用OpenAI兼容格式（/v1/images/generations）
  const isOpenAIFormat = base.includes('/v1') || model.includes('dall-e');
  
  if (isOpenAIFormat) {
    // 使用OpenAI兼容格式
    console.log("[callCustomImageGen] 使用OpenAI兼容格式");
    return await callDallE3Style(prompt, base, key, model);
  }

  // 使用自定义格式
  const body: any = { 
    prompt,
    model,
    size: "1:1",
  };
  if (key) body.api_key = key;

  console.log("[callCustomImageGen] 请求:", { url: `${base}/generate`, body });

  const resp = await fetch(`${base}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    console.error("[callCustomImageGen] HTTP错误:", resp.status, resp.statusText);
    console.error("[callCustomImageGen] 错误响应体:", txt);
    throw new Error(`HTTP ${resp.status} ${resp.statusText}: ${txt.slice(0, 300)}`);
  }

  // 假设返回 JSON 包含 image_url/image_base64 或直接返回图片 Blob
  const contentType = resp.headers.get("content-type");
  console.log("[callCustomImageGen] Content-Type:", contentType);
  console.log("[callCustomImageGen] 所有响应头:", Array.from(resp.headers.entries()));

  // 先尝试作为 JSON 解析
  const clonedResp = resp.clone();
  try {
    const json = await resp.json();
    console.log("[callCustomImageGen] JSON完整响应:", json);
    console.log("[callCustomImageGen] JSON响应键:", Object.keys(json));
    
    // 尝试多种可能的字段名
    const imageUrl = json.image_url || json.imageUrl || json.url;
    const imageBase64 = json.image_base64 || json.imageBase64 || json.image || json.base64 || json.data;
    
    if (imageUrl) {
      console.log("[callCustomImageGen] 下载图片:", imageUrl);
      const imgResp = await fetch(imageUrl);
      if (!imgResp.ok) throw new Error(`下载图片失败: HTTP ${imgResp.status}`);
      const blob = await imgResp.blob();
      console.log("[callCustomImageGen] 图片大小:", blob.size, "类型:", blob.type);
      
      // 验证是否是有效的图片
      if (blob.size === 0) {
        throw new Error("下载的图片大小为0");
      }
      
      return blob;
    } else if (imageBase64) {
      console.log("[callCustomImageGen] 解码base64，长度:", imageBase64.length);
      try {
        // 移除可能的 data:image/png;base64, 前缀
        const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
        const binary = atob(cleanBase64);
        const array = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
        const blob = new Blob([array], { type: "image/png" });
        console.log("[callCustomImageGen] 解码后图片大小:", blob.size);
        
        // 验证解码后的大小
        if (blob.size === 0) {
          throw new Error("解码后的图片大小为0");
        }
        
        return blob;
      } catch (err) {
        console.error("[callCustomImageGen] Base64解码错误:", err);
        throw new Error(`Base64解码失败: ${(err as Error).message}`);
      }
    } else {
      console.error("[callCustomImageGen] 未找到图片字段，完整响应:", JSON.stringify(json, null, 2));
      throw new Error(`API返回的JSON中未找到图片数据。响应键: ${Object.keys(json).join(", ")}`);
    }
  } catch (jsonError) {
    // JSON 解析失败，尝试作为 Blob
    console.log("[callCustomImageGen] JSON解析失败，尝试作为Blob:", jsonError);
    try {
      const blob = await clonedResp.blob();
      console.log("[callCustomImageGen] Blob大小:", blob.size, "类型:", blob.type);
      
      // 验证blob大小
      if (blob.size === 0) {
        throw new Error("返回的图片Blob大小为0");
      }
      
      // 如果blob type为空，尝试根据内容推断
      if (!blob.type || blob.type === 'application/octet-stream') {
        console.log("[callCustomImageGen] Blob type为空或通用类型，创建为image/png");
        return new Blob([blob], { type: "image/png" });
      }
      
      return blob;
    } catch (blobError) {
      // 既不是JSON也不是Blob，读取原始文本
      console.error("[callCustomImageGen] Blob解析也失败:", blobError);
      const text = await clonedResp.clone().text();
      console.error("[callCustomImageGen] 原始响应完整内容:", text);
      console.error("[callCustomImageGen] 响应长度:", text.length);
      
      // 检查是否是HTML错误页面
      if (text.toLowerCase().includes('<html') || text.toLowerCase().includes('<!doctype')) {
        throw new Error(`API返回了HTML页面而不是图片。请检查：1) Base URL是否正确（应该是API端点，不是网页地址）2) 是否需要API Key 3) 路径是否正确（如 /v1/images/generations）。响应前200字符: ${text.slice(0, 200)}`);
      }
      
      throw new Error(`无法解析API响应。Content-Type: ${contentType}，响应前200字符: ${text.slice(0, 200)}`);
    }
  }
}

// OpenAI兼容的图片生成调用
async function callDallE3Style(prompt: string, base: string, key?: string, model?: string): Promise<Blob> {
  if (!key) throw new Error("OpenAI格式的API需要提供API Key");
  
  const apiModel = model || "dall-e-3";
  console.log("[callDallE3Style] 请求:", { base, model: apiModel });
  
  const resp = await fetch(`${base}/images/generations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: apiModel,
      prompt,
      n: 1,
      size: "1024x1024",
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => "");
    console.error("[callDallE3Style] HTTP错误:", resp.status, txt);
    throw new Error(`HTTP ${resp.status}: ${txt.slice(0, 300)}`);
  }

  const json = (await resp.json()) as { data?: Array<{ url?: string; b64_json?: string }> };
  console.log("[callDallE3Style] 响应:", json);
  
  const data = json.data?.[0];
  if (!data) throw new Error("API返回的data字段为空");

  // 优先使用URL
  if (data.url) {
    console.log("[callDallE3Style] 下载图片:", data.url);
    const imgResp = await fetch(data.url);
    if (!imgResp.ok) throw new Error(`下载图片失败: HTTP ${imgResp.status}`);
    return await imgResp.blob();
  }
  
  // 否则使用base64
  if (data.b64_json) {
    console.log("[callDallE3Style] 解码base64");
    const binary = atob(data.b64_json);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: "image/png" });
  }
  
  throw new Error("API返回的数据中既没有url也没有b64_json");
}

function mockGeneratedImage(): Blob {
  // 返回一个 1x1 透明 PNG 作为占位
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const binary = atob(base64);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: "image/png" });
}

// ---------- 本地模拟兜底检测（供 AI 设置里的「模型测试」使用） ----------

// 判断文本是否为「真实模型调用失败后被本地模拟兜底」的结果。
// mockAgentResponse / mockImageDescription 在兜底时会带 "AI 调用失败，本次由本地模拟" 标记。
export function isMockFallbackText(text: string): boolean {
  return text.includes("AI 调用失败") && text.includes("本地模拟");
}

// 判断 Blob 是否为本地模拟生成的占位图（生图 API 失败时的兜底产物）。
export async function isMockFallbackBlob(blob: Blob): Promise<boolean> {
  try {
    const mock = mockGeneratedImage();
    const [a, b] = await Promise.all([blob.arrayBuffer(), mock.arrayBuffer()]);
    if (a.byteLength !== b.byteLength) return false;
    const va = new Uint8Array(a);
    const vb = new Uint8Array(b);
    for (let i = 0; i < va.length; i++) {
      if (va[i] !== vb[i]) return false;
    }
    return true;
  } catch {
    return false;
  }
}
