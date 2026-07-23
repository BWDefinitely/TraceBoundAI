"use client";

import { useState } from "react";
import {
  REFLECTION_SOURCE_TYPES,
  REFLECTION_SOURCE_LABELS,
  type ReflectionSourceType,
  type StoryReflectionView,
} from "../../domain/story";
import { createReflectionAction } from "./actions";

interface Props {
  storyId: string;
  selection: { start: number; end: number; text: string } | null;
  existing: StoryReflectionView[];
}

// 为每个来源类型配色和 emoji
const SOURCE_STYLES: Record<
  ReflectionSourceType,
  { emoji: string; color: string; description: string }
> = {
  WORLD_OBSERVATION: {
    emoji: "👁️",
    color: "var(--color-sky)",
    description: "我真实看到、听到或感受到的",
  },
  MY_INTERPRETATION: {
    emoji: "💭",
    color: "var(--color-lavender)",
    description: "我自己觉得它是什么意思",
  },
  MY_IMAGINATION: {
    emoji: "✨",
    color: "var(--color-sunshine)",
    description: "我想象出来的、加上去的",
  },
  INSPIRED_BY_AI_QUESTION: {
    emoji: "💡",
    color: "var(--color-grass)",
    description: "AI 的问题启发了我",
  },
  AI_POSSIBILITY_MODIFIED_BY_ME: {
    emoji: "🎨",
    color: "var(--color-sunset)",
    description: "AI 建议的,但我改过了",
  },
};

export function SourceReflectionPanel({ storyId, selection, existing }: Props) {
  const [sourceType, setSourceType] = useState<ReflectionSourceType | null>(null);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<StoryReflectionView[]>(existing);
  const [error, setError] = useState<string | null>(null);

  async function associate() {
    if (!selection || !sourceType) return;
    setError(null);
    try {
      const created = await createReflectionAction({
        storyId,
        sourceType,
        startOffset: selection.start,
        endOffset: selection.end,
        selectedText: selection.text,
        note,
      });
      setSaved((prev) => [...prev, created]);
      setSourceType(null);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败,请再试一次");
    }
  }

  return (
    <div className="card" style={{ borderLeft: "4px solid var(--color-ocean)" }}>
      <h3 style={{ display: "flex", alignItems: "center", gap: "var(--space-sm)", marginBottom: "var(--space-lg)" }}>
        <span className="emoji">🔍</span>
        这段话是从哪里来的?
      </h3>

      {!selection ? (
        <div
          style={{
            padding: "var(--space-xl)",
            textAlign: "center",
            background: "var(--color-cloud)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <p style={{ fontSize: "1.1rem", marginBottom: "var(--space-sm)" }}>
            <span className="emoji" style={{ fontSize: "2rem" }}>
              👆
            </span>
          </p>
          <p style={{ color: "var(--color-text-soft)" }}>
            在上面的编辑器里选中一段你写的文字,然后告诉我们它是从哪里来的。
          </p>
        </div>
      ) : (
        <div>
          {/* 选中的文字 / Selected text */}
          <div
            style={{
              padding: "var(--space-md)",
              background: "linear-gradient(135deg, #E3F2FD 0%, #F3E5F5 100%)",
              borderRadius: "var(--radius-md)",
              borderLeft: "4px solid var(--color-primary)",
              marginBottom: "var(--space-lg)",
            }}
          >
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-soft)", marginBottom: "var(--space-xs)" }}>
              你选中的文字:
            </p>
            <p style={{ fontSize: "1.05rem", fontWeight: "500", fontStyle: "italic", lineHeight: "1.6" }}>
              "{selection.text}"
            </p>
          </div>

          {/* 来源类型选择 / Source type selection */}
          <fieldset
            style={{
              border: "none",
              padding: 0,
              marginBottom: "var(--space-lg)",
            }}
          >
            <legend
              style={{
                fontSize: "1.1rem",
                fontWeight: "600",
                marginBottom: "var(--space-md)",
              }}
            >
              这段话是...
            </legend>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
              {REFLECTION_SOURCE_TYPES.map((t) => {
                const style = SOURCE_STYLES[t];
                const isSelected = sourceType === t;
                return (
                  <label
                    key={t}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--space-sm)",
                      padding: "var(--space-md)",
                      background: isSelected ? `${style.color}20` : "var(--color-cloud)",
                      border: isSelected ? `3px solid ${style.color}` : "3px solid transparent",
                      borderRadius: "var(--radius-md)",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                    }}
                  >
                    <input
                      type="radio"
                      name="sourceType"
                      value={t}
                      checked={sourceType === t}
                      onChange={() => setSourceType(t)}
                    />
                    <span className="emoji" style={{ fontSize: "1.5rem" }}>
                      {style.emoji}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: "600", marginBottom: "2px" }}>
                        {REFLECTION_SOURCE_LABELS[t]}
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "var(--color-text-soft)" }}>
                        {style.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* 备注 / Note */}
          <div style={{ marginBottom: "var(--space-lg)" }}>
            <label htmlFor="reflection-note" style={{ marginBottom: "var(--space-sm)" }}>
              <span className="emoji">📝</span>
              想说点什么吗?(可选)
            </label>
            <textarea
              id="reflection-note"
              placeholder="比如:我当时在公园看到了这只红风筝..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>

          {/* 保存按钮 / Save button */}
          <button
            type="button"
            onClick={associate}
            disabled={sourceType === null}
            style={{
              width: "100%",
              background:
                sourceType === null
                  ? "var(--color-cloud)"
                  : "linear-gradient(135deg, var(--color-grass) 0%, var(--color-ocean) 100%)",
              color: sourceType === null ? "var(--color-text-soft)" : "white",
              fontSize: "1.1rem",
            }}
          >
            {sourceType === null ? "👆 请先选一个来源" : "💾 保存我的反思"}
          </button>

          {error && (
            <p
              role="alert"
              style={{
                marginTop: "var(--space-sm)",
                padding: "var(--space-sm)",
                background: "#FFE5E5",
                borderRadius: "var(--radius-sm)",
                color: "var(--color-danger)",
                fontSize: "0.9rem",
              }}
            >
              {error}
            </p>
          )}
        </div>
      )}

      {/* 已保存的反思 / Saved reflections */}
      {saved.length > 0 && (
        <div style={{ marginTop: "var(--space-2xl)", paddingTop: "var(--space-xl)", borderTop: "2px dashed var(--color-border)" }}>
          <h4 style={{ marginBottom: "var(--space-md)" }}>
            <span className="emoji">📚</span>
            我的反思记录 ({saved.length})
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
            {saved.map((r) => {
              const style = SOURCE_STYLES[r.sourceType];
              return (
                <div
                  key={r.id}
                  className="animate-in"
                  style={{
                    padding: "var(--space-md)",
                    background: `${style.color}15`,
                    borderLeft: `4px solid ${style.color}`,
                    borderRadius: "var(--radius-md)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "var(--space-xs)", marginBottom: "var(--space-xs)" }}>
                    <span className="emoji">{style.emoji}</span>
                    <strong style={{ fontSize: "0.95rem" }}>{REFLECTION_SOURCE_LABELS[r.sourceType]}</strong>
                  </div>
                  <p style={{ fontStyle: "italic", marginBottom: r.note ? "var(--space-xs)" : 0 }}>
                    "{r.selectedText}"
                  </p>
                  {r.note && (
                    <p style={{ fontSize: "0.9rem", color: "var(--color-text-soft)" }}>
                      💬 {r.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
