"use client";

import { useEffect, useState, useTransition } from "react";
import type { AiProvider, AiSettings } from "../../lib/ai-settings";
import { exportEventsAction, getAiSettingsAction, saveAiSettingsAction } from "../_actions";
import { Drawer } from "./Drawer";
import { ModelTestPanel } from "./ModelTestPanel";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PROVIDER_OPTIONS: Array<{ id: AiProvider; label: string; hint: string }> = [
  { id: "mock", label: "本地模拟", hint: "不调 API，用内置规则给出灵感草稿。适合先试用。" },
  { id: "anthropic", label: "Anthropic Claude", hint: "官方 Claude API。填 API Key 即可用。" },
  { id: "openai-compat", label: "OpenAI 兼容接口", hint: "支持任何 /v1/chat/completions 协议：OpenAI、DeepSeek、通义、Moonshot、Ollama 等。" },
];

export function SettingsDrawer({ open, onClose }: Props) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"config" | "test">("config");

  useEffect(() => {
    if (!open) return;
    getAiSettingsAction().then(setSettings);
  }, [open]);

  function updateProvider(p: AiProvider) {
    if (!settings) return;
    setSettings({ ...settings, provider: p });
  }
  function updateAnthropic(patch: Partial<AiSettings["anthropic"]>) {
    if (!settings) return;
    setSettings({ ...settings, anthropic: { ...settings.anthropic, ...patch } });
  }
  function updateOpenai(patch: Partial<AiSettings["openaiCompat"]>) {
    if (!settings) return;
    setSettings({ ...settings, openaiCompat: { ...settings.openaiCompat, ...patch } });
  }
  function updateVision(patch: Partial<AiSettings["vision"]>) {
    if (!settings) return;
    setSettings({ ...settings, vision: { ...settings.vision, ...patch } });
  }
  function updateImageGen(patch: Partial<AiSettings["imageGeneration"]>) {
    if (!settings) return;
    setSettings({ ...settings, imageGeneration: { ...settings.imageGeneration, ...patch } });
  }

  function onSave() {
    if (!settings) return;
    startTransition(async () => {
      const res = await saveAiSettingsAction({
        provider: settings.provider,
        anthropic: { ...settings.anthropic },
        openaiCompat: { ...settings.openaiCompat },
        vision: { ...settings.vision },
        imageGeneration: { ...settings.imageGeneration },
      });
      setSettings(res.settings);
      setToast("已保存。下一次 AI 调用会用新的设置。");
      setTimeout(() => setToast(null), 2400);
    });
  }

  function onReset() {
    if (!confirm("确定要重置为默认设置吗？所有 API Key 和自定义配置将被清空。")) return;
    startTransition(async () => {
      const res = await saveAiSettingsAction({
        provider: "mock",
        anthropic: { apiKey: "", model: "claude-sonnet-4-6", baseUrl: "" },
         openaiCompat: { apiKey: "", model: "gpt-4o-mini", baseUrl: "" },
         vision: { provider: "anthropic", apiKey: "", model: "claude-sonnet-4-6", baseUrl: "" },
        imageGeneration: { provider: "custom", apiKey: "", model: "gemini-2.0-flash-lite-image", baseUrl: "" },
      });
      setSettings(res.settings);
      setToast("已重置为默认设置。");
      setTimeout(() => setToast(null), 2400);
    });
  }

  function onExport() {
    startTransition(async () => {
      const res = await exportEventsAction();
      if (!res.ndjson) {
        setToast("还没有任何埋点事件。");
        setTimeout(() => setToast(null), 2400);
        return;
      }
      const blob = new Blob([res.ndjson], { type: "application/x-ndjson" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `trace-bound-events-${new Date().toISOString().slice(0, 10)}.ndjson`;
      a.click();
      URL.revokeObjectURL(url);
      setToast(`已导出 ${res.count} 条事件（NDJSON）。`);
      setTimeout(() => setToast(null), 2400);
    });
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="AI 设置"
      subtitle="API Key 与模型只保存在本机 ~/TraceBound/settings/ai.json，不会上传"
      color="accent"
      width={620}
    >
      {!settings ? (
        <p className="muted">加载中…</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {/* 标签页切换（胶囊式分段控件） */}
          <div
            style={{
              display: "flex",
              gap: "4px",
              padding: "4px",
              background: "var(--surface)",
              borderRadius: "var(--radius-pill)",
              border: "1px solid var(--line)",
            }}
          >
            <button
              onClick={() => setActiveTab("config")}
              style={{
                flex: 1,
                padding: "10px 20px",
                background: activeTab === "config" ? "var(--accent)" : "transparent",
                color: activeTab === "config" ? "white" : "var(--ink)",
                border: "none",
                borderRadius: "var(--radius-pill)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "var(--font-round)",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
            >
              ⚙️ 配置
            </button>
            <button
              onClick={() => setActiveTab("test")}
              style={{
                flex: 1,
                padding: "10px 20px",
                background: activeTab === "test" ? "var(--accent)" : "transparent",
                color: activeTab === "test" ? "white" : "var(--ink)",
                border: "none",
                borderRadius: "var(--radius-pill)",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "0.9rem",
                fontFamily: "var(--font-round)",
                transition: "background 0.15s ease, color 0.15s ease",
              }}
            >
              🧪 测试
            </button>
          </div>

          {activeTab === "config" ? (
            <ConfigTab
              settings={settings}
              showKey={showKey}
              setShowKey={setShowKey}
              updateProvider={updateProvider}
              updateAnthropic={updateAnthropic}
              updateOpenai={updateOpenai}
              updateVision={updateVision}
              updateImageGen={updateImageGen}
              onSave={onSave}
              onReset={onReset}
              onExport={onExport}
              pending={pending}
              toast={toast}
            />
          ) : (
            <ModelTestPanel />
          )}
        </div>
      )}
    </Drawer>
  );
}

// 配置标签页组件
function ConfigTab({
  settings,
  showKey,
  setShowKey,
  updateProvider,
  updateAnthropic,
  updateOpenai,
  updateVision,
  updateImageGen,
  onSave,
  onReset,
  onExport,
  pending,
  toast,
}: {
  settings: AiSettings;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  updateProvider: (p: AiProvider) => void;
  updateAnthropic: (patch: Partial<AiSettings["anthropic"]>) => void;
  updateOpenai: (patch: Partial<AiSettings["openaiCompat"]>) => void;
  updateVision: (patch: Partial<AiSettings["vision"]>) => void;
  updateImageGen: (patch: Partial<AiSettings["imageGeneration"]>) => void;
  onSave: () => void;
  onReset: () => void;
  onExport: () => void;
  pending: boolean;
  toast: string | null;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {/* 选择 AI 引擎 */}
      <SettingsCard>
        <SectionHeader label="选择 AI 引擎" />
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          {PROVIDER_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              style={{
                display: "flex",
                gap: "var(--space-3)",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-lg)",
                border: settings.provider === opt.id ? "2px solid var(--accent)" : "1px solid var(--line)",
                background: settings.provider === opt.id ? "var(--accent-wash)" : "var(--card)",
                cursor: "pointer",
                transition: "border-color 0.15s ease, background 0.15s ease",
                fontFamily: "var(--font-round)",
              }}
            >
              <input
                type="radio"
                name="provider"
                checked={settings.provider === opt.id}
                onChange={() => updateProvider(opt.id)}
                style={{ marginTop: 4, accentColor: "var(--accent)" }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{opt.label}</div>
                <div style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginTop: 2, lineHeight: 1.6 }}>
                  {opt.hint}
                </div>
              </div>
            </label>
          ))}
        </div>
      </SettingsCard>

      {settings.provider === "anthropic" && (
        <SettingsCard>
          <SectionHeader label="Anthropic Claude 配置" />
          <Field
            label="API Key"
            type={showKey ? "text" : "password"}
            value={settings.anthropic.apiKey}
            onChange={(v) => updateAnthropic({ apiKey: v })}
            placeholder="sk-ant-..."
            rightSlot={
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem", flexShrink: 0 }}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? "隐藏" : "显示"}
              </button>
            }
          />
          <Field
            label="Model"
            value={settings.anthropic.model}
            onChange={(v) => updateAnthropic({ model: v })}
            placeholder="claude-sonnet-4-6"
          />
          <Field
            label="Base URL（可选，走代理时填）"
            value={settings.anthropic.baseUrl}
            onChange={(v) => updateAnthropic({ baseUrl: v })}
            placeholder="https://api.anthropic.com"
          />
        </SettingsCard>
      )}

      {settings.provider === "openai-compat" && (
        <SettingsCard>
          <SectionHeader label="OpenAI 兼容接口配置" />
          <Field
            label="Base URL"
            value={settings.openaiCompat.baseUrl}
            onChange={(v) => updateOpenai({ baseUrl: v })}
            placeholder="https://api.openai.com/v1"
          />
          <Field
            label="API Key"
            type={showKey ? "text" : "password"}
            value={settings.openaiCompat.apiKey}
            onChange={(v) => updateOpenai({ apiKey: v })}
            placeholder="sk-..."
            rightSlot={
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem", flexShrink: 0 }}
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? "隐藏" : "显示"}
              </button>
            }
          />
          <Field
            label="Model"
            value={settings.openaiCompat.model}
            onChange={(v) => updateOpenai({ model: v })}
            placeholder="gpt-4o-mini"
          />
        </SettingsCard>
      )}

      {settings.provider === "mock" && (
        <SettingsCard>
          <p className="muted" style={{ fontSize: "0.88rem", margin: 0, lineHeight: 1.7 }}>
            当前是本地模拟模式，不需要 API Key。切到 Anthropic 或 OpenAI 兼容后就能调真实模型。
          </p>
        </SettingsCard>
      )}

      {/* Vision 独立配置 */}
      <SettingsCard>
        <SectionHeader label="Vision 读图配置（可选，留空则复用主引擎）" />
        <SelectField
          label="Provider"
          value={settings.vision.provider}
          onChange={(v) => updateVision({ provider: v as any })}
          options={[
            { value: "anthropic", label: "Anthropic Claude" },
            { value: "openai-compat", label: "OpenAI 兼容" },
            { value: "custom", label: "自定义" },
            { value: "mock", label: "本地模拟" },
          ]}
        />
        <Field
          label="API Key（留空复用主引擎）"
          type={showKey ? "text" : "password"}
          value={settings.vision.apiKey}
          onChange={(v) => updateVision({ apiKey: v })}
          placeholder="留空自动复用"
          rightSlot={
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem", flexShrink: 0 }}
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? "隐藏" : "显示"}
            </button>
          }
        />
        <Field
          label="Model（留空复用主引擎）"
          value={settings.vision.model}
          onChange={(v) => updateVision({ model: v })}
          placeholder="claude-sonnet-4-6"
        />
        <Field
          label="Base URL（可选）"
          value={settings.vision.baseUrl}
          onChange={(v) => updateVision({ baseUrl: v })}
          placeholder="留空复用主引擎"
        />
      </SettingsCard>

      {/* Image Generation 独立配置 */}
      <SettingsCard>
        <SectionHeader label="Image Generation 生图配置（可选）" />
        <SelectField
          label="Provider"
          value={settings.imageGeneration.provider}
          onChange={(v) => updateImageGen({ provider: v as any })}
          options={[
            { value: "dall-e-3", label: "DALL-E 3" },
            { value: "custom", label: "自定义" },
            { value: "mock", label: "本地模拟" },
          ]}
        />
        <Field
          label="API Key（留空复用 OpenAI）"
          type={showKey ? "text" : "password"}
          value={settings.imageGeneration.apiKey}
          onChange={(v) => updateImageGen({ apiKey: v })}
          placeholder="留空自动复用"
          rightSlot={
            <button
              type="button"
              className="btn-ghost"
              style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem", flexShrink: 0 }}
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? "隐藏" : "显示"}
            </button>
          }
        />
        <Field
          label="Model"
          value={settings.imageGeneration.model}
          onChange={(v) => updateImageGen({ model: v })}
          placeholder="gemini-2.0-flash-lite-image"
        />
        <Field
          label="Base URL（可选）"
          value={settings.imageGeneration.baseUrl}
          onChange={(v) => updateImageGen({ baseUrl: v })}
          placeholder="https://api.openai.com/v1"
        />
      </SettingsCard>

      {/* 底部操作栏 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "var(--space-3)",
          padding: "var(--space-3) var(--space-4)",
          background: "var(--card)",
          border: "1px solid var(--line-soft)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-1)",
        }}
      >
        <button
          type="button"
          className="btn-ghost"
          onClick={onReset}
          disabled={pending}
          style={{ padding: "0.55rem 1.2rem", color: "var(--danger)" }}
        >
          重置为默认
        </button>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          {toast && (
            <span style={{ fontSize: "0.85rem", color: "var(--green)", fontWeight: 700 }}>{toast}</span>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={onSave}
            disabled={pending}
            style={{ padding: "0.55rem 1.4rem" }}
          >
            {pending ? "保存中…" : "保存设置"}
          </button>
        </div>
      </div>

      {/* CHI 埋点日志 */}
      <SettingsCard>
        <SectionHeader label="CHI 埋点日志" />
        <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", lineHeight: 1.7, margin: 0 }}>
          系统会记录采集、trace 选择、AI 授权、Pre-AI 想法、合成、Idea Card、Agent 调用、
          叙事决定、完成与反思等事件（存在 <code style={{ fontSize: "0.78rem" }}>~/TraceBound/logs/events.json</code>）。
          导出为 NDJSON 供分析工具消费。
        </p>
        <button
          type="button"
          className="btn-ghost"
          onClick={onExport}
          disabled={pending}
          style={{ padding: "0.5rem 1.2rem", alignSelf: "flex-start" }}
        >
          导出事件日志（NDJSON）
        </button>
      </SettingsCard>

      <p style={{ fontSize: "0.75rem", color: "var(--ink-soft)", lineHeight: 1.6, margin: 0 }}>
        提示：API Key 只写入本机文件，不会离开你的电脑。如需清除，删除{" "}
        <code style={{ fontSize: "0.78rem" }}>~/TraceBound/settings/ai.json</code> 即可。
      </p>
    </div>
  );
}

// 统一的分组圆角卡片：AI 设置里所有区块都用它包裹
function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--card)",
        border: "1px solid var(--line-soft)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "var(--shadow-1)",
        padding: "var(--space-4)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-round)",
        fontSize: "0.72rem",
        letterSpacing: "0.14em",
        fontWeight: 800,
        color: "var(--accent)",
        textTransform: "uppercase",
      }}
    >
      {label}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  rightSlot,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontFamily: "var(--font-round)" }}>
      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)" }}>{label}</span>
      <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{ flex: 1 }}
        />
        {rightSlot}
      </span>
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", fontFamily: "var(--font-round)" }}>
      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--ink)" }}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
