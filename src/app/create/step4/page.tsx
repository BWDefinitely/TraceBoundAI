"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import { StepIndicator } from "../../_components/StepIndicator";
import { useData } from "../../_components/DataProvider";
import { saveStoryAction } from "../../_actions";
import { AiCoachPanel } from "../../_components/AiCoachPanel";
import { askAgent } from "../../../lib/ai";
import { getAiSettings } from "../../../lib/client-store";
import type { Material } from "../../../lib/store";

const IDLE_MS = 45000; // 45 秒无操作触发自动灵感提示

const SLOT_LABELS: Record<string, string> = {
  discovery: "发现",
  goal: "目标",
  accident: "意外",
  action: "行动",
  change: "改变",
};

// ---------- 字数统计：先去掉 AI 标记（data-ai-mark）再数 ----------
function stripHtmlForCount(html: string): string {
  return html
    .replace(/<span[^>]*data-ai-mark="[^"]*"[^>]*>.*?<\/span>/g, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, "");
}

// 转义用于在 HTML 中定位原文（避免特殊字符干扰）
function escapeHtmlForSearch(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 显眼的 AI 结构提示标记（≤10字）
function hintMarkHtml(hint: string): string {
  const h = escapeHtmlForSearch(hint.slice(0, 10));
  return `<span class="ai-mark" data-ai-mark="hint" style="background:#FFF3DC;color:#B67014;border:1px dashed #F5A623;border-radius:8px;padding:0 6px;font-weight:700;font-size:0.9em;white-space:nowrap;">🔍${h}</span>`;
}

// 错别字标红标记
function typoMarkHtml(word: string): string {
  const w = escapeHtmlForSearch(word);
  return `<span class="ai-mark" data-ai-mark="typo" style="color:#E7574C;background:#FCE4E2;border-bottom:2px solid #E7574C;border-radius:4px;padding:0 2px;">${w}</span>`;
}

// 在原文 anchor 第一次出现的位置之后，插入提示标记；找不到则返回原 html
function insertHintAfterAnchor(html: string, anchor: string, hint: string): string {
  const escaped = escapeHtmlForSearch(anchor);
  if (!escaped) return html;
  const idx = html.indexOf(escaped);
  if (idx === -1) return html;
  return html.slice(0, idx + escaped.length) + hintMarkHtml(hint) + html.slice(idx + escaped.length);
}

// 把错别字（原文片段）全部包上标红标记
function wrapTypo(html: string, word: string): string {
  const escaped = escapeHtmlForSearch(word);
  if (!escaped || !html.includes(escaped)) return html;
  return html.split(escaped).join(typoMarkHtml(word));
}

// 从 AI 回复里提取 JSON 数组（容错：支持前后有说明文字）
function extractJsonArray<T>(text: string): T[] | null {
  try {
    const arr = JSON.parse(text.trim());
    if (Array.isArray(arr)) return arr as T[];
  } catch {
    /* 继续尝试 */
  }
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start !== -1 && end > start) {
    try {
      const arr = JSON.parse(text.slice(start, end + 1));
      if (Array.isArray(arr)) return arr as T[];
    } catch {
      /* 无法解析 */
    }
  }
  return null;
}

function Step4Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { stories, materials, ready } = useData();

  const [storyId, setStoryId] = useState<string | null>(null);
  
  useEffect(() => {
    const urlStoryId = searchParams?.get("storyId") || null;
    const sessionStoryId = sessionStorage.getItem("currentStoryId");
    const finalId = urlStoryId || sessionStoryId;
    setStoryId(finalId);
    if (finalId) {
      sessionStorage.setItem("currentStoryId", finalId);
    }
  }, [searchParams]);

  const story = stories.find((s) => s.id === storyId);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [aiWordCount, setAiWordCount] = useState(0);
  const [userWordCount, setUserWordCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true); // 左侧故事线默认打开
  const [autoHint, setAutoHint] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);
  const [checking, setChecking] = useState<"none" | "structure" | "typo">("none");
  const [checkNote, setCheckNote] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const cleanHtmlRef = useRef<string | null>(null); // 未加 AI 标记的正文 HTML 快照（用于清除标记还原）

  // 根据当前故事的 userId 过滤素材
  const filteredMaterials = story ? materials.filter((m) => m.userId === story.userId) : [];

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintShownRef = useRef(false);
  const lastBodyRef = useRef("");

  // 初始化正文/字数
  useEffect(() => {
    if (story && !loaded) {
      const pureTextLength = story.body ? stripHtmlForCount(story.body).length : 0;
      
      setTitle(story.title);
      
      // 如果正文为空，自动粘贴五个场景内容
      if (!story.body || story.body.trim().length === 0) {
        const sceneTexts = [
          story.structure.discovery.text,
          story.structure.goal.text,
          story.structure.accident.text,
          story.structure.action.text,
          story.structure.change.text,
        ].filter(t => t && t.trim().length > 0);
        
        if (sceneTexts.length > 0) {
          const combinedText = sceneTexts.join('\n\n');
          setBody(combinedText);
          lastBodyRef.current = combinedText;
          setUserWordCount(stripHtmlForCount(combinedText).length);
          // 保存到story
          saveStoryAction(story.id, { body: combinedText, userWordCount: stripHtmlForCount(combinedText).length });
        } else {
          setBody(story.body);
          lastBodyRef.current = story.body;
        }
      } else {
        setBody(story.body);
        lastBodyRef.current = story.body;
      }
      
      setAiWordCount(story.aiWordCount ?? 0);
      setUserWordCount(story.userWordCount ?? pureTextLength);
      setLoaded(true);
    }
  }, [story, loaded]);

  // 空闲自动灵感提示
  function resetIdle() {
    hintShownRef.current = false;
    setAutoHint(null);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(triggerAutoHint, IDLE_MS);
  }

  async function triggerAutoHint() {
    if (hintShownRef.current || !story) return;
    hintShownRef.current = true;
    try {
      const settings = await getAiSettings();
      const prompt =
        `孩子有一会儿没写了。请基于下面的故事正文，给一句简短、温柔的灵感提示（不超过 30 字），` +
        `帮他想想接下来可以写什么。只给提示，不要替他写正文。\n\n正文：${body.slice(-300)}`;
      const reply = await askAgent({ persona: "story-coach", userPrompt: prompt, settings });
      setAutoHint(reply.replace(/^.*?——\s*/s, "").trim());
    } catch {
      setAutoHint("接下来会发生什么呢？试着写写看吧～");
    }
  }

  useEffect(() => {
    if (!loaded) return;
    resetIdle();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [loaded]);

  function handleBodyChange(next: string) {
    const prev = lastBodyRef.current;
    const nextChars = stripHtmlForCount(next).length;
    const prevChars = stripHtmlForCount(prev).length;
    
    if (nextChars > prevChars) {
      setUserWordCount((c) => c + (nextChars - prevChars));
    }
    lastBodyRef.current = next;
    setBody(next);
    resetIdle();
  }

  // AI Coach 插入文本：计入 AI 字数
  function handleInsertText(text: string, aiChars: number) {
    const next = body ? `${body}\n${text}` : text;
    lastBodyRef.current = next;
    setBody(next);
    setAiWordCount((c) => c + aiChars);
    resetIdle();
  }

  // 拿到"未标记"的正文 HTML：优先用快照，否则取当前编辑器
  function currentCleanHtml(): string {
    return cleanHtmlRef.current ?? editorRef.current?.innerHTML ?? body;
  }

  // 应用标记后统一写入编辑器并同步状态
  function applyMarkedHtml(markedHtml: string) {
    if (cleanHtmlRef.current === null) {
      cleanHtmlRef.current = editorRef.current?.innerHTML ?? body;
    }
    if (editorRef.current) {
      editorRef.current.innerHTML = markedHtml;
    }
    handleBodyChange(markedHtml);
  }

  // 结构提示：AI 检查故事结构，若有改进空间，在编辑器原文位置后插入 ≤10 字显眼提示
  async function handleStructureCheck() {
    if (!story || !body.trim()) {
      alert("先写一点内容再检查吧");
      return;
    }
    if (checking !== "none") return;
    setChecking("structure");
    setCheckNote(null);
    try {
      const settings = await getAiSettings();
      const structureText = (["discovery", "goal", "accident", "action", "change"] as const)
        .map((k) => `${SLOT_LABELS[k]}：${story.structure[k].text || "(空)"}`)
        .join("\n");
      const prompt =
        `你是儿童故事结构教练。故事采用五段结构：发现 / 目标 / 意外 / 行动 / 改变。\n\n` +
        `请检查下面的故事结构和正文，找出最值得改进的 1-3 处位置。\n` +
        `对每一处返回两条字段：\n` +
        `- anchor：正文中恰好紧挨着改进位置的那句结尾片段（10-25字，必须是原文中真实存在的文字）\n` +
        `- hint：不超过 10 个字的提示短语（例如"加一点意外""补充细节""冲突再大些"）\n\n` +
        `故事结构：\n${structureText}\n\n故事正文：\n${stripHtmlForCount(body)}\n\n` +
        `只返回 JSON 数组，不要返回任何其他文字。没有改进空间就返回 []。`;
      const reply = await askAgent({ persona: "story-coach", userPrompt: prompt, settings });
      const hints = extractJsonArray<{ anchor: string; hint: string }>(reply);

      if (!hints || hints.length === 0) {
        setCheckNote("AI 认为结构整体不错，暂时没有需要提示的地方");
        return;
      }

      let html = currentCleanHtml();
      let applied = 0;
      for (const h of hints) {
        const anchor = (h.anchor || "").trim();
        const hint = (h.hint || "").trim().slice(0, 10);
        if (!anchor || !hint) continue;
        const next = insertHintAfterAnchor(html, anchor, hint);
        if (next !== html) {
          html = next;
          applied++;
        }
      }
      if (applied === 0) {
        // 找不到 anchor 时兜底：在末尾追加一条提示，保持克制
        const hint = (hints[0].hint || "这里可再想想").trim().slice(0, 10);
        html = html + hintMarkHtml(hint);
        applied = 1;
      }
      applyMarkedHtml(html);
      setCheckNote(`已插入 ${applied} 处结构提示（选中可直接删除）`);
    } catch (err) {
      console.error("结构检查失败:", err);
      alert("检查失败：" + (err as Error).message);
    } finally {
      setChecking("none");
    }
  }

  // 检查错字：AI 找出错别字，在编辑器内标红（不改动原文文字）
  async function handleTypoCheck() {
    if (!story || !body.trim()) {
      alert("先写一点内容再检查吧");
      return;
    }
    if (checking !== "none") return;
    setChecking("typo");
    setCheckNote(null);
    try {
      const settings = await getAiSettings();
      const prompt =
        `请找出下面儿童故事中的错别字（错字、用词错误、明显的漏字），忽略标点和格式问题。\n` +
        `每项返回：{"word":"出错的字词（必须是原文中真实出现的原文片段）","fix":"正确的写法"}\n\n` +
        `故事正文：\n${stripHtmlForCount(body)}\n\n` +
        `只返回 JSON 数组，最多 10 项，没有错别字就返回 []，不要返回任何其他文字。`;
      const reply = await askAgent({ persona: "story-coach", userPrompt: prompt, settings });
      const typos = extractJsonArray<{ word: string; fix?: string }>(reply);

      if (!typos || typos.length === 0) {
        setCheckNote("没发现明显的错别字，写得挺干净～");
        return;
      }

      let html = currentCleanHtml();
      let applied = 0;
      for (const t of typos) {
        const word = (t.word || "").trim();
        if (!word) continue;
        const next = wrapTypo(html, word);
        if (next !== html) {
          html = next;
          applied++;
        }
      }
      if (applied === 0) {
        setCheckNote("AI 给出的字词在正文中没找到，可能已被修改");
        return;
      }
      applyMarkedHtml(html);
      setCheckNote(`已标红 ${applied} 处疑似错别字（只标记不改字，可点「清除标记」还原）`);
    } catch (err) {
      console.error("错字检查失败:", err);
      alert("检查失败：" + (err as Error).message);
    } finally {
      setChecking("none");
    }
  }

  // 清除所有 AI 标记，恢复检查前的原文
  function handleClearMarks() {
    const clean = cleanHtmlRef.current;
    if (!clean) return;
    cleanHtmlRef.current = null;
    if (editorRef.current) {
      editorRef.current.innerHTML = clean;
    }
    handleBodyChange(clean);
    setCheckNote("已清除所有 AI 标记，原文未被动过");
  }

  async function handleSave() {
    if (!storyId) return;
    setSaving(true);
    try {
      await saveStoryAction(storyId, { title, body, aiWordCount, userWordCount });
    } finally {
      setSaving(false);
    }
  }

  function handleNext() {
    handleSave();
    router.push(`/create/step5?storyId=${storyId}`);
  }

  if (!ready) {
    return <div className="fade-in"><p className="muted">加载中...</p></div>;
  }

  if (!story) {
    return (
      <div className="fade-in" style={{ textAlign: "center", padding: "var(--space-8)" }}>
        <p className="muted" style={{ marginBottom: "var(--space-4)" }}>未找到故事，请先创建故事。</p>
        <button onClick={() => router.push("/create/step2")} className="btn-primary">
          去填写故事信息 →
        </button>
      </div>
    );
  }

  const totalChars = stripHtmlForCount(body).length;

  // 获取关联的素材
  const getLinkedMaterials = (slotKey: string): Material[] => {
    const slot = story.structure[slotKey as keyof typeof story.structure];
    if (!slot || !slot.linkedMaterials) return [];
    return filteredMaterials.filter(m => slot.linkedMaterials.includes(m.id));
  };

  return (
    <div className="fade-in">
      <StepIndicator currentStep={4} totalSteps={5} />

      <header style={{ marginBottom: "var(--space-5)", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>步骤 4：故事撰写</h1>
        <p className="muted" style={{ fontSize: "0.95rem" }}>
          左侧查看故事线参考，中间写正文，右侧 AI Coach 陪你找灵感。
        </p>
      </header>

      {/* 工具条 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "var(--space-3)", marginBottom: "var(--space-4)" }}>
        <button className="btn-secondary" onClick={() => setSidebarOpen(!sidebarOpen)}>
          {sidebarOpen ? "◀ 收起故事线" : "▶ 展开故事线"}
        </button>

        <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
          总字数 {totalChars} · ✍️你 {userWordCount} · 🤖AI {aiWordCount}
        </span>
      </div>

      <div style={{ display: "flex", gap: "var(--space-5)" }}>
        {/* 左侧：故事线面板（常驻，可收起） */}
        {sidebarOpen && (
          <div style={{ 
            width: 280, 
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            maxHeight: "calc(100vh - 160px)",
            overflowY: "auto",
            position: "sticky",
            top: 0,
          }}>
            <h3 style={{ fontSize: "1rem", margin: 0, color: "var(--accent)" }}>📋 故事线参考</h3>

            {/* 故事设定（step2 元数据） */}
            <div
              className="card"
              style={{
                padding: "var(--space-3)",
                background: "var(--surface)",
              }}
            >
              <div style={{ fontWeight: 600, color: "var(--accent)", marginBottom: "var(--space-2)", fontSize: "0.9rem" }}>
                🧭 故事设定
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)", fontSize: "0.82rem", color: "var(--ink)" }}>
                <span style={{ lineHeight: 1.5 }}>
                  <span style={{ color: "var(--ink-soft)" }}>📅 时间：</span>
                  {story.metadata.time || <span style={{ color: "var(--ink-soft)" }}>—</span>}
                </span>
                <span style={{ lineHeight: 1.5 }}>
                  <span style={{ color: "var(--ink-soft)" }}>📍 地点：</span>
                  {story.metadata.place || <span style={{ color: "var(--ink-soft)" }}>—</span>}
                </span>
                <span style={{ lineHeight: 1.5 }}>
                  <span style={{ color: "var(--ink-soft)" }}>👤 人物：</span>
                  {story.metadata.people.length > 0 ? story.metadata.people.join("、") : <span style={{ color: "var(--ink-soft)" }}>—</span>}
                </span>
                <span style={{ lineHeight: 1.5 }}>
                  <span style={{ color: "var(--ink-soft)" }}>⚡ 事件：</span>
                  {story.metadata.event || <span style={{ color: "var(--ink-soft)" }}>—</span>}
                </span>
              </div>
            </div>
            
            {(["discovery", "goal", "accident", "action", "change"] as const).map((slotKey) => {
              const slot = story.structure[slotKey];
              const linkedMats = getLinkedMaterials(slotKey);
              
              return (
                <div 
                  key={slotKey}
                  className="card"
                  style={{ 
                    padding: "var(--space-2)",
                    background: "var(--surface)",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--accent)", marginBottom: "var(--space-1)", fontSize: "0.9rem" }}>
                    {SLOT_LABELS[slotKey]}
                  </div>
                  
                  {slot.text ? (
                    <p style={{ 
                      fontSize: "0.85rem", 
                      lineHeight: 1.5, 
                      margin: 0,
                      color: "var(--ink)",
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {slot.text}
                    </p>
                  ) : (
                    <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>暂无内容</p>
                  )}
                  
                  {linkedMats.length > 0 && (
                    <div style={{ marginTop: "var(--space-1)", paddingTop: "var(--space-1)", borderTop: "1px solid var(--line)" }}>
                      <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
                        🖼 {linkedMats.length} 个素材
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 中间+右侧 */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: sidebarOpen ? "1.5fr 1fr" : "1.6fr 1fr", gap: "var(--space-5)" }}>
          {/* 中间：编辑器 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleSave}
                placeholder="故事标题"
                style={{ fontSize: "1.4rem", fontWeight: 700, border: "none", background: "transparent", padding: 0 }}
              />
              {autoHint && (
                <div
                  style={{
                    padding: "8px 12px",
                    background: "var(--accent-wash)",
                    border: "1px solid var(--accent-soft)",
                    borderRadius: "var(--radius)",
                    fontSize: "0.85rem",
                    color: "var(--accent)",
                  }}
                >
                  💡 {autoHint}
                </div>
              )}
              <RichTextArea value={body} onChange={handleBodyChange} onBlur={handleSave} disabled={initializing} editorRef={editorRef} />
              {initializing && <div className="muted" style={{ fontSize: "0.8rem" }}>准备中…</div>}
            </div>
          </div>

          {/* 右侧：AI Coach */}
          <AiCoachPanel
            story={story}
            body={body}
            onInsertText={handleInsertText}
            checking={checking}
            canClearMarks={!!cleanHtmlRef.current}
            checkNote={checkNote}
            onStructureCheck={handleStructureCheck}
            onTypoCheck={handleTypoCheck}
            onClearMarks={handleClearMarks}
          />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-6)" }}>
        <button onClick={() => router.push("/create/step3")} className="btn-secondary">
          ← 上一步
        </button>
        <div style={{ display: "flex", gap: "var(--space-3)" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)", alignSelf: "center" }}>
            {saving ? "保存中..." : "已自动保存"}
          </span>
          <button onClick={handleNext} className="btn-primary">
            下一步：故事回顾 →
          </button>
        </div>
      </div>
    </div>
  );
}

// 简单富文本编辑器：contentEditable + 加粗/斜体/颜色
function RichTextArea({
  value,
  onChange,
  onBlur,
  disabled,
  editorRef,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled?: boolean;
  editorRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function setRef(el: HTMLDivElement | null) {
    ref.current = el;
    if (editorRef) {
      (editorRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
    }
  }

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value;
    }
  }, [value]);

  function exec(cmd: string, arg?: string) {
    document.execCommand(cmd, false, arg);
    if (ref.current) onChange(ref.current.innerHTML);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        <button type="button" className="btn-secondary" onClick={() => exec("bold")} style={{ fontWeight: 700, fontSize: "0.8rem", padding: "4px 10px" }}>B</button>
        <button type="button" className="btn-secondary" onClick={() => exec("italic")} style={{ fontStyle: "italic", fontSize: "0.8rem", padding: "4px 10px" }}>I</button>
        <input type="color" onChange={(e) => exec("foreColor", e.target.value)} title="文字颜色" style={{ width: 32, height: 30, border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", cursor: "pointer" }} />
      </div>
      <div
        ref={setRef}
        contentEditable={!disabled}
        onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
        onBlur={onBlur}
        suppressContentEditableWarning
        style={{
          minHeight: 420,
          padding: "var(--space-3)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius)",
          fontSize: "1.05rem",
          lineHeight: 1.8,
          fontFamily: "var(--font-serif)",
          outline: "none",
          background: disabled ? "var(--surface)" : "white",
        }}
        data-placeholder="开始写你的故事..."
      />
    </div>
  );
}

export default function Step4Page() {
  return (
    <Suspense fallback={<div className="fade-in"><p className="muted">加载中...</p></div>}>
      <Step4Content />
    </Suspense>
  );
}
