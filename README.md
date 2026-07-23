# Trace-Bound · 儿童写作工作室

一个陪孩子把生活的碎片写成故事的本地工作室。UI 温暖克制，把"故事创作"作为主舞台，其他工具在需要的时候从侧边探出来，不打断正在进行的正文。

## 三块主功能 + 完成后反思

- **故事创作（主舞台）** — 主页面 `/write`。每篇故事自带"起承转合"故事线；正文自动保存；随时可以标记完成。
- **素材采集与回顾（侧边抽屉）** — 从左侧或编辑器顶部按钮唤出。可以采集新素材，也可以回顾、编辑、收藏已有素材。**打开时不会替换正文页面**。当在故事编辑器里打开时，每张素材卡片会多一个"加到当前故事"按钮，点一下就把素材关联到当前故事。
- **灵感炼金（侧边抽屉）** — 从左侧或编辑器顶部按钮唤出。大炼金釜 + 两个槽位，拖两份不同的素材进去，AI 给出一段联想火花。**在编辑器里打开时**，火花下方多一个"作为灵感放进正文"按钮，点一下把火花插入到正文末尾。
- **反思回顾（完成之后）** — 在编辑器点"写完了 · 去反思"后跳转到 `/reflect?story=…`。选一个提示或自己写，写下这一次写作的感觉。已完成的故事会在故事列表里单独分组。

## 快速开始

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

首次保存时会自动创建 `~/TraceBound/` 目录，全部内容以纯文本方式落盘。

## 数据存放位置

默认写到用户家目录下：

```
~/TraceBound/
  materials/
    index.json         素材元数据
    <id>.txt           素材正文
  stories/
    index.json         故事元数据（含起承转合 + completedAt）
    <id>.txt           故事正文
  alchemy/
    index.json         炼金记录（两素材 + AI 联想）
  reflections/
    index.json         反思记录
```

想换位置：

```bash
# .env.local
TRACEBOUND_HOME="D:/我的写作/TraceBound"
```

所有写入走 **临时文件 + rename** 的原子写，孩子的资料不会因中途关掉而损坏。

## AI 接入

通过 `AI_PROVIDER` 环境变量选提供商。**默认是本地模拟**——不配任何 key 也能看到效果。

### 官方 Claude

```bash
# .env.local
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-8         # 可选，默认 claude-opus-4-8
ANTHROPIC_BASE_URL=https://...          # 可选，走代理
```

### 第三方 OpenAI 兼容接口

任何遵守 `POST /v1/chat/completions` 协议的服务都能直接用，包括 OpenAI 官方、Kimi、DeepSeek、智谱 GLM、通义千问、本地 Ollama 等：

```bash
# .env.local
AI_PROVIDER=openai-compat
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o-mini
```

几个常见配置：

| 提供商           | AI_BASE_URL                                          | AI_MODEL 示例             |
| ---------------- | ---------------------------------------------------- | ------------------------- |
| OpenAI           | `https://api.openai.com/v1`                          | `gpt-4o-mini`             |
| DeepSeek         | `https://api.deepseek.com/v1`                        | `deepseek-chat`           |
| Kimi（Moonshot） | `https://api.moonshot.cn/v1`                         | `moonshot-v1-8k`          |
| 智谱 GLM         | `https://open.bigmodel.cn/api/paas/v4`               | `glm-4-flash`             |
| 通义千问         | `https://dashscope.aliyuncs.com/compatible-mode/v1`  | `qwen-turbo`              |
| Ollama 本地      | `http://localhost:11434/v1`                          | `llama3.1`                |

### 强制走模拟

```bash
AI_PROVIDER=mock
```

无论调用失败还是模拟，UI 都会正常返回一段联想，不会卡住孩子的写作节奏。首页与炼金抽屉都会显示当前生效的引擎名字，方便家长确认。

## 技术栈

- Next.js 15 App Router + React 19（Server Components + Server Actions）
- TypeScript strict
- `@anthropic-ai/sdk`（Anthropic 分支），第三方走原生 `fetch`
- 数据层：[src/lib/store.ts](src/lib/store.ts) — 纯 `node:fs` 读写 txt + json
- AI 层：[src/lib/ai.ts](src/lib/ai.ts) — 支持三种 provider
- 无数据库、无 ORM、无第三方 UI 库

## 目录一览

```
src/
  lib/
    store.ts             本地文件存储
    ai.ts                多 provider AI 客户端（mock / anthropic / openai-compat）
    types.ts             共享类型
  app/
    _actions.ts          共享 server actions
    _components/
      AppShell.tsx       客户端 shell + 抽屉上下文
      Sidebar.tsx        左侧导航（含抽屉触发）
      Drawer.tsx         通用右侧抽屉壳
      MaterialsDrawer.tsx  素材采集与回顾抽屉
      AlchemyDrawer.tsx    灵感炼金抽屉（拖拽 + 大炼金釜）
      HomeShortcuts.tsx    首页快捷入口
      PageHeader.tsx       页头
    layout.tsx           全局布局（把数据喂给 AppShell）
    globals.css          全局设计 tokens
    page.tsx             首页
    write/               故事创作（主舞台）
      page.tsx             故事列表（进行中 / 已完成）
      [id]/
        page.tsx           故事编辑器路由
        StoryEditor.tsx    编辑器（起承转合 + 关联素材 + 完成按钮）
      ClientBits.tsx     新建 / 删除 / 重开按钮
    reflect/             反思回顾
      page.tsx
      ReflectForm.tsx
```

## 校验命令

```bash
npm run typecheck    # 严格类型检查
npm run build        # Next.js 生产构建
```
