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

  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintShownRef = useRef(false);
  const lastBodyRef = useRef("");

  // 初始化正文/字数
  useEffect(() => {
    if (story && !loaded) {
      const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, '');
      const pureTextLength = story.body ? stripHtml(story.body).length : 0;
      
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
          setUserWordCount(stripHtml(combinedText).length);
          // 保存到story
          saveStoryAction(story.id, { body: combinedText, userWordCount: stripHtml(combinedText).length });
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
    const stripHtml = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, '');
    
    const prev = lastBodyRef.current;
    const nextChars = stripHtml(next).length;
    const prevChars = stripHtml(prev).length;
    
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

  const totalChars = body.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, '').length;

  // 获取关联的素材
  const getLinkedMaterials = (slotKey: string): Material[] => {
    const slot = story.structure[slotKey as keyof typeof story.structure];
    if (!slot || !slot.linkedMaterials) return [];
    return materials.filter(m => slot.linkedMaterials.includes(m.id));
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
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
            gap: "var(--space-3)",
            maxHeight: "calc(100vh - 300px)",
            overflowY: "auto"
          }}>
            <h3 style={{ fontSize: "1rem", margin: 0, color: "var(--accent)" }}>📋 故事线参考</h3>
            
            {(["discovery", "goal", "accident", "action", "change"] as const).map((slotKey) => {
              const slot = story.structure[slotKey];
              const linkedMats = getLinkedMaterials(slotKey);
              
              return (
                <div 
                  key={slotKey}
                  className="card"
                  style={{ 
                    padding: "var(--space-3)",
                    background: "var(--surface)",
                  }}
                >
                  <div style={{ fontWeight: 600, color: "var(--accent)", marginBottom: "var(--space-2)", fontSize: "0.9rem" }}>
                    {SLOT_LABELS[slotKey]}
                  </div>
                  
                  {slot.text ? (
                    <p style={{ 
                      fontSize: "0.85rem", 
                      lineHeight: 1.5, 
                      margin: 0,
                      color: "var(--ink)"
                    }}>
                      {slot.text}
                    </p>
                  ) : (
                    <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>暂无内容</p>
                  )}
                  
                  {linkedMats.length > 0 && (
                    <div style={{ marginTop: "var(--space-2)", paddingTop: "var(--space-2)", borderTop: "1px solid var(--line)" }}>
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
              <RichTextArea value={body} onChange={handleBodyChange} onBlur={handleSave} disabled={initializing} />
              {initializing && <div className="muted" style={{ fontSize: "0.8rem" }}>准备中…</div>}
            </div>
          </div>

          {/* 右侧：AI Coach */}
          <AiCoachPanel story={story} body={body} onInsertText={handleInsertText} />
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
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

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
        ref={ref}
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
