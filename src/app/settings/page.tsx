"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { exportAllData, importAllData } from "../../lib/export-import";
import { exportSecureSettings, importSecureSettings, deleteSecureSettings, hasSecureSettings } from "../../lib/secure-settings";

export default function SettingsPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [settingsExporting, setSettingsExporting] = useState(false);
  const [settingsImporting, setSettingsImporting] = useState(false);
  const hasSettings = typeof window !== 'undefined' && hasSecureSettings();

  async function handleExport() {
    if (!confirm("确认导出所有数据到本地文件？")) return;
    
    setExporting(true);
    try {
      await exportAllData();
      alert("导出成功！文件已保存到下载文件夹。");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("导入数据将覆盖现有数据，确认继续？\n建议先导出备份当前数据。")) {
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setImporting(true);
    try {
      const result = await importAllData(file);
      alert(`导入成功！\n素材：${result.materials} 个\n故事：${result.stories} 个\n媒体文件：${result.media} 个`);
      
      // 刷新页面以重新加载数据
      window.location.reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleImportSettings(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("导入设置将覆盖当前AI配置（包括API Key），确认继续？")) {
      if (settingsInputRef.current) settingsInputRef.current.value = '';
      return;
    }

    setSettingsImporting(true);
    try {
      await importSecureSettings(file);
      alert("设置导入成功！");
      window.location.reload();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSettingsImporting(false);
      if (settingsInputRef.current) settingsInputRef.current.value = '';
    }
  }

  async function handleExportSettings() {
    if (!hasSettings) {
      alert("没有可导出的设置");
      return;
    }

    setSettingsExporting(true);
    try {
      await exportSecureSettings();
      alert("设置导出成功！文件已保存到下载文件夹。");
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSettingsExporting(false);
    }
  }

  async function handleDeleteSettings() {
    if (!confirm("确认删除所有AI设置？此操作不可恢复！")) return;
    
    try {
      deleteSecureSettings();
      alert("设置已删除");
      window.location.reload();
    } catch (err) {
      alert("删除失败：" + (err as Error).message);
    }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 800, margin: "0 auto", padding: "var(--space-6)" }}>
      <header style={{ marginBottom: "var(--space-6)" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>设置</h1>
        <p className="muted" style={{ fontSize: "0.95rem" }}>
          管理你的数据和应用设置
        </p>
      </header>

      {/* AI 设置管理 */}
      <section className="card" style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--space-4)" }}>AI 设置管理</h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* 导出设置 */}
          <div style={{ paddingBottom: "var(--space-4)", borderBottom: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>导出 AI 设置</h3>
            <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "var(--space-3)", lineHeight: 1.6 }}>
              将 AI 配置（API Key、模型等）导出为加密文件，可用于备份或迁移到其他设备。
              <strong style={{ color: "var(--amber)" }}> 文件已加密保护。</strong>
            </p>
            <button 
              onClick={handleExportSettings} 
              className="btn-primary"
              disabled={settingsExporting || !hasSettings}
            >
              {settingsExporting ? "导出中..." : "🔐 导出 AI 设置"}
            </button>
          </div>

          {/* 导入设置 */}
          <div style={{ paddingBottom: "var(--space-4)", borderBottom: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>导入 AI 设置</h3>
            <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "var(--space-3)", lineHeight: 1.6 }}>
              从之前导出的加密文件恢复 AI 配置。<strong style={{ color: "var(--red)" }}>注意：导入会覆盖当前设置！</strong>
            </p>
            <input
              ref={settingsInputRef}
              type="file"
              accept=".enc"
              onChange={handleImportSettings}
              style={{ display: "none" }}
            />
            <button 
              onClick={() => settingsInputRef.current?.click()} 
              className="btn-secondary"
              disabled={settingsImporting}
            >
              {settingsImporting ? "导入中..." : "🔓 导入 AI 设置"}
            </button>
          </div>

          {/* 删除设置 */}
          <div>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>删除 AI 设置</h3>
            <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "var(--space-3)", lineHeight: 1.6 }}>
              清除所有 AI 配置，包括 API Key。<strong style={{ color: "var(--red)" }}>此操作不可恢复！</strong>
            </p>
            <button 
              onClick={handleDeleteSettings} 
              className="btn-secondary"
              style={{ background: "var(--red-wash)", color: "var(--red)", borderColor: "var(--red-soft)" }}
              disabled={!hasSettings}
            >
              🗑️ 删除 AI 设置
            </button>
          </div>
        </div>
      </section>

      {/* 数据管理 */}
      <section className="card" style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--space-4)" }}>数据管理</h2>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* 导出数据 */}
          <div style={{ paddingBottom: "var(--space-4)", borderBottom: "1px solid var(--line)" }}>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>导出数据</h3>
            <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "var(--space-3)", lineHeight: 1.6 }}>
              将所有素材、故事和媒体文件导出为JSON文件，保存到本地。可用于备份或迁移数据。
            </p>
            <button 
              onClick={handleExport} 
              className="btn-primary"
              disabled={exporting}
            >
              {exporting ? "导出中..." : "📥 导出所有数据"}
            </button>
          </div>

          {/* 导入数据 */}
          <div>
            <h3 style={{ fontSize: "1rem", marginBottom: "var(--space-2)" }}>导入数据</h3>
            <p className="muted" style={{ fontSize: "0.9rem", marginBottom: "var(--space-3)", lineHeight: 1.6 }}>
              从之前导出的JSON文件恢复数据。<strong style={{ color: "var(--red)" }}>注意：导入会覆盖现有数据！</strong>
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImport}
              style={{ display: "none" }}
            />
            <button 
              onClick={() => fileInputRef.current?.click()} 
              className="btn-secondary"
              disabled={importing}
            >
              {importing ? "导入中..." : "📤 导入数据文件"}
            </button>
          </div>
        </div>
      </section>

      {/* 关于 */}
      <section className="card" style={{ marginBottom: "var(--space-5)" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--space-4)" }}>关于</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "0.9rem", lineHeight: 1.7 }}>
          <p>
            <strong>TraceBound AI</strong> - 儿童写作辅助工具
          </p>
          <p className="muted">
            所有数据存储在浏览器本地（IndexedDB），不会上传到服务器。<br />
            支持部署到 Vercel 等静态托管平台。
          </p>
          <p className="muted">
            版本：1.0.0<br />
            构建于：{new Date().toLocaleDateString()}
          </p>
        </div>
      </section>

      <div style={{ marginTop: "var(--space-6)" }}>
        <button onClick={() => router.push("/")} className="btn-secondary">
          ← 返回首页
        </button>
      </div>
    </div>
  );
}
