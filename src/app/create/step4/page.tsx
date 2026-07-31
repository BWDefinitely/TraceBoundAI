"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState, useEffect, useRef, Suspense } from "react";
import { StepIndicator } from "../../_components/StepIndicator";
import { useData } from "../../_components/DataProvider";
import { saveStoryAction } from "../../_actions";
import { AiCoachPanel } from "../../_components/AiCoachPanel";
import { StorylineDrawer } from "../../_components/StorylineDrawer";
import { SceneImagePanel } from "../../_components/SceneImagePanel";
import { askAgent } from "../../../lib/ai";
import { getAiSettings } from "../../../lib/client-store";

const IDLE_MS = 45000; // 45 秒无操作触发自动灵感提示

function Step4Content() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { stories, ready } = useData();

  const [storyId, setStoryId] = useState<string | null>(null);
  
  useEffect(() => {
    // 优先从 URL 读取，其次从 sessionStorage
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showImages, setShowImages] = useState(false);
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
      setBody(story.body);
      setAiWordCount(story.aiWordCount ?? 0);
      setUserWordCount(story.userWordCount ?? pureTextLength);
      lastBodyRef.current = story.body;
      setLoaded(true);
    }
  }, [story, loaded]);

  // AI 初始化：正文为空时，生成一个非常简单的故事开头供编辑
  useEffect(() => {
    if (!loaded || !story) return;
    if (story.body.trim().length > 0) return;
    if (initializing) return;
    let cancelled = false;
    (async () => {
      setInitializing(true);
      try {
        const settings = await getAiSettings();
        const meta = story.metadata;
        const prompt =
          `请为一个正在学写作的小朋友，写一个非常简单的故事开头（2-3 句话即可），` +
          `作为可编辑的草稿。时间：${meta.time || "未定"}，地点：${meta.place || "未定"}，` +
          `人物：${meta.people.join("、") || "未定"}，事件：${meta.event || "未定"}。` +
          `直接给出故事开头文字，不要解释，不要加引号。`;
        const reply = await askAgent({ persona: "story-coach", userPrompt: prompt, settings });
        if (!cancelled && reply) {
          const seed = reply.replace(/^.*?——\s*/s, "").trim();
          const pureTextLength = seed.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, '').length;
          setBody(seed);
          lastBodyRef.current = seed;
          setAiWordCount(pureTextLength);
          await saveStoryAction(story.id, { body: seed, aiWordCount: pureTextLength });
        }
      } catch {
        /* 忽略初始化失败 */
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, story?.id]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function handleBodyChange(next: string) {
    // 用户手动输入的字数计入用户字数
    // 先去除HTML标签，只统计纯文本字数
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

  return (
    <div className="fade-in">
      <StepIndicator currentStep={4} totalSteps={5} />

      <header style={{ marginBottom: "var(--space-5)", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>步骤 4：故事撰写</h1>
        <p className="muted" style={{ fontSize: "0.95rem" }}>
          左侧打开故事线参考，中间写正文，右侧 AI Coach 陪你找灵感。
        </p>
      </header>

      {/* 工具条 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-4)" }}>
        <button className="btn-secondary" onClick={() => setDrawerOpen(true)}>
          📋 故事线
        </button>
        <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center" }}>
          <span style={{ fontSize: "0.82rem", color: "var(--ink-soft)" }}>
            总字数 {totalChars} · ✍️你 {userWordCount} · 🤖AI {aiWordCount}
          </span>
          <button className="btn-secondary" onClick={() => setShowImages((v) => !v)}>
            🎨 生成场景图
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "var(--space-5)" }}>
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
            {initializing && <div className="muted" style={{ fontSize: "0.8rem" }}>AI 正在准备一个开头…</div>}
          </div>

          {showImages && <SceneImagePanel story={story} storyBody={body} />}
        </div>

        {/* 右侧：AI Coach */}
        <AiCoachPanel story={story} body={body} onInsertText={handleInsertText} />
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

      <StorylineDrawer story={story} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
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

  // 仅在外部值与 DOM 不一致时同步（避免打字时光标跳动）
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
