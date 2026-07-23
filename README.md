# Trace-Bound AI

> A workspace where children collect *traces* (photo / sound / voice / text), reflect on
> them, and write their own stories — with an AI that can only ever see traces the child
> has explicitly selected and permitted.
>
> 一个让孩子采集 *轨迹*(照片 / 声音 / 语音 / 文字)、进行反思并撰写自己故事的工作区。
> AI 永远只能看到孩子**明确选择并授权**的轨迹。

---

## ⚠️ Project status / 项目现状

**EN** — This repository currently contains the **domain logic, services, schemas, server
actions, React components, and tests**. As of this version, it is a **runnable demo** with a
**child-friendly, colorful interface**:

- `npm run dev` starts a Next.js dev server that works **with or without a database**:
  - **No `DATABASE_URL` set**: the app uses an in-memory backend seeded with demo data
    (one child, one session, a story, and a few traces). Data resets on restart.
  - **`DATABASE_URL` set**: the app connects to a real PostgreSQL database.
- **Child-friendly UI**: warm colors, rounded corners, big emoji icons, clear labels in Chinese,
  and inviting language designed for children.
- **No real AI provider wired in** — the app uses a deterministic `MockAiClient`.
- What runs today: **type checking, unit tests, Prisma client generation, and `npm run dev`.**

**中文** — 本仓库目前包含**领域逻辑、服务、schema、server actions、React 组件和测试**。
当前版本是一个**可运行的演示**,并配有**儿童友好的彩色界面**:

- `npm run dev` 启动 Next.js 开发服务器,**有无数据库均可运行**:
  - **未设置 `DATABASE_URL`**: 应用使用内存后端,预置演示数据(一个孩子、一个会话、一篇故事
    和几个轨迹)。数据在重启时重置。
  - **已设置 `DATABASE_URL`**: 应用连接到真实的 PostgreSQL 数据库。
- **儿童友好界面**:温暖明亮的配色、圆润的形状、大号 emoji 图标、清晰的中文标签,
  以及专为孩子设计的亲切语言。
- **尚未接入任何真实 AI 服务** —— 当前使用确定性的 `MockAiClient`。
- 目前真正可运行的是:**类型检查、单元测试、Prisma 客户端生成、以及 `npm run dev`。**

---

## Quick start (no database needed) / 快速启动(无需数据库)

```bash
# 1. Clone and install
# 克隆并安装依赖
git clone <repo-url>
cd TraceBoundAI
npm install

# 2. Generate Prisma types (required even for in-memory mode)
# 生成 Prisma 类型(即使使用内存模式也必需)
npm run prisma:generate

# 3. Start the dev server — works WITHOUT a database!
# 启动开发服务器 —— 无需数据库即可运行!
npm run dev
# Open http://localhost:3000
# 打开 http://localhost:3000
```

**EN** — When `DATABASE_URL` is unset, the app uses an in-memory backend seeded with demo
data. You'll see the Story Workspace, AI panel, and Source Reflection panel right away.

**中文** — 当未设置 `DATABASE_URL` 时,应用使用内存后端,预置演示数据。你会立刻看到
写作工作区、AI 面板和来源反思面板。

---

## Requirements / 环境要求

- **Node.js** 18.18+ (recommend 20+) / Node.js 18.18 以上(建议 20+)
- **npm** (a `package-lock.json` is committed) / npm(仓库已提交 `package-lock.json`)
- **PostgreSQL** 13+ — **optional**; only required if you want persistent data. The app runs
  DB-free in demo mode by default. / PostgreSQL 13 以上 —— **可选**;仅当你需要持久化数据
  时才必需。应用默认以无数据库演示模式运行。

---

## 1. Install dependencies / 安装依赖

```bash
npm install
```

---

## 2. Configure environment variables (optional) / 配置环境变量(可选)

**EN** — You can run `npm run dev` **right now without any `.env` file** — the app will use
an in-memory backend. If you want persistent data or to explore with a real database, create
a `.env` file:

**中文** — 你可以**立刻运行 `npm run dev` 而无需任何 `.env` 文件** —— 应用会使用内存后端。
如果你想要持久化数据或使用真实数据库,再创建 `.env` 文件:

```dotenv
# .env

# OPTIONAL — PostgreSQL connection string. If omitted, the app uses in-memory demo data.
# 可选 —— PostgreSQL 连接串。省略时,应用使用内存演示数据。
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/tracebound?schema=public"

# OPTIONAL — where uploaded media files are stored on the server.
# Defaults to ./.storage/traces if omitted. This path is NEVER exposed to the browser.
# 可选 —— 服务器上媒体文件的存储目录。省略时默认为 ./.storage/traces。
# 该路径永远不会暴露给浏览器。
# TRACE_STORAGE_ROOT="/var/lib/tracebound/traces"
```

Replace `USER` / `PASSWORD` / `localhost:5432` / `tracebound` with your own database
credentials. / 请把 `USER` / `PASSWORD` / `localhost:5432` / `tracebound` 换成你自己的
数据库凭据。

### About the AI API key / 关于 AI 的 API Key

**EN** — Right now there is **no API key to configure**, because no external model is
called. The AI boundary is defined by the `AiClient` interface in
[`src/ai/aiClient.ts`](src/ai/aiClient.ts), and the app is wired to `MockAiClient` in
[`src/app/ai/actions.ts`](src/app/ai/actions.ts). When you are ready to connect a real
provider (e.g. Anthropic Claude), you will:

1. Add your key to `.env`, e.g. `ANTHROPIC_API_KEY="sk-ant-..."`.
2. Implement a new class that satisfies `AiClient` (its `complete()` calls the provider and
   returns raw JSON — the service validates it against `AiResponseSchema`).
3. Swap `new MockAiClient()` for your class in `src/app/ai/actions.ts`. **Nothing else
   changes** — the `TraceAccessPolicy` gate and response validation stay intact.

**中文** — 目前**没有需要配置的 API Key**,因为尚未调用任何外部模型。AI 的边界由
[`src/ai/aiClient.ts`](src/ai/aiClient.ts) 中的 `AiClient` 接口定义,应用在
[`src/app/ai/actions.ts`](src/app/ai/actions.ts) 中接线到 `MockAiClient`。当你要接入真实
服务(例如 Anthropic Claude)时:

1. 把 key 加入 `.env`,例如 `ANTHROPIC_API_KEY="sk-ant-..."`。
2. 实现一个满足 `AiClient` 接口的新类(其 `complete()` 调用服务商并返回原始 JSON,
   服务层会用 `AiResponseSchema` 校验)。
3. 在 `src/app/ai/actions.ts` 中把 `new MockAiClient()` 换成你的类。**其余无需改动** ——
   `TraceAccessPolicy` 门禁与响应校验保持不变。

> ⚠️ Never send original media files to the AI. The prompt is built from **textual metadata
> only**. Keep this invariant when implementing a real client.
> 切勿把原始媒体文件发送给 AI。提示词仅由**文本元数据**构成,实现真实客户端时请保持此不变量。

---

## 3. Set up the database (optional) / 初始化数据库(可选)

```bash
# Generate the Prisma client from prisma/schema.prisma (REQUIRED even without a DB)
# 依据 prisma/schema.prisma 生成 Prisma 客户端(即使不用数据库也必需)
npm run prisma:generate

# Create the tables in your database (only if you set DATABASE_URL)
# 在数据库中创建数据表(仅当你设置了 DATABASE_URL 时)
npx prisma migrate dev --name init
```

**EN** — If you skip `.env` and `migrate`, the app will use an in-memory backend with demo
data. You **must** still run `prisma:generate` so the `@prisma/client` types exist (even
though the runtime won't connect to a real database).

**中文** — 如果你跳过 `.env` 和 `migrate`,应用会使用内存后端的演示数据。但你**仍必须**
运行 `prisma:generate`,以便生成 `@prisma/client` 类型(即使运行时不会连接真实数据库)。

---

## 4. Verify the project / 校验项目

These are the commands that work today and are the recommended way to confirm your setup.
/ 以下命令目前均可运行,是确认环境是否就绪的推荐方式。

```bash
# Type check — should exit cleanly
# 类型检查 —— 应无错误退出
npm run typecheck

# Unit tests — 62 tests across 6 files
# 单元测试 —— 6 个文件共 62 个测试
npm test
```

Expected test result / 预期测试结果:

```
Test Files  6 passed (6)
     Tests  62 passed (62)
```

---

## 5. Run the dev server / 启动开发服务器

```bash
npm run dev
```

**EN** — The dev server starts on `http://localhost:3000`. The experience depends on
whether you set `DATABASE_URL`:

- **Without `DATABASE_URL`** (default): you see a fully working demo with one child, one
  session, a story, and a few traces. The Story Workspace, AI panel (using `MockAiClient`),
  and Source Reflection panel are all rendered and interactive. Data resets on restart.
- **With `DATABASE_URL`**: the app connects to your PostgreSQL database. You'll need to
  create a child/session/story manually (or via Prisma Studio: `npx prisma studio`).

**中文** — 开发服务器启动在 `http://localhost:3000`。体验取决于你是否设置了 `DATABASE_URL`:

- **未设置 `DATABASE_URL`**(默认):你会看到一个完整可用的演示,包含一个孩子、一个会话、
  一篇故事和几个轨迹。写作工作区、AI 面板(使用 `MockAiClient`)和来源反思面板全部渲染
  并可交互。数据在重启时重置。
- **已设置 `DATABASE_URL`**:应用连接你的 PostgreSQL 数据库。你需要手动创建孩子/会话/故事
  (或通过 Prisma Studio:`npx prisma studio`)。

---

## Project layout / 项目结构

| Path / 路径 | Purpose / 用途 |
| --- | --- |
| `prisma/schema.prisma` | Data model / 数据模型 |
| `src/policy/` | `TraceAccessPolicy` — the single server-side AI access gate / 唯一的服务端 AI 访问门禁 |
| `src/capture/` | Field Capture: create traces, validate uploads / 采集轨迹、校验上传 |
| `src/library/` | My World Library: edit / delete / hide / permissions / 编辑、删除、隐藏、权限 |
| `src/bridge/` | Trace-to-Story Bridge: four separate fields + mock scaffold / 四个独立字段 + 模拟脚手架 |
| `src/ai/` | Trace-Bound AI service + client interface / AI 服务与客户端接口 |
| `src/story/` | Story Workspace + Source Reflection / 写作工作区与来源反思 |
| `src/app/**/actions.ts` | Server actions (`"use server"`) / 服务端动作 |
| `src/app/**/*.tsx` | React components (not yet mounted to pages) / React 组件(尚未挂载到页面) |
| `tests/` | Vitest unit tests (in-memory Prisma fake) / Vitest 单元测试(内存 Prisma 假实现) |

---

## Security invariants / 安全不变量

- **EN** — No trace reaches the AI unless it belongs to the active session, `aiAccessAllowed`
  is true, it is not deleted, and the child explicitly selected it. The policy is
  fail-closed. Original media files are never sent to the AI. AI suggestions never enter the
  story editor automatically.
- **中文** —— 只有当轨迹属于当前会话、`aiAccessAllowed` 为真、未被删除、且孩子明确选择时,
  才会被送入 AI。该策略为“默认拒绝(fail-closed)”。原始媒体文件绝不发送给 AI。AI 的建议
  绝不会自动进入故事编辑器。

> **Known limitation / 已知限制:** authentication is not wired yet — `childId` is currently
> supplied by the caller. Do not deploy to real users before adding an auth layer that
> derives `childId` server-side. / 尚未接入鉴权 —— `childId` 目前由调用方传入。在补上从服务端
> 推导 `childId` 的鉴权层之前,请勿部署给真实用户。

