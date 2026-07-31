# TraceBound AI 部署指南

## Vercel 部署

本应用完全兼容 Vercel 部署，所有数据存储在客户端浏览器中。

### 架构说明

- **前端**: Next.js 15 (App Router)
- **数据存储**: IndexedDB (浏览器本地)
- **媒体存储**: IndexedDB Blob Storage
- **无服务端数据库**: 所有数据在客户端

### 部署步骤

1. **推送代码到 GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **在 Vercel 上部署**
   - 访问 [vercel.com](https://vercel.com)
   - 点击 "New Project"
   - 导入你的 GitHub 仓库
   - 构建设置自动检测（Next.js）
   - 点击 "Deploy"

3. **环境变量**（可选）
   - 无需配置服务端环境变量
   - AI API Key 在客户端浏览器中配置

### 数据管理

#### 导出数据
1. 访问应用的 "数据管理" 页面
2. 点击 "导出所有数据"
3. JSON 文件会下载到本地

#### 导入数据
1. 访问应用的 "数据管理" 页面
2. 点击 "导入数据文件"
3. 选择之前导出的 JSON 文件

### 数据存储说明

所有数据存储在浏览器的 IndexedDB 中：

- **materials**: 素材数据
- **stories**: 故事数据
- **media**: 图片/音频 Blob
- **aiSettings**: AI 配置（包含 API Key）

**注意事项：**
- 数据只存在于当前浏览器
- 清除浏览器数据会丢失所有内容
- 建议定期导出备份
- 不同设备/浏览器需要分别导入数据

### 安全性

- API Key 存储在客户端 IndexedDB
- 建议使用有限权限的 API Key
- 定期轮换 API Key
- 导出的 JSON 文件包含敏感信息，妥善保管

### 性能优化

#### IndexedDB 配额
- Chrome: 约 60% 磁盘空间
- Firefox: 约 50% 磁盘空间
- Safari: 约 1GB

#### 建议
- 定期清理不需要的素材
- 压缩图片后再导入
- 大量数据时使用导出功能备份

### 跨设备同步

由于数据存储在客户端，跨设备同步需要手动操作：

1. **设备 A**: 导出数据到 JSON 文件
2. **传输**: 通过云盘、邮件等方式传输 JSON 文件
3. **设备 B**: 导入 JSON 文件

### 故障排查

#### 数据丢失
- 检查浏览器是否清除了 IndexedDB
- 尝试从备份的 JSON 文件恢复

#### 导入失败
- 检查 JSON 文件格式是否正确
- 确认文件大小未超过浏览器限制
- 尝试在隐私/无痕模式下导入

#### 媒体文件无法显示
- 检查 IndexedDB 中的 media store
- 重新导入数据
- 清除浏览器缓存后刷新

### 备份策略

建议：
1. **定期备份**: 每周导出一次数据
2. **版本管理**: 保留多个时间点的备份
3. **云端存储**: 将备份文件上传到云盘
4. **多设备备份**: 在不同设备上保留副本

### 升级和迁移

从旧版本升级：
1. 导出旧版本数据
2. 部署新版本
3. 导入数据到新版本
4. 验证数据完整性

### 技术细节

#### IndexedDB Stores

```javascript
const DB_NAME = "tracebound";
const STORES = {
  materials: "materials",
  stories: "stories", 
  media: "media",
  aiSettings: "aiSettings",
  // ... 其他 stores
};
```

#### 数据导出格式

```json
{
  "version": "1.0.0",
  "exportDate": "2026-07-31T...",
  "materials": [...],
  "stories": [...],
  "media": {
    "material-id": "base64-encoded-image",
    ...
  }
}
```

## 其他部署平台

### Netlify
- 构建命令: `npm run build`
- 发布目录: `.next`
- 需要 `netlify.toml` 配置

### Cloudflare Pages
- 构建命令: `npm run build`
- 构建输出目录: `.next`
- 完全兼容静态部署

### 自托管
```bash
npm run build
npm run start
```

需要 Node.js 运行环境。

## 许可证

MIT License
