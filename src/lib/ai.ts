import Anthropic from "@anthropic-ai/sdk";

// AI 层：为「灵感炼金」联想两份素材。
//
// 通过环境变量选 provider，默认 mock：
//
//   AI_PROVIDER=mock                # 本地规则，无需 key
//   AI_PROVIDER=anthropic           # 官方 Claude
//     ANTHROPIC_API_KEY=sk-ant-...
//     ANTHROPIC_MODEL=claude-opus-4-8         (可选)
//     ANTHROPIC_BASE_URL=...                  (可选，走代理)
//
//   AI_PROVIDER=openai-compat       # 任何遵守 OpenAI /v1/chat/completions 协议的第三方
//     AI_BASE_URL=https://api.openai.com/v1
//     AI_API_KEY=sk-...
//     AI_MODEL=gpt-4o-mini
//
// 这三种都覆盖以后，接入 Kimi / DeepSeek / 智谱 / 通义 / 本地 Ollama 之类都不用改代码。

export interface AlchemyInput {
  materialATitle: string;
  materialAKind: string;
  materialAText: string;
  materialBTitle: string;
  materialBKind: string;
  materialBText: string;
}

export type AiProvider = "mock" | "anthropic" | "openai-compat";

export function currentProvider(): AiProvider {
  const raw = (process.env.AI_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "anthropic" || raw === "openai-compat" || raw === "mock") return raw;
  // 未显式声明：如果给了任一 key 就自动选，否则 mock
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.AI_API_KEY && process.env.AI_BASE_URL) return "openai-compat";
  return "mock";
}

export function currentModelLabel(): string {
  const p = currentProvider();
  if (p === "anthropic") return process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  if (p === "openai-compat") return process.env.AI_MODEL || "(未设置 AI_MODEL)";
  return "本地模拟";
}

const SYSTEM_PROMPT =
  "你是儿童写作陪伴助手，负责在两份素材之间做温柔的联想。你只能给灵感的火花，不替孩子完成故事。语言要贴近孩子的感受。";

function buildUserText(input: AlchemyInput): string {
  return (
    `我把两份素材放进炼金釜，请你帮我把它们联想成一段小小的故事火花。\n\n` +
    `【素材一 · ${input.materialAKind}】${input.materialATitle}\n${input.materialAText}\n\n` +
    `【素材二 · ${input.materialBKind}】${input.materialBTitle}\n${input.materialBText}\n\n` +
    `请用温暖的口吻写给一个正在学习写作的孩子看。要求：\n` +
    `1) 先用一句话点出这两份素材之间意想不到的联系；\n` +
    `2) 再用 3-4 句给出一段可作为故事开头的场景，让孩子有画面感；\n` +
    `3) 最后给出两个可继续追问的小问题，激发孩子自己往下写。\n` +
    `全篇不超过 180 字，用中文。`
  );
}

export async function brewAlchemy(input: AlchemyInput): Promise<string> {
  const provider = currentProvider();
  try {
    if (provider === "anthropic") return await brewAnthropic(input);
    if (provider === "openai-compat") return await brewOpenAiCompat(input);
    return mockBrew(input);
  } catch (err) {
    console.error("[ai] brew failed, falling back to mock:", err);
    return mockBrew(input, { fallbackReason: (err as Error).message });
  }
}

async function brewAnthropic(input: AlchemyInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY 未配置");
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
  const baseURL = process.env.ANTHROPIC_BASE_URL || undefined;

  const client = new Anthropic({ apiKey, baseURL });
  const resp = await client.messages.create({
    model,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserText(input) }],
  });
  const text = resp.content
    .map((c) => (c.type === "text" ? c.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!text) throw new Error("Claude 返回内容为空");
  return text;
}

async function brewOpenAiCompat(input: AlchemyInput): Promise<string> {
  const base = process.env.AI_BASE_URL?.replace(/\/+$/, "");
  const key = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL;
  if (!base) throw new Error("AI_BASE_URL 未配置");
  if (!key) throw new Error("AI_API_KEY 未配置");
  if (!model) throw new Error("AI_MODEL 未配置");

  const resp = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.8,
      max_tokens: 600,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserText(input) },
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

function mockBrew(input: AlchemyInput, opts?: { fallbackReason?: string }): string {
  const a = input.materialATitle.trim() || "第一份素材";
  const b = input.materialBTitle.trim() || "第二份素材";
  const note = opts?.fallbackReason
    ? `（AI 调用失败，本次由本地模拟给出联想：${opts.fallbackReason}）\n\n`
    : "";
  return (
    note +
    `两份看似不相关的素材，其实都在讲“变化”这件事。\n\n` +
    `想象一下：${a} 里出现的画面忽然遇见了 ${b} 里的声音，` +
    `它们像两只小手在半空中拉在一起，让原本安静的场景动了起来。你会看到一个新的角色悄悄从这条缝里走出来。\n\n` +
    `问问自己：\n` +
    `· 如果它们是一对朋友，会先说什么？\n` +
    `· 它们相遇时，天气、光线、空气是什么味道的？`
  );
}
