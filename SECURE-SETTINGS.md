# 加密设置功能说明

## 概述

TraceBound AI 现在将敏感的 AI 设置（包括 API Key）单独加密保存在 `localStorage` 中，与其他数据分离，提供更好的安全性。

## 功能特性

### 1. 加密存储
- **加密算法**: AES-GCM 256-bit
- **密钥派生**: PBKDF2 (100,000 迭代)
- **存储位置**: localStorage (加密后)
- **文件格式**: `.enc` (加密文件)

### 2. 数据分离
- **AI 设置**: localStorage (加密)
  - API Keys
  - 模型配置
  - Base URLs
- **其他数据**: IndexedDB (未加密)
  - 素材
  - 故事
  - 媒体文件

### 3. 自动迁移
- 首次运行时自动从 IndexedDB 迁移到加密存储
- 迁移后删除 IndexedDB 中的旧设置
- 向后兼容，无需手动操作

## 使用方法

### 导出 AI 设置
1. 访问"数据管理"页面
2. 在"AI 设置管理"部分
3. 点击"🔐 导出 AI 设置"
4. 文件自动下载：`tracebound-settings-YYYY-MM-DD.enc`

### 导入 AI 设置
1. 访问"数据管理"页面
2. 点击"🔓 导入 AI 设置"
3. 选择 `.enc` 文件
4. 确认导入（会覆盖当前设置）
5. 页面自动刷新

### 删除 AI 设置
1. 访问"数据管理"页面
2. 点击"🗑️ 删除 AI 设置"
3. 确认删除
4. 页面自动刷新

## 技术实现

### 文件结构
```
src/lib/
  ├── crypto.ts              # 加密/解密工具
  ├── secure-settings.ts     # 加密设置管理
  └── client-store.ts        # 数据存储（已更新）
```

### 加密过程
```javascript
密码 (固定) 
  → PBKDF2 派生密钥 (100,000 迭代)
  → AES-GCM 加密
  → Base64 编码
  → localStorage
```

### 存储格式
```typescript
interface SecureSettings {
  version: string;           // "1.0.0"
  lastModified: string;      // ISO 8601
  aiSettings: AiSettings;    // 完整的 AI 配置
}
```

### localStorage Key
```
tracebound-secure-settings
```

## 安全性

### 优势
✅ API Key 不再明文存储在 IndexedDB
✅ 使用行业标准加密算法 (AES-GCM)
✅ 密钥派生使用高迭代次数 (100k)
✅ 每次加密使用随机 IV
✅ 导出文件已加密

### 限制
⚠️ 密码在代码中（可改为用户自定义）
⚠️ 仍存储在客户端浏览器
⚠️ 清除浏览器数据会丢失
⚠️ 跨设备需要手动导入导出

### 建议
1. **定期备份**: 导出 AI 设置到安全位置
2. **妥善保管**: `.enc` 文件包含敏感信息
3. **限制权限**: 使用受限的 API Key
4. **定期轮换**: 定期更换 API Key

## 与数据导出的区别

### AI 设置导出 (.enc)
- **内容**: 仅 AI 配置（API Key、模型等）
- **格式**: 加密的文本文件
- **大小**: 几 KB
- **用途**: 快速迁移 AI 配置

### 数据导出 (.json)
- **内容**: 所有素材、故事、媒体
- **格式**: JSON（包含 Base64 媒体）
- **大小**: 可能很大（包含图片）
- **用途**: 完整备份所有数据

### 使用场景

| 场景 | 使用 |
|------|------|
| 备份 AI 配置 | 导出 AI 设置 |
| 更换设备（仅配置） | 导出 + 导入 AI 设置 |
| 完整数据备份 | 导出所有数据 |
| 数据迁移 | 导出所有数据 + 导出 AI 设置 |
| 重置应用 | 删除数据 + 删除 AI 设置 |

## 自定义加密密码（可选）

如需使用用户自定义密码，修改 `src/lib/crypto.ts`:

```typescript
// 当前（固定密码）
const password = "tracebound-user-settings";

// 改为（用户输入）
const password = await getUserPassword(); // 需要实现输入界面
```

**注意**: 使用自定义密码后，必须记住密码才能解密设置！

## 迁移路径

### 从旧版本升级
1. 打开应用（自动迁移）
2. 旧设置从 IndexedDB 读取
3. 自动加密并存储到 localStorage
4. 删除 IndexedDB 中的旧数据
5. 无需用户操作

### 验证迁移
```javascript
// 检查是否已迁移
import { hasSecureSettings } from './lib/secure-settings';

if (hasSecureSettings()) {
  console.log("已使用加密存储");
} else {
  console.log("还在使用旧存储");
}
```

## 故障排查

### Q: 设置丢失了？
A: 检查 localStorage 中的 `tracebound-secure-settings`。如果清除了浏览器数据，需要从备份的 `.enc` 文件导入。

### Q: 无法解密设置？
A: 可能是：
- 文件损坏
- 使用了不同的加密密码
- 版本不兼容

解决方法：删除设置，重新配置。

### Q: 导入失败？
A: 确认：
- 文件格式为 `.enc`
- 文件是从本应用导出的
- 文件未被修改

### Q: 跨设备同步？
A: 需要手动操作：
1. 设备 A: 导出 AI 设置
2. 传输 `.enc` 文件到设备 B
3. 设备 B: 导入 AI 设置

## 性能影响

- **加密/解密**: < 10ms
- **存储大小**: ~1-2 KB
- **首次加载**: 自动迁移可能需要 100ms
- **内存占用**: 可忽略

## 兼容性

- ✅ Chrome 60+
- ✅ Firefox 57+
- ✅ Safari 11+
- ✅ Edge 79+

所有现代浏览器都支持 Web Crypto API。

## 更新日志

### 2026-07-31
- ✅ 实现 AES-GCM 加密
- ✅ 创建加密设置管理系统
- ✅ 添加导入导出功能
- ✅ 自动迁移旧设置
- ✅ 更新设置管理页面

## 相关文档

- [数据导入导出](./EXPORT-IMPORT.md)
- [部署指南](./DEPLOYMENT.md)
- [Vercel 兼容性](./VERCEL-COMPATIBILITY.md)
