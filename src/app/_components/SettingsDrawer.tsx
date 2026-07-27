"use client";

import { useEffect, useState, useTransition } from "react";
import type { AiProvider, AiSettings, ExperimentCondition } from "../../lib/ai-settings";
import { exportEventsAction, getAiSettingsAction, saveAiSettingsAction } from "../_actions";
import { Drawer } from "./Drawer";

interface Props {
  open: boolean;
  onClose: () => void;
}

const PROVIDER_OPTIONS: Array<{ id: AiProvider; label: string; hint: string }> = [
  { id: "mock", label: "本地模拟", hint: "不调 API，用内置规则给出灵感草稿。适合先试用。" },
  { id: "anthropic", label: "Anthropic Claude", hint: "官方 Claude API。填 API Key 即可用。" },
  { id: "openai-compat", label: "OpenAI 兼容接口", hint: "支持任何 /v1/chat/completions 协议：OpenAI、DeepSeek、通义、Moonshot、Ollama 等。" },
];

const CONDITION_OPTIONS: Array<{ id: ExperimentCondition; label: string; hint: string }> = [
  {
    id: "trace-bound",
    label: "Trace-Bound（痕迹约束）",
    hint: "AI 可读取孩子授权的 traces、现场解释、Pre-AI 想法、Idea Card 与故事结构，回应会带「基于 P/S/R」来源标签。",
  },
  {
    id: "topic-based",
    label: "Topic-Based（仅主题）",
    hint: "AI 看不到原始照片/声音/视频/现场语音，只读当前 Idea Card、Story Shelf 与正文。孩子仍可自己查看 traces。",
  },
];

export function SettingsDrawer({ open, onClose }: Props) {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  function onSave() {
    if (!settings) return;
    startTransition(async () => {
      const res = await saveAiSettingsAction({
        provider: settings.provider,
        condition: settings.condition,
        anthropic: { ...settings.anthropic },
        openaiCompat: { ...settings.openaiCompat },
      });
      setSettings(res.settings);
      setToast("已保存。下一次 AI 调用会用新的设置。");
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
          <section>
            <SectionHeader label="实验条件" />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {CONDITION_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  style={{
                    display: "flex",
                    gap: "var(--space-3)",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius)",
                    border: settings.condition === opt.id ? "2px solid var(--accent)" : "1px solid var(--line)",
                    background: settings.condition === opt.id ? "var(--accent-wash)" : "var(--card)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="condition"
                    checked={settings.condition === opt.id}
                    onChange={() => setSettings({ ...settings, condition: opt.id })}
                    style={{ marginTop: 4 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{opt.label}</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginTop: 2 }}>
                      {opt.hint}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <section>
            <SectionHeader label="选择 AI 引擎" />
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
              {PROVIDER_OPTIONS.map((opt) => (
                <label
                  key={opt.id}
                  style={{
                    display: "flex",
                    gap: "var(--space-3)",
                    padding: "var(--space-3)",
                    borderRadius: "var(--radius)",
                    border: settings.provider === opt.id ? "2px solid var(--accent)" : "1px solid var(--line)",
                    background: settings.provider === opt.id ? "var(--accent-wash)" : "var(--card)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="provider"
                    checked={settings.provider === opt.id}
                    onChange={() => updateProvider(opt.id)}
                    style={{ marginTop: 4 }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{opt.label}</div>
                    <div style={{ fontSize: "0.82rem", color: "var(--ink-soft)", marginTop: 2 }}>
                      {opt.hint}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {settings.provider === "anthropic" && (
            <section>
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
                    style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }}
                    onClick={() => setShowKey((v) => !v)}
                  >
                    {showKey ? "隐藏" : "显示"}
                  </button>
                }
              />
              <Field
                label="Model"
                value={settings.anthropic.model}
                onChange={(v) => updateAnthropic({ model: v })}
                placeholder="claude-opus-4-8"
              />
              <Field
                label="Base URL（可选，走代理时填）"
                value={settings.anthropic.baseUrl}
                onChange={(v) => updateAnthropic({ baseUrl: v })}
                placeholder="https://api.anthropic.com"
              />
            </section>
          )}

          {settings.provider === "openai-compat" && (
            <section>
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
                    style={{ fontSize: "0.78rem", padding: "0.25rem 0.6rem" }}
                    onClick={() => setShowKey((v) => !v)}
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
            </section>
          )}

          {settings.provider === "mock" && (
            <p className="muted" style={{ fontSize: "0.88rem" }}>
              当前是本地模拟模式，不需要 API Key。切到 Anthropic 或 OpenAI 兼容后就能调真实模型。
            </p>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "var(--space-3)",
              paddingTop: "var(--space-3)",
              borderTop: "1px solid var(--line-soft)",
            }}
          >
            {toast && (
              <span style={{ fontSize: "0.85rem", color: "var(--accent-2)", fontWeight: 700 }}>{toast}</span>
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

          <section>
            <SectionHeader label="CHI 埋点日志" />
            <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", lineHeight: 1.7, marginTop: 0 }}>
              系统会记录采集、trace 选择、AI 授权、Pre-AI 想法、合成、Idea Card、Agent 调用、
              叙事决定、完成与反思等事件（存在 <code style={{ fontSize: "0.78rem" }}>~/TraceBound/logs/events.json</code>）。
              导出为 NDJSON 供分析工具消费。
            </p>
            <button
              type="button"
              className="btn-ghost"
              onClick={onExport}
              disabled={pending}
              style={{ padding: "0.5rem 1.2rem" }}
            >
              导出事件日志（NDJSON）
            </button>
          </section>

          <p style={{ fontSize: "0.75rem", color: "var(--ink-soft)", lineHeight: 1.6 }}>
            提示：API Key 只写入本机文件，不会离开你的电脑。如需清除，删除{" "}
            <code style={{ fontSize: "0.78rem" }}>~/TraceBound/settings/ai.json</code> 即可。
          </p>
        </div>
      )}
    </Drawer>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div
      style={{
        fontSize: "0.75rem",
        letterSpacing: "0.14em",
        fontWeight: 700,
        color: "var(--ink-soft)",
        marginBottom: "var(--space-3)",
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
    <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem", marginBottom: "var(--space-3)" }}>
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
