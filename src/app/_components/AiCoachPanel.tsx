"use client";

import { useState, useRef, useEffect } from "react";
import type { Story } from "../../lib/store";
import { askAgentAction } from "../_actions";

interface Msg {
  role: "user" | "ai";
  text: string;
}

interface Props {
  story: Story;
  body: string;
  // 当用户点选某个修改版本插入正文时回调
  onInsertText: (text: string, aiChars: number) => void;
}

// AI Coach：右侧对话面板。
// - 普通对话：调用 story-coach persona，只给灵感，不代写。
// - "帮我改写"：调用生成 3+ 版本供选择，选中后插入正文并计入 AI 字数。
export function AiCoachPanel({ story, body, onInsertText }: Props) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", text: "嗨！我是你的故事小助手～ 我不会替你写故事，但可以陪你一起想点子。遇到卡住的地方，随时问我！" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [revisions, setRevisions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, revisions]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await askAgentAction({
        persona: "story-coach",
        userPrompt: text,
        storyId: story.id,
        includeStoryBody: true,
      });
      if (res.ok) {
        setMessages((m) => [...m, { role: "ai", text: res.reply }]);
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "ai", text: "哎呀，我走神了，再问我一次好吗？" }]);
    } finally {
      setLoading(false);
    }
  }

  // 请求 3+ 个修改版本
  async function requestRevisions() {
    if (loading) return;
    setLoading(true);
    setRevisions([]);
    try {
      const res = await askAgentAction({
        persona: "story-coach",
        userPrompt:
          "请基于我当前的故事正文，给我 4 个不同的、简单的下一句/下一段的续写版本，每个版本一行，用「1.」「2.」「3.」「4.」编号开头，不要额外解释。每个版本适合小朋友，简单生动。",
        storyId: story.id,
        includeStoryBody: true,
      });
      if (res.ok) {
        const opts = parseRevisions(res.reply);
        setRevisions(opts);
        setMessages((m) => [...m, { role: "ai", text: "我想了几个不同的方向，选一个你喜欢的插入正文吧（也可以重新生成）：" }]);
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "ai", text: "生成建议失败了，再试一次？" }]);
    } finally {
      setLoading(false);
    }
  }

  function insert(text: string) {
    onInsertText(text, text.replace(/\s/g, "").length);
    setRevisions([]);
    setMessages((m) => [...m, { role: "ai", text: "已经帮你把这段插入正文啦，接着往下写吧！" }]);
  }

  return (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        height: "70vh",
        padding: "var(--space-4)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ fontSize: "1.05rem", margin: 0 }}>💬 AI Coach</h3>
        <button className="btn-secondary" onClick={requestRevisions} disabled={loading} style={{ fontSize: "0.8rem" }}>
          帮我想续写
        </button>
      </div>

      {/* 消息列表 */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              padding: "8px 12px",
              borderRadius: "var(--radius)",
              background: m.role === "user" ? "var(--accent)" : "var(--surface)",
              color: m.role === "user" ? "white" : "var(--ink)",
              fontSize: "0.88rem",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {m.text}
          </div>
        ))}

        {/* 修改版本选项 */}
        {revisions.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            {revisions.map((r, i) => (
              <div
                key={i}
                style={{
                  padding: "var(--space-3)",
                  border: "1px solid var(--accent-soft)",
                  borderRadius: "var(--radius)",
                  background: "var(--accent-wash)",
                  fontSize: "0.85rem",
                  lineHeight: 1.6,
                }}
              >
                <div style={{ marginBottom: "var(--space-2)" }}>{r}</div>
                <button className="btn-primary" onClick={() => insert(r)} style={{ fontSize: "0.78rem", padding: "4px 12px" }}>
                  插入这段
                </button>
              </div>
            ))}
            <button className="btn-secondary" onClick={requestRevisions} disabled={loading} style={{ fontSize: "0.8rem" }}>
              🔄 重新生成
            </button>
          </div>
        )}

        {loading && (
          <div style={{ alignSelf: "flex-start", color: "var(--ink-soft)", fontSize: "0.85rem" }}>思考中…</div>
        )}
      </div>

      {/* 输入框 */}
      <div style={{ display: "flex", gap: "var(--space-2)" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="问我点子，比如：接下来会发生什么？"
          style={{ flex: 1, fontSize: "0.88rem" }}
        />
        <button className="btn-primary" onClick={send} disabled={loading || !input.trim()}>
          发送
        </button>
      </div>
    </div>
  );
}

// 从 AI 回复里解析出编号版本
function parseRevisions(reply: string): string[] {
  const lines = reply.split("\n").map((l) => l.trim()).filter(Boolean);
  const opts: string[] = [];
  for (const line of lines) {
    const m = line.match(/^\d+[.、)]\s*(.+)$/);
    if (m) opts.push(m[1].trim());
  }
  // 若解析不到编号，退化为按行分割
  if (opts.length === 0) {
    return lines.filter((l) => l.length > 4).slice(0, 4);
  }
  return opts;
}
