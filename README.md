# Trace-Bound · 儿童写作工作室

按 CHI 研究方向的产品需求文档（阶段 A+B）实现的儿童痕迹约束型写作系统。**AI 不代写故事，只做支架**——所有 AI 输出必须经过孩子的"采纳 / 修改 / 组合 / 拒绝"决策，形成 Idea Card 才能进入故事。

## 六个核心概念

- **Trace（痕迹）** — 孩子采集的一小片生活。每份 Trace 用「三问」结构记录：
  - 我注意到（观察）
  - 它让我想到（联想）
  - 还不确定（未解之谜）
  - 附带「允许 AI 读取」开关（默认开启）与媒体类型（文字 / 拍照 mock / 录音 mock）
- **First Thoughts（Pre-AI 基线）** — 在 AI 介入前，孩子为每份 Trace 记录三个问题：**实际看到/听到什么** / **猜测是什么** / **故事中可能变成什么**。这是 CHI 研究的关键基线——用来观察 AI 出现前后孩子想法的变化。整个采集流程刻意屏蔽任何 AI 入口。
- **Idea Card** — AI 联想的火花，必须经过孩子编辑并选择来源（AI 启发 / 我改过了 / 组合）后确认成为 Idea Card，才能出现在故事编辑器里。是连接素材与正文的桥梁。
- **Story Shelf** — 故事的 6 个部分（主人公 / 目标 / 发生 / 困难 / 转折 / 结局），每个槽位可挂 Trace 或 Idea Card 作为 Source Chain。
- **三种创意模式** — 孩子按困难场景选：
  - **Open Up · 打开更多可能**（没想法 / 思路单一）→ World Witness 给现实/幻想/情感三种解读
  - **Build On · 让故事继续**（有开头没发展）→ Story Coach 给"计划失败/新线索/内心动摇"等叙事动作
  - **Look Again · 回去重看**（脱离素材）→ World Witness 把故事与 Trace 并排，追问"是观察还是想象？"
- **Decision Ledger（叙事决定账本）** — 每一次与 AI 的交互都会记录：谁提的、哪个模式、动作（采纳 / 修改 / 组合 / 拒绝）、原因。完成故事后在反思页可视化，含 **Trace-Story Mapping**（Trace 走进哪些槽位）与 **拒绝记录**（守住"我自己的故事"的每一个时刻）。

## 三块主功能 + 完成后反思

- **故事创作（主舞台）** — 主页面 `/write`。左侧正文，右侧 6 槽位 Story Shelf + Idea Cards 面板 + 关联 Traces + Agent 面板。
- **Trace 采集与回顾（侧边抽屉）** — 从左侧或编辑器顶部按钮唤出。三问表单 + 每张卡片的 AI 读取开关 + 拍照/录音 mock 按钮。
- **灵感炼金（侧边抽屉）** — 大炼金釜 + 两个槽位，把两份 Trace 拖进去。AI 给出联想，孩子编辑并选择来源类型后确认为 Idea Card。**AI 结果不能直接进入正文**——必须经过 Idea Card 转化。
- **反思回顾（完成之后）** — `/reflect?story=...`。显示 Decision Ledger（采纳/修改/组合/拒绝的汇总 + 每一条记录）+ 反思日记。

## 快速开始

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

首次保存时会自动创建 `~/TraceBound/` 目录，全部内容以纯文本方式落盘。

## 数据存放位置

```
~/TraceBound/
  materials/
    index.json           Trace 元数据（含三问、aiAllowed、mediaKind）
    first-thoughts.json  First Thoughts (Pre-AI Baseline) 数组
    <id>.txt             Trace 正文
  stories/
    index.json           Story 元数据（含 6 槽位 shelf + decisionLedger + linkedIdeaIds）
    <id>.txt             Story 正文
  ideas/
    index.json           Idea Card 数组
  alchemy/
    index.json           炼金记录
  reflections/
    index.json           反思日记
  logs/
    events.json          CHI 埋点事件流（append-only，可在设置里导出为 NDJSON）
  settings/
    ai.json              provider / 实验条件 / API key（本机，不进版本库）
```

设置 `TRACEBOUND_HOME` 环境变量可换目录。全部写入走临时文件 + rename 原子写。

**旧数据自动迁移**：旧 4 槽位（起承转合）故事在 `listStories()` 里自动映射到 6 槽位（`goal` 和 `turn` 补空），编辑器首次打开时提示补充。

## AI 接入

三种 provider，通过 `AI_PROVIDER` 环境变量选择。**默认本地模拟**——不配任何 key 也能看到效果。

### 官方 Claude

```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-8         # 可选
ANTHROPIC_BASE_URL=https://...          # 可选，走代理
```

### 第三方 OpenAI 兼容接口

任何遵守 `POST /v1/chat/completions` 协议的服务都能直接用：

```bash
AI_PROVIDER=openai-compat
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
```

常见配置：

| 提供商           | AI_BASE_URL                                          | AI_MODEL 示例             |
| ---------------- | ---------------------------------------------------- | ------------------------- |
| OpenAI           | `https://api.openai.com/v1`                          | `gpt-4o-mini`             |
| DeepSeek         | `https://api.deepseek.com/v1`                        | `deepseek-chat`           |
| Kimi（Moonshot） | `https://api.moonshot.cn/v1`                         | `moonshot-v1-8k`          |
| 智谱 GLM         | `https://open.bigmodel.cn/api/paas/v4`               | `glm-4-flash`             |
| 通义千问         | `https://dashscope.aliyuncs.com/compatible-mode/v1`  | `qwen-turbo`              |
| Ollama 本地      | `http://localhost:11434/v1`                          | `llama3.1`                |

三种 Persona（`alchemy` / `world-witness` / `story-coach`）共用同一个模型，只是 system prompt 不同。**三种创意模式**（Open Up / Build On / Look Again）在 Persona 之上加一层模式特定 prompt。调用失败自动降级 mock，写作不会被卡住。

### 两个实验条件（CHI 对照）

在设置抽屉里切换，或用 `EXPERIMENT_CONDITION` 环境变量（`trace-bound` / `topic-based`，默认 `trace-bound`）：

- **Trace-Bound（痕迹约束）** — AI 可读取孩子授权的 traces、现场解释、Pre-AI 想法、Idea Card 与故事结构，回应带「基于 P3 和 S2」痕迹代号来源标签。
- **Topic-Based（仅主题）** — AI 看不到原始照片 / 声音 / 视频 / 现场语音及 Pre-AI 想法，只读统一任务、当前 Idea Card、Story Shelf 与正文；来源标签改为引用孩子当前写下的内容（形如「基于你当前写下的‘神秘地点’和‘重复声音’」）。孩子自己仍可查看全部 traces。

两条件的页面结构、三种创意模式、World Witness / Story Coach、回复次数与长度、Narrative Move Library、Story Fusion Board、Story Shelf、写作时间与最终提交都相同——**唯一核心差异是 AI 能否直接访问并引用孩子的多模态痕迹及其来源**。当前实验条件会写入每一条 CHI 埋点事件。

## 与 PRD 的对齐

| PRD 模块 | 实现状态 | 位置 |
|---|---|---|
| §3.2 Capture a Trace | ✓ 三问表单 + 权限开关 + 媒体类型 | `MaterialsDrawer.tsx`（capture tab）|
| §3.3 My World Library | ✓ Trace Card + 卡片级 AI 权限开关 | `MaterialsDrawer.tsx`（review tab）|
| §3.4 First Thoughts | ✓ Pre-AI 三问基线（实际/猜测/可能变成），Trace 卡内编辑，Story 编辑器里显示徽章 | `MaterialsDrawer.tsx`（FirstThoughtBlock）|
| §3.5.1 Story Fusion Board | ✓ 大炼金釜 + 两槽位 + 拖拽 + **合成前先由儿童选择「两条素材的关系」**（5 个方向 + 自定义） | `AlchemyDrawer.tsx` |
| §3.5.2 三种创意模式 | ✓ Open Up / Build On / Look Again 卡片选择，内部映射到 Persona + 模式特定 prompt | `StoryEditor.tsx`（AgentPanel + ModeCard）|
| §3.5.2 Narrative Move Library | ✓ Build On 模式下可折叠面板：5 条抽象叙事动作（计划失败 / 新线索 / 误解被揭开 / 一个选择产生后果 / 内心动摇），每条附一个反问 | `ai.ts`（NARRATIVE_MOVES）+ `StoryEditor.tsx`（NarrativeMoveLibrary）|
| §3.5.3 Idea Card 确认机制 | ✓ 强制编辑 + **6 种来源**（AI 前想到 / 重看素材后 / AI 提问启发 / 采用 AI 方向 / 改变 AI 建议 / 我和 AI 组合） + **4 种决定**（保留 / 继续修改 / 暂时放下 / 删除） | `AlchemyDrawer.tsx`（IdeaCardEditor）|
| §3.6 Story Shelf | ✓ 6 槽位 + Source Chain + 折叠编辑 | `StoryEditor.tsx`（ShelfSlotEditor）|
| §3.7 Agent 行为限制 | ✓ World Witness / Story Coach 双人格，按需召唤，system prompt 明确「严禁直接生成正文段落」；**AI 回应自动带来源标签**（"基于 P3 和 S2——"） | `ai.ts`（traceAttributionTag + SYSTEM_PROMPTS）|
| §3.7 Story World Preview | ✓ Writing Studio 中的可折叠预览，分「真实层」（trace 编号 P/S/R）与「想象层」（Idea Card 内容 + 关系） | `StoryEditor.tsx`（StoryWorldPreview）|
| §3.8 Narrative Decision Ledger | ✓ 采纳/修改/组合/拒绝汇总 + 详细账本 + 携带 mode 标签 + `sourceRelation` 支持 6 类来源 | `ReflectForm.tsx`（DecisionLedgerPanel）|
| §3.8 Trace-Story Mapping | ✓ 反思页可视化每份 Trace 走进了哪些槽位 | `ReflectForm.tsx`（TraceStoryMappingPanel）|
| §3.8 拒绝记录 | ✓ 反思页单独板块列出所有 rejected + 原因 | `ReflectForm.tsx`（RejectedSuggestionsPanel）|
| §3.8 Story Journey | ✓ 5 个关键决定（主人公 / 目标 / 困难 / 转折 / 结局）逐一询问「最早从哪里出现」，6 个来源关系选项 | `ReflectForm.tsx`（StoryJourneyPanel）|
| §3.1 Outdoor Mission | ✓ Field Companion 机器人引导慢观察（10 秒停留 + 轮换提示），记录 `outdoor-observe` 事件，「记录发现」跳转素材抽屉 | `outdoor/OutdoorMission.tsx` |
| §"两个实验条件" | ✓ Trace-Bound / Topic-Based 切换。两条件页面/模式/双 Agent/炼金台/Shelf 全相同，唯一差异是 AI 能否读取原始痕迹：topic-based 下 AI 剥离 traces/first-thoughts，来源标签改为引用「你当前写下的…」 | `ai.ts`（askAgent 门控）+ `SettingsDrawer.tsx` |
| §4 CHI 埋点日志 | ✓ append-only 事件流（采集 / 授权 / Pre-AI / 合成 / Idea Card / Agent / 决定 / 完成 / 反思），带实验条件，NDJSON 导出 | `store.ts`（appendEvent / exportEventsNdjson）+ `SettingsDrawer.tsx` |

拍照 / 录音 UI 按钮为 mock：能选择文件 / 触发状态切换，但不会真的存储媒体文件（只存 `mediaKind` 元数据）。真实多模态在阶段 C。

## 目录一览

```
src/
  lib/
    store.ts             本地文件存储 + 6 槽位迁移 + First Thoughts + CHI 事件日志
    store.test.ts        store 单元测试（CRUD / 迁移 / 事件日志 / 实验条件）
    ai.ts                多 provider AI 客户端 + 三种 Persona + 三种 CreativeMode + 实验条件门控
    ai.test.ts           askAgent 条件门控与来源标签测试
    ai-settings.ts       纯类型：provider / 实验条件 / AiSettings
    ai-modes.ts          三种创意模式 + Narrative Move Library 常量
    ai-modes.test.ts     创意模式 / 叙事动作常量测试
    types.ts             共享类型
  app/
    _actions.ts          共享 server actions（含 createIdeaCard / askAgent / appendDecision / saveFirstThought / logOutdoorObserve / exportEvents）
    _components/
      AppShell.tsx       客户端 shell + 抽屉上下文
      Sidebar.tsx        左侧导航（含抽屉触发）
      Drawer.tsx         通用右侧抽屉壳
      MaterialsDrawer.tsx  Trace 抽屉（三问 + 权限 + mock 媒体 + Pre-AI First Thoughts）
      AlchemyDrawer.tsx    炼金抽屉（Idea Card 确认机制）
      SettingsDrawer.tsx   AI 设置 + 实验条件切换 + CHI 事件日志导出
      HomeShortcuts.tsx    首页快捷入口
      PageHeader.tsx       页头
    layout.tsx           全局布局
    globals.css          全局设计 tokens
    page.tsx             首页
    outdoor/
      page.tsx             户外任务页（阶段 1）
      OutdoorMission.tsx   Field Companion 机器人 + 慢观察流程
    write/
      page.tsx             故事列表（进行中 / 已完成）
      [id]/
        page.tsx           故事编辑器路由
        StoryEditor.tsx    6 槽位 + Source Chain + 三种创意模式 AgentPanel + Decision Ledger 埋点
      ClientBits.tsx     新建 / 删除 / 重开按钮
    reflect/
      page.tsx
      ReflectForm.tsx    反思表单 + Decision Ledger + Trace-Story Mapping + 拒绝记录
```

## 校验命令

```bash
npm run typecheck    # 严格类型检查
npm test             # Vitest 单元测试（store / ai / ai-modes）
npm run build        # Next.js 生产构建
```
