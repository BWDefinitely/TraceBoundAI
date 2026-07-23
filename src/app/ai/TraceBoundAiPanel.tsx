"use client";

import { useState } from "react";
import type { AiResponse } from "../../schemas/ai";
import type { AiRequestOutcome } from "../../ai/traceBoundAiService";
import { requestTraceBoundAiAction } from "./actions";

type Disposition = "none" | "kept" | "editing" | "rejected";

interface PanelProps {
  childId: string;
  sessionId: string;
  selectedTraceIds: string[];
  onCommitToStaging?: (text: string) => void;
}

const CATEGORIES: Array<{ key: keyof AiResponse; title: string; emoji: string; color: string }> = [
  { key: "recognizedObservations", title: "你观察到的", emoji: "👀", color: "var(--color-sky)" },
  { key: "recognizedChildInterpretations", title: "你理解的", emoji: "💭", color: "var(--color-lavender)" },
  { key: "aiPossibilities", title: "AI 的想法 (不是你的故事)", emoji: "🌈", color: "var(--color-sunset)" },
  { key: "questionsForChild", title: "可以想一想", emoji: "❓", color: "var(--color-grass)" },
];

export function TraceBoundAiPanel(props: PanelProps) {
  const { childId, sessionId, selectedTraceIds } = props;
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [outcome, setOutcome] = useState<AiRequestOutcome | null>(null);
  const [dispositions, setDispositions] = useState<Record<string, Disposition>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});

  async function ask() {
    setLoading(true);
    setDispositions({});
    setEdits({});
    try {
      const result = await requestTraceBoundAiAction(childId, {
        sessionId,
        selectedTraceIds,
        prompt: question,
      });
      setOutcome(result);
    } finally {
      setLoading(false);
    }
  }

  function setDisposition(key: string, d: Disposition) {
    setDispositions((prev) => ({ ...prev, [key]: d }));
  }

  const response = outcome?.ok ? outcome.response : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
      {/* 提问区 / Question area */}
      <div>
        <label htmlFor="ai-question" style={{ fontSize: "0.95rem", marginBottom: "var(--space-sm)" }}>
          <span className="emoji">💬</span>
          问 AI 一个关于你选中轨迹的问题
        </label>
        <textarea
          id="ai-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
          placeholder="比如:这些轨迹有什么共同点?它们让我想到了什么?"
          style={{ marginBottom: "var(--space-sm)" }}
        />
        <button
          type="button"
          onClick={ask}
          disabled={loading || question.trim().length === 0 || selectedTraceIds.length === 0}
          style={{
            width: "100%",
            background: loading
              ? "var(--color-cloud)"
              : "linear-gradient(135deg, var(--color-ocean) 0%, var(--color-sky) 100%)",
            color: loading ? "var(--color-text-soft)" : "white",
          }}
        >
          {loading ? "⏳ AI 正在思考..." : "🚀 问 AI"}
        </button>
        <p
          role="note"
          style={{
            fontSize: "0.875rem",
            color: "var(--color-text-soft)",
            marginTop: "var(--space-sm)",
          }}
        >
          已选择 <strong>{selectedTraceIds.length}</strong> 个轨迹。只有你选中并允许的轨迹才会发给 AI。
        </p>
      </div>

      {/* 错误提示 / Error messages */}
      {outcome && !outcome.ok && outcome.reason === "ACCESS_DENIED" && (
        <div
          role="alert"
          style={{
            padding: "var(--space-md)",
            background: "#FFE5E5",
            borderRadius: "var(--radius-md)",
            borderLeft: "4px solid var(--color-danger)",
          }}
        >
          <p style={{ fontWeight: "600", marginBottom: "var(--space-xs)" }}>
            <span className="emoji">⚠️</span>
            有些轨迹不可用
          </p>
          <p style={{ fontSize: "0.9rem" }}>
            部分选中的轨迹未允许 AI 访问、已删除或不属于本次会话。请调整选择后再试。
          </p>
        </div>
      )}
      {outcome && !outcome.ok && outcome.reason === "INVALID_RESPONSE" && (
        <div
          role="alert"
          style={{
            padding: "var(--space-md)",
            background: "#FFE5E5",
            borderRadius: "var(--radius-md)",
            borderLeft: "4px solid var(--color-danger)",
          }}
        >
          <p style={{ fontWeight: "600" }}>
            <span className="emoji">😕</span>
            AI 的回复不太对,请再试一次。
          </p>
        </div>
      )}

      {/* AI 回复 / AI response */}
      {response && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-lg)" }}>
          {CATEGORIES.map(({ key, title, emoji, color }) => {
            const items = response[key] as string[];
            return (
              <div
                key={key}
                className="card animate-in"
                style={{
                  borderLeft: `4px solid ${color}`,
                  background: key === "aiPossibilities" ? "#FFF9E6" : "white",
                }}
              >
                <h4
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-xs)",
                    marginBottom: "var(--space-md)",
                  }}
                >
                  <span className="emoji">{emoji}</span>
                  {title}
                </h4>
                {items.length === 0 ? (
                  <p style={{ color: "var(--color-text-soft)", fontStyle: "italic" }}>这里暂时没有内容。</p>
                ) : (
                  <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                    {items.map((item, i) => {
                      const rowKey = `${key}:${i}`;
                      const d = dispositions[rowKey] ?? "none";
                      return (
                        <li
                          key={rowKey}
                          style={{
                            padding: "var(--space-md)",
                            background: d === "kept" ? "#E8F5E9" : d === "rejected" ? "#FFE5E5" : "var(--color-cloud)",
                            borderRadius: "var(--radius-md)",
                            border: d === "editing" ? "2px solid var(--color-primary)" : "2px solid transparent",
                          }}
                        >
                          {d === "editing" ? (
                            <textarea
                              value={edits[rowKey] ?? item}
                              onChange={(e) =>
                                setEdits((p) => ({ ...p, [rowKey]: e.target.value }))
                              }
                              rows={3}
                              style={{ marginBottom: "var(--space-sm)" }}
                            />
                          ) : (
                            <p style={{ marginBottom: "var(--space-sm)", lineHeight: "1.6" }}>{item}</p>
                          )}
                          <div
                            role="group"
                            aria-label="操作"
                            style={{
                              display: "flex",
                              gap: "var(--space-xs)",
                              flexWrap: "wrap",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setDisposition(rowKey, "kept");
                                props.onCommitToStaging?.(item);
                              }}
                              style={{
                                fontSize: "0.875rem",
                                padding: "var(--space-xs) var(--space-sm)",
                                background: "var(--color-grass)",
                                color: "white",
                              }}
                            >
                              ✨ 留作灵感
                            </button>
                            <button
                              type="button"
                              onClick={() => setDisposition(rowKey, "editing")}
                              style={{
                                fontSize: "0.875rem",
                                padding: "var(--space-xs) var(--space-sm)",
                                background: "var(--color-ocean)",
                                color: "white",
                              }}
                            >
                              ✏️ 改一改
                            </button>
                            <button
                              type="button"
                              onClick={() => setDisposition(rowKey, "rejected")}
                              style={{
                                fontSize: "0.875rem",
                                padding: "var(--space-xs) var(--space-sm)",
                                background: "var(--color-cloud)",
                                color: "var(--color-text)",
                              }}
                            >
                              ❌ 不要
                            </button>
                            {d === "editing" && (
                              <button
                                type="button"
                                onClick={() => props.onCommitToStaging?.(edits[rowKey] ?? item)}
                                style={{
                                  fontSize: "0.875rem",
                                  padding: "var(--space-xs) var(--space-sm)",
                                  background: "var(--color-lavender)",
                                  color: "white",
                                }}
                              >
                                💾 用改过的
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}

          {/* 边界提醒 / Boundary reminder */}
          <div
            className="card"
            style={{
              background: "linear-gradient(135deg, #FFF9E6 0%, #FFE8D6 100%)",
              borderLeft: "4px solid var(--color-sunshine)",
            }}
          >
            <h4 style={{ marginBottom: "var(--space-sm)" }}>
              <span className="emoji">🌟</span>
              记住
            </h4>
            <p style={{ lineHeight: "1.6" }}>{response.boundaryReminder}</p>
          </div>
        </div>
      )}
    </div>
  );
}
