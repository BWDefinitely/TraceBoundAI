# TraceBound AI - 儿童写作辅助工具

一个基于 AI 的儿童写作辅助工具，帮助小朋友通过素材收集、灵感炼金和故事创作，培养写作能力。

## ✨ 功能特性

### 📦 素材管理
- 批量导入图片素材
- AI 自动识别图片内容
- 智能分类（人物、观察、感受等）
- 自动生成标签
- 支持图片预览和缩略图

### ⚗️ 灵感炼金
- **灵感生成**：文字描述生成配图
- **素材融合**：拖拽多个素材融合创意
  - 炼金锅动画效果
  - 实时进度显示
  - AI 读图并融合描述
  - 生成新的创意场景图

### 📖 故事创作
- 5 步向导式创作流程：
  1. 素材导入
  2. 元数据填写（时间、地点、人物、事件）
  3. 灵感炼金 & 素材整理
  4. 撰写故事（AI 辅助）
  5. 回顾总结
- AI 写作教练实时辅助
- 场景图片生成
- 字数统计（用户/AI 分别统计）
- 起承转合故事结构

### 🔐 数据安全
- **加密存储**：API Key 使用 AES-GCM 256-bit 加密
- **数据导出**：支持完整数据导出为 JSON
- **设置备份**：AI 配置单独加密导出
- **本地存储**：所有数据在浏览器 IndexedDB 中

### 🚀 部署友好
- 完全客户端应用
- 无服务端数据库
- 支持 Vercel 一键部署
- PWA 支持（可选）

## 🛠️ 技术栈

- **框架**: Next.js 15 (App Router)
- **语言**: TypeScript
- **样式**: CSS Modules
- **存储**: IndexedDB + localStorage (加密)
- **AI**: 支持多种大模型
  - Anthropic Claude
  - OpenAI 兼容接口
  - 自定义 API
- **图片生成**: DALL-E 3 / 自定义接口
- **加密**: Web Crypto API (AES-GCM)

## 📦 安装

### 前置要求
- Node.js 18+ 
- npm / yarn / pnpm

### 克隆项目
```bash
git clone https://github.com/your-username/TraceBoundAI.git
cd TraceBoundAI
```

### 安装依赖
```bash
npm install
# or
yarn install
# or
pnpm install
```

### 本地开发
```bash
npm run dev
```

访问 http://localhost:3000

### 构建生产版本
```bash
npm run build
npm run start
```

## 🚀 Vercel 部署

### 一键部署
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/TraceBoundAI)

### 手动部署
1. 推送代码到 GitHub
2. 在 Vercel 导入项目
3. 自动检测 Next.js 配置
4. 点击 Deploy

**无需配置环境变量！** 所有配置在客户端完成。

## ⚙️ 配置

### AI 设置
1. 访问应用首页
2. 点击"AI 设置"
3. 配置以下内容：
   - **主模型**: Anthropic / OpenAI 兼容
   - **API Key**: 你的 API 密钥
   - **读图模型**: 图片识别配置
   - **生图模型**: 图片生成配置

### 示例配置（OpenAI 兼容）
```
Provider: openai-compat
Base URL: https://api.openai.com/v1
API Key: sk-xxxxxxxxxxxxx
Model: gpt-4o
```

### 示例配置（自定义接口）
```
Provider: custom
Base URL: https://api.your-service.com/v1
API Key: your-api-key
Model: your-model-name
```

## 📚 使用指南

### 创建第一个故事

1. **步骤 1：导入素材**
   - 点击"创建新故事"
   - 上传多张图片
   - AI 自动识别内容
   - 可跳过此步骤

2. **步骤 2：填写元数据**
   - 时间、地点、人物、事件
   - 所有字段可选

3. **步骤 3：灵感炼金**
   - 切换"灵感生成"或"素材融合"
   - 生成创意图片
   - 添加标签和描述
   - 保存到素材库
   - 切换到"素材整理"
   - 拖拽素材到起承转合

4. **步骤 4：撰写故事**
   - AI 生成故事开头
   - 继续编辑和撰写
   - 使用 AI 教练辅助
   - 生成场景图片

5. **步骤 5：回顾总结**
   - 查看完整故事
   - 查看素材使用
   - 展开素材查看缩略图
   - 完成故事

### 数据管理

#### 导出备份
1. 访问"数据管理"
2. 导出 AI 设置（`.enc` 加密文件）
3. 导出所有数据（`.json` 文件）
4. 保存到安全位置

#### 导入恢复
1. 访问"数据管理"
2. 导入 AI 设置或数据文件
3. 确认覆盖
4. 自动刷新

#### 跨设备迁移
1. 设备 A 导出设置和数据
2. 传输文件到设备 B
3. 设备 B 导入文件

## 📁 项目结构

```
TraceBoundAI/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── create/            # 创作流程页面
│   │   │   ├── step1/         # 素材导入
│   │   │   ├── step2/         # 元数据
│   │   │   ├── step3/         # 炼金 & 整理
│   │   │   ├── step4/         # 撰写
│   │   │   └── step5/         # 回顾
│   │   ├── settings/          # 设置页面
│   │   ├── _components/       # 共享组件
│   │   └── page.tsx           # 首页
│   ├── lib/
│   │   ├── ai.ts              # AI 接口
│   │   ├── crypto.ts          # 加密工具
│   │   ├── secure-settings.ts # 加密设置
│   │   ├── client-store.ts    # 数据存储
│   │   ├── export-import.ts   # 导入导出
│   │   └── idb.ts             # IndexedDB
│   └── styles/                # 样式文件
├── public/                     # 静态资源
├── DEPLOYMENT.md              # 部署指南
├── VERCEL-COMPATIBILITY.md    # Vercel 兼容性
├── SECURE-SETTINGS.md         # 加密设置说明
├── EXPORT-IMPORT.md           # 导入导出说明
└── README.md                  # 本文件
```

## 🔒 安全性

### 数据加密
- **API Key**: AES-GCM 256-bit 加密
- **密钥派生**: PBKDF2 (100,000 迭代)
- **存储位置**: localStorage (加密)

### 数据隔离
- **敏感配置**: localStorage (加密)
- **素材故事**: IndexedDB (本地)
- **媒体文件**: IndexedDB Blob

### 隐私保护
- 所有数据仅存储在客户端
- 不上传到服务器
- 支持完全离线使用（配置后）

### 安全建议
1. 使用受限权限的 API Key
2. 定期备份加密设置
3. 妥善保管 `.enc` 文件
4. 定期轮换 API Key
5. 不要分享导出的文件

## 🌐 浏览器兼容性

- ✅ Chrome 60+
- ✅ Firefox 57+
- ✅ Safari 11+
- ✅ Edge 79+

需要支持：
- IndexedDB
- Web Crypto API
- File API
- Blob URLs

## 📊 性能

### 存储限制
- **Chrome**: ~60% 可用磁盘
- **Firefox**: ~50% 可用磁盘
- **Safari**: ~1GB

### 优化
- 图片懒加载
- 分页加载素材（每次 20 项）
- 异步 IndexedDB 操作
- 缓存 Blob URLs

## 🐛 故障排查

### Q: 数据丢失了？
**A**: 检查是否清除了浏览器数据。从备份文件恢复。

### Q: AI 不工作？
**A**: 检查：
1. API Key 是否正确
2. Base URL 是否正确
3. 网络连接
4. API 额度是否充足

### Q: 图片无法显示？
**A**: 
1. 检查 IndexedDB 存储
2. 刷新页面
3. 重新导入数据

### Q: 导入失败？
**A**: 
1. 确认文件格式正确
2. 检查浏览器存储配额
3. 不在隐私模式下使用

### Q: 设置无法保存？
**A**: 
1. 检查 localStorage 权限
2. 清除旧数据重试
3. 检查浏览器控制台错误

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

### 开发指南
1. Fork 本项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

### 代码规范
- TypeScript strict mode
- ESLint + Prettier
- 组件使用 React Hooks
- 样式使用 CSS Modules

## 📄 许可证

MIT License

Copyright (c) 2026 TraceBound AI

## 📮 联系方式

- **Issue**: [GitHub Issues](https://github.com/your-username/TraceBoundAI/issues)
- **Email**: your-email@example.com
- **Website**: https://tracebound.ai

## 🙏 致谢

- Next.js 团队
- Anthropic / OpenAI
- 所有贡献者

## 📝 更新日志

### v1.0.0 (2026-07-31)
- ✅ 完整的创作流程
- ✅ 素材融合功能
- ✅ 加密设置存储
- ✅ 数据导入导出
- ✅ Vercel 部署支持
- ✅ 炼金锅动画效果
- ✅ 故事回顾功能

---

⭐ 如果这个项目对你有帮助，请给个 Star！
