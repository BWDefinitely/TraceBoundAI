"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StoryView } from "../../domain/story";
import { countWords } from "../../story/wordCount";
import { saveStoryAction } from "./actions";
import { TraceBoundAiPanel } from "../ai/TraceBoundAiPanel";
import { SourceReflectionPanel } from "./SourceReflectionPanel";

type SaveState = "idle" | "unsaved" | "saving" | "saved" | "error";

interface WorkspaceProps {
  childId: string;
  story: StoryView;
  selectedTraceIds: string[];
}

const AUTOSAVE_DELAY_MS = 1200;

export function StoryWorkspace({ childId, story, selectedTraceIds }: WorkspaceProps) {
  const [title, setTitle] = useState(story.title);
  const [body, setBody] = useState(story.body);
  const [saveState, setSaveState] = useState<SaveState>("idle");

  const [focusMode, setFocusMode] = useState(false);
  const [tracePanelOpen, setTracePanelOpen] = useState(true);
  const [bridgePanelOpen, setBridgePanelOpen] = useState(true);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);

  const [selection, setSelection] = useState<{ start: number; end: number; text: string } | null>(
    null
  );

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(
    async (nextTitle: string, nextBody: string) => {
      setSaveState("saving");
      try {
        await saveStoryAction(story.id, { title: nextTitle, body: nextBody });
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [story.id]
  );

  useEffect(() => {
    if (saveState === "idle") return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(title, body), AUTOSAVE_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [title, body, doSave, saveState]);

  function markUnsaved() {
    setSaveState("unsaved");
  }

  async function manualSave() {
    if (timer.current) clearTimeout(timer.current);
    await doSave(title, body);
  }

  function captureSelection(e: React.SyntheticEvent<HTMLTextAreaElement>) {
    const el = e.currentTarget;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    setSelection(end > start ? { start, end, text: body.slice(start, end) } : null);
  }

  const wordCount = countWords(body);

  const saveEmoji: Record<SaveState, string> = {
    idle: "✅",
    unsaved: "⏳",
    saving: "💾",
    saved: "✅",
    error: "⚠️",
  };

  const saveLabel: Record<SaveState, string> = {
    idle: "已保存",
    unsaved: "未保存",
    saving: "保存中...",
    saved: "已保存",
    error: "保存失败",
  };

  return (
    <div
      style={{
        maxWidth: focusMode ? "900px" : "100%",
        margin: "0 auto",
        padding: "var(--space-lg)",
      }}
    >
      {/* 顶部栏 / Header bar */}
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--space-md)",
          alignItems: "center",
          marginBottom: "var(--space-xl)",
        }}
      >
        <input
          aria-label="故事标题"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            markUnsaved();
          }}
          placeholder="✨ 给你的故事起个名字吧..."
          style={{
            flex: "1 1 300px",
            fontSize: "1.5rem",
            fontWeight: "bold",
            border: "none",
            background: "transparent",
            padding: "var(--space-sm)",
            minWidth: 0,
          }}
        />

        <div
          style={{
            display: "flex",
            gap: "var(--space-md)",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          {/* 保存状态 / Save status */}
          <span
            role="status"
            aria-live="polite"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-xs)",
              padding: "var(--space-xs) var(--space-sm)",
              background: saveState === "error" ? "#FFE5E5" : "#E8F5E9",
              borderRadius: "var(--radius-full)",
              fontSize: "0.9rem",
              fontWeight: "600",
            }}
          >
            <span className="emoji">{saveEmoji[saveState]}</span>
            {saveLabel[saveState]}
          </span>

          {/* 手动保存 / Manual save */}
          <button type="button" onClick={manualSave} disabled={saveState === "saving"}>
            💾 保存
          </button>

          {/* 字数 / Word count */}
          <span
            className="badge"
            aria-label="字数统计"
            style={{ background: "var(--color-lavender)", color: "white" }}
          >
            📝 {wordCount} 字
          </span>

          {/* 专注模式 / Focus mode */}
          <button
            type="button"
            onClick={() => setFocusMode((v) => !v)}
            aria-pressed={focusMode}
            style={{
              background: focusMode
                ? "linear-gradient(135deg, var(--color-lavender) 0%, var(--color-sunset) 100%)"
                : "var(--color-cloud)",
              color: focusMode ? "white" : "var(--color-text)",
            }}
          >
            {focusMode ? "🌟 专注中" : "🎯 专注模式"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: focusMode ? "1fr" : "1fr 400px",
          gap: "var(--space-xl)",
        }}
      >
        {/* 主编辑区 / Main editor */}
        <div className="card animate-in">
          <label
            htmlFor="story-editor"
            style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: "var(--space-xs)" }}
          >
            <span className="emoji">✍️</span>
            写下你的故事
          </label>
          <textarea
            id="story-editor"
            aria-label="故事正文"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              markUnsaved();
            }}
            onSelect={captureSelection}
            rows={focusMode ? 25 : 18}
            placeholder="在这里写下你的故事...&#10;&#10;你可以记录你看到的、听到的、想到的一切。这是你自己的故事,没有对错。"
            style={{
              marginTop: "var(--space-md)",
              minHeight: "400px",
              fontSize: "1.1rem",
              lineHeight: "1.8",
            }}
          />
        </div>

        {/* 侧边栏 / Sidebar */}
        {!focusMode && (
          <aside style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
            <Panel
              title="我的轨迹"
              emoji="📸"
              open={tracePanelOpen}
              onToggle={() => setTracePanelOpen((v) => !v)}
              color="var(--color-sky)"
            >
              <p style={{ color: "var(--color-text-soft)" }}>
                你采集的照片、声音、文字都在这里。
              </p>
            </Panel>

            <Panel
              title="轨迹桥接"
              emoji="🌉"
              open={bridgePanelOpen}
              onToggle={() => setBridgePanelOpen((v) => !v)}
              color="var(--color-grass)"
            >
              <p style={{ color: "var(--color-text-soft)" }}>
                把轨迹连接到你的故事中。
              </p>
            </Panel>

            {/* AI 开关 / AI toggle */}
            <div className="card" style={{ padding: "var(--space-md)" }}>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--space-sm)",
                  cursor: "pointer",
                  fontSize: "1rem",
                }}
              >
                <input
                  type="checkbox"
                  checked={aiEnabled}
                  onChange={(e) => setAiEnabled(e.target.checked)}
                />
                <span className="emoji">🤖</span>
                <span style={{ fontWeight: "600" }}>AI 帮手</span>
              </label>
              {aiEnabled && (
                <p style={{ fontSize: "0.875rem", color: "var(--color-text-soft)", marginTop: "var(--space-xs)", marginLeft: "calc(24px + var(--space-sm))" }}>
                  AI 只能看到你允许它看的轨迹
                </p>
              )}
            </div>

            {aiEnabled && (
              <Panel
                title="AI 建议"
                emoji="💡"
                open={aiPanelOpen}
                onToggle={() => setAiPanelOpen((v) => !v)}
                color="var(--color-sunshine)"
              >
                <TraceBoundAiPanel
                  childId={childId}
                  sessionId={story.sessionId}
                  selectedTraceIds={selectedTraceIds}
                />
              </Panel>
            )}
          </aside>
        )}
      </div>

      {/* 来源反思面板 / Source reflection */}
      {!focusMode && (
        <div style={{ marginTop: "var(--space-xl)" }}>
          <SourceReflectionPanel
            storyId={story.id}
            selection={selection}
            existing={story.reflections}
          />
        </div>
      )}
    </div>
  );
}

function Panel(props: {
  title: string;
  emoji: string;
  open: boolean;
  onToggle: () => void;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card" style={{ borderLeft: `4px solid ${props.color}` }}>
      <button
        type="button"
        onClick={props.onToggle}
        aria-expanded={props.open}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "none",
          padding: "0",
          fontSize: "1.1rem",
          fontWeight: "700",
          color: "var(--color-text)",
          boxShadow: "none",
          minHeight: "auto",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)" }}>
          <span className="emoji">{props.emoji}</span>
          {props.title}
        </span>
        <span style={{ fontSize: "1.5rem", transition: "transform 0.2s", transform: props.open ? "rotate(180deg)" : "rotate(0)" }}>
          ▼
        </span>
      </button>
      {props.open && <div style={{ marginTop: "var(--space-md)" }}>{props.children}</div>}
    </div>
  );
}
