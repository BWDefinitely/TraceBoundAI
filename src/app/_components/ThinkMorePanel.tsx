"use client";

import { useState } from "react";
import type { Material, Story, StorySlot } from "../../lib/store";
import { askAgent } from "../../lib/ai";
import { getAiSettings } from "../../lib/client-store";

type SlotKey = "discovery" | "goal" | "accident" | "action" | "change";

const SLOT_LABELS: Record<SlotKey, string> = {
  discovery: "发现",
  goal: "目标",
  accident: "意外",
  action: "行动",
  change: "改变",
};

// 每个场景的可能性按钮提示
const POSSIBILITY_PROMPTS: Record<SlotKey, string[]> = {
  discovery: [
    "增加感官细节",
    "扩展情绪反应",
    "添加意外发现",
    "强化对比冲突"
  ],
  goal: [
    "明确具体目标",
    "增加动机深度",
    "添加阻碍因素",
    "设置时间压力"
  ],
  accident: [
    "加剧冲突强度",
    "引入新的角色",
    "揭示隐藏信息",
    "制造误会巧合"
  ],
  action: [
    "增加行动细节",
    "展现决策过程",
    "描写身体动作",
    "添加对话冲突"
  ],
  change: [
    "深化内心变化",
    "展现外部结果",
    "呼应前文伏笔",
    "留下开放结尾"
  ],
};

interface TextCard {
  id: string;
  buttonLabel: string;
  content: string;
  hint: string;
}

interface Props {
  slotKey: SlotKey;
  slotData: StorySlot;
  story: Story;
  materials: Material[];
  onClose: () => void;
  onAdopt: (content: string) => void;
}

// "想更多"面板：左侧当前场景，中间可能性按钮，右侧生成的文字卡
export function ThinkMorePanel({ slotKey, slotData, story, materials, onClose, onAdopt }: Props) {
  const label = SLOT_LABELS[slotKey];
  const prompts = POSSIBILITY_PROMPTS[slotKey];
  
  const [textCards, setTextCards] = useState<TextCard[]>([]);
  const [generating, setGenerating] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  // 获取关联的素材
  const linkedMaterials = materials.filter(m => slotData.linkedMaterials.includes(m.id));

  async function handleGenerateIdeas(buttonLabel: string) {
    setGenerating(true);
    try {
      const settings = await getAiSettings();
      
      // 构建prompt
      const materialsDesc = linkedMaterials.map(m => 
        `${m.title}: ${m.iNoticed || m.itRemindsMe || '(无描述)'}`
      ).join('\n');
      
      const prompt = `
当前场景：「${label}」
场景已有内容：${slotData.text || '(暂无)'}

关联素材：
${materialsDesc || '(暂无)'}

写作方向：${buttonLabel}

请基于以上信息，生成3个不同的创意方向供选择。每个方向包含：
1. 一个简短的思考角度（10字内）
2. 具体的写作建议（50-80字）

请直接输出3个方向，格式：
方向1：[思考角度] - [写作建议]
方向2：[思考角度] - [写作建议]
方向3：[思考角度] - [写作建议]
`;

      const result = await askAgent({
        persona: "story-coach",
        userPrompt: prompt,
        settings,
      });

      // 解析AI返回的内容
      const lines = result.split('\n').filter(l => l.trim());
      const newCards: TextCard[] = [];
      
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        const line = lines[i];
        const match = line.match(/方向\d+[：:]\s*\[(.+?)\]\s*[-–—]\s*(.+)/);
        if (match) {
          newCards.push({
            id: `card-${Date.now()}-${i}`,
            buttonLabel,
            content: match[2].trim(),
            hint: match[1].trim(),
          });
        } else if (line.trim()) {
          // 如果格式不匹配，直接使用原文
          newCards.push({
            id: `card-${Date.now()}-${i}`,
            buttonLabel,
            content: line.replace(/^方向\d+[：:]\s*/, '').trim(),
            hint: `思路${i + 1}`,
          });
        }
      }

      setTextCards(prev => [...prev, ...newCards]);
    } catch (err) {
      console.error("生成创意失败:", err);
      alert(`生成失败：${(err as Error).message}`);
    } finally {
      setGenerating(false);
    }
  }

  function handleEdit(card: TextCard) {
    setEditingCardId(card.id);
    setEditContent(card.content);
  }

  function handleSaveEdit(cardId: string) {
    setTextCards(prev => prev.map(c => 
      c.id === cardId ? { ...c, content: editContent } : c
    ));
    setEditingCardId(null);
  }

  function handleCancelEdit() {
    setEditingCardId(null);
    setEditContent("");
  }

  function handleAdopt(card: TextCard) {
    onAdopt(card.content);
    handleDelete(card.id);
  }

  function handleDelete(cardId: string) {
    setTextCards(prev => prev.filter(c => c.id !== cardId));
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 200px)", gap: "var(--space-5)" }}>
      {/* 左侧：当前场景卡片 */}
      <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "1.05rem", margin: 0 }}>当前场景</h3>
          <button 
            onClick={onClose}
            className="btn-secondary"
            style={{ fontSize: "0.8rem", padding: "4px 10px" }}
          >
            ← 返回
          </button>
        </div>

        <div className="card" style={{ padding: "var(--space-3)", display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <div>
            <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--accent)" }}>{label}</span>
          </div>

          {/* 已撰写的内容 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-soft)" }}>已撰写</span>
            {slotData.text ? (
              <div 
                style={{ 
                  padding: "var(--space-2)", 
                  background: "var(--surface)", 
                  borderRadius: "var(--radius)",
                  fontSize: "0.85rem",
                  lineHeight: 1.5,
                  maxHeight: 150,
                  overflowY: "auto"
                }}
              >
                {slotData.text}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: "0.8rem", padding: "var(--space-2)" }}>暂无</p>
            )}
          </div>

          {/* 关联素材 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--ink-soft)" }}>
              素材 ({linkedMaterials.length})
            </span>
            {linkedMaterials.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", maxHeight: 180, overflowY: "auto" }}>
                {linkedMaterials.map(m => (
                  <div 
                    key={m.id}
                    style={{ 
                      padding: "var(--space-1) var(--space-2)",
                      background: "var(--accent-wash)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.75rem"
                    }}
                  >
                    <span className="tag" style={{ fontSize: "0.65rem", marginRight: 4 }}>{m.kind}</span>
                    <span style={{ fontWeight: 600 }}>{m.title}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="muted" style={{ fontSize: "0.8rem", padding: "var(--space-2)" }}>暂无</p>
            )}
          </div>
        </div>
      </div>

      {/* 中间：可能性按钮 */}
      <div style={{ width: 320, flexShrink: 0, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <h3 style={{ fontSize: "1.05rem", margin: 0 }}>可能的方向</h3>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {prompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => handleGenerateIdeas(prompt)}
              disabled={generating}
              className="card"
              style={{
                padding: "var(--space-4)",
                border: "1px solid var(--line)",
                background: "white",
                cursor: generating ? "not-allowed" : "pointer",
                textAlign: "left",
                transition: "all 0.2s ease",
                opacity: generating ? 0.6 : 1,
              }}
              onMouseEnter={(e) => !generating && (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--line)")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                <span style={{ fontSize: "1.2rem" }}>💡</span>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>{prompt}</span>
              </div>
            </button>
          ))}
        </div>

        {generating && (
          <div style={{ textAlign: "center", padding: "var(--space-3)" }}>
            <p style={{ fontSize: "0.9rem", color: "var(--accent)" }}>🤔 AI正在思考...</p>
          </div>
        )}
      </div>

      {/* 右侧：生成的文字卡（纵向滚动） */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h3 style={{ fontSize: "1.05rem", margin: 0 }}>创意选项</h3>
          <span className="muted" style={{ fontSize: "0.75rem" }}>{textCards.length} 个</span>
        </div>

        <div style={{ 
          flex: 1, 
          display: "flex", 
          flexDirection: "column", 
          gap: "var(--space-3)", 
          overflowY: "auto",
          paddingRight: "var(--space-2)"
        }}>
          {textCards.length === 0 ? (
            <div className="card" style={{ padding: "var(--space-6)", textAlign: "center" }}>
              <p className="muted" style={{ fontSize: "0.9rem" }}>
                点击左侧按钮生成创意方向
              </p>
            </div>
          ) : (
            textCards.map(card => (
              <div
                key={card.id}
                className="card"
                style={{
                  padding: "var(--space-4)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                  border: "1px solid var(--accent-soft)",
                  background: "var(--accent-wash)",
                }}
              >
                {/* 标签和提示 */}
                <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", flexWrap: "wrap" }}>
                  <span className="tag" style={{ background: "var(--accent)", color: "white" }}>
                    {card.buttonLabel}
                  </span>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--accent)" }}>
                    {card.hint}
                  </span>
                </div>

                {/* 内容 */}
                {editingCardId === card.id ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    style={{
                      minHeight: 100,
                      fontSize: "0.9rem",
                      lineHeight: 1.6,
                      resize: "vertical",
                    }}
                  />
                ) : (
                  <p style={{ fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>
                    {card.content}
                  </p>
                )}

                {/* 操作按钮 */}
                <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "auto" }}>
                  {editingCardId === card.id ? (
                    <>
                      <button
                        onClick={() => handleSaveEdit(card.id)}
                        className="btn-primary"
                        style={{ flex: 1, fontSize: "0.85rem", padding: "6px 12px" }}
                      >
                        保存
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="btn-secondary"
                        style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleAdopt(card)}
                        className="btn-primary"
                        style={{ flex: 1, fontSize: "0.85rem", padding: "6px 12px" }}
                      >
                        ✓ 采纳到场景
                      </button>
                      <button
                        onClick={() => handleEdit(card)}
                        className="btn-secondary"
                        style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                      >
                        ✏️ 编辑
                      </button>
                      <button
                        onClick={() => handleDelete(card.id)}
                        className="btn-secondary"
                        style={{ fontSize: "0.85rem", padding: "6px 12px" }}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
