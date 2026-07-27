"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useDrawers } from "../_components/AppShell";
import { logOutdoorObserveAction } from "../_actions";

// 设计文档 §3.1 Outdoor Mission：机器人（Field Companion）引导儿童慢观察。
// 机器人不告诉孩子"这里能写什么故事"，只帮助停留、从多角度注意、并追问为什么想记录。
// 本页面不产生真实媒体，只记录观察行为事件（outdoor-observe）供 CHI 分析；
// 真正的采集在「素材」抽屉里完成。

const ROBOT_PROMPTS = [
  "先不要拍照，你最先注意到了什么？",
  "这里最明显的声音是什么？",
  "有什么东西和平常不一样？",
  "闭上眼睛，你还能感觉到什么？",
  "你为什么想把它带回教室？",
  "这是你看到的，还是你猜测的？",
];

const DWELL_SECONDS = 10;

export function OutdoorMission() {
  const { openDrawer } = useDrawers();
  const [phase, setPhase] = useState<"intro" | "observing" | "noticed">("intro");
  const [seconds, setSeconds] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);
  const [noticed, setNoticed] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 观察计时器
  useEffect(() => {
    if (phase !== "observing") return;
    timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  function log(
    action: "observe" | "skip" | "notice" | "record-intent",
    extra?: { noticed?: string }
  ) {
    startTransition(async () => {
      await logOutdoorObserveAction({
        dwellSeconds: seconds,
        skippedPrompt: action === "skip",
        noticed: extra?.noticed ?? "",
        action,
      });
    });
  }

  function startObserving() {
    setPhase("observing");
    setSeconds(0);
    log("observe");
  }

  function nextPrompt(skipped: boolean) {
    log(skipped ? "skip" : "observe");
    setPromptIndex((i) => (i + 1) % ROBOT_PROMPTS.length);
  }

  function markNoticed() {
    setPhase("noticed");
    log("notice", { noticed });
  }

  function recordTrace() {
    log("record-intent", { noticed });
    setToast("好的，把它带回教室——在「素材」抽屉里记下你的观察吧。");
    openDrawer("materials");
    setTimeout(() => setToast(null), 3200);
  }

  const dwellDone = seconds >= DWELL_SECONDS;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "var(--space-5)", maxWidth: 720 }}>
      <RobotCard prompt={ROBOT_PROMPTS[promptIndex]} phase={phase} seconds={seconds} dwellDone={dwellDone} />

      {phase === "intro" && (
        <div className="card" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <p style={{ margin: 0, lineHeight: 1.8 }}>
            今天的任务：在校园里找一个<strong>容易被忽略的地方</strong>，带回一些（不少于 5 个）值得写进故事的线索。
            机器人不会告诉你该写什么——它只会陪你慢下来，帮你注意平时错过的细节。
          </p>
          <button className="btn-primary" style={{ alignSelf: "flex-start", padding: "0.6rem 1.6rem" }} onClick={startObserving}>
            站定，开始慢观察
          </button>
        </div>
      )}

      {phase === "observing" && (
        <div className="card" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
            {dwellDone
              ? "观察满 10 秒了。注意到什么了吗？可以再看看，也可以记下来。"
              : `再站一会儿……已经观察 ${seconds} 秒 / ${DWELL_SECONDS} 秒`}
          </div>
          <DwellBar seconds={seconds} total={DWELL_SECONDS} />
          <label style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>我注意到了什么？</span>
            <textarea
              value={noticed}
              onChange={(e) => setNoticed(e.target.value)}
              rows={3}
              placeholder="墙角有断断续续的滴水声……"
              style={{ resize: "vertical" }}
            />
          </label>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <button className="btn-ghost" onClick={() => nextPrompt(false)}>
              我想继续观察
            </button>
            <button className="btn-ghost" onClick={() => nextPrompt(true)}>
              换个提示
            </button>
            <button className="btn-primary" onClick={markNoticed} disabled={!noticed.trim()}>
              我注意到了 →
            </button>
          </div>
        </div>
      )}

      {phase === "noticed" && (
        <div className="card" style={{ padding: "var(--space-5)", display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          <div style={{ fontSize: "0.9rem", fontWeight: 600 }}>你注意到的：</div>
          <p
            style={{
              margin: 0,
              padding: "var(--space-3)",
              background: "var(--accent-wash)",
              borderRadius: "var(--radius)",
              lineHeight: 1.7,
            }}
          >
            {noticed}
          </p>
          <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
            机器人问你：<strong>你为什么想把它带回教室？这是你看到的，还是你猜测的？</strong>
            带着这个问题，去「素材」抽屉里把它记成一条 Trace 吧。
          </p>
          <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap" }}>
            <button className="btn-primary" style={{ padding: "0.6rem 1.4rem" }} onClick={recordTrace}>
              记录这条发现 →
            </button>
            <button
              className="btn-ghost"
              onClick={() => {
                setPhase("observing");
                setSeconds(0);
                setNoticed("");
              }}
            >
              再找一个地方
            </button>
          </div>
          {toast && (
            <div style={{ fontSize: "0.85rem", color: "var(--accent-2)", fontWeight: 700 }}>{toast}</div>
          )}
        </div>
      )}
    </div>
  );
}

function RobotCard({
  prompt,
  phase,
  seconds,
  dwellDone,
}: {
  prompt: string;
  phase: string;
  seconds: number;
  dwellDone: boolean;
}) {
  return (
    <div
      className="card"
      style={{
        padding: "var(--space-5)",
        display: "flex",
        gap: "var(--space-4)",
        alignItems: "flex-start",
        background: "linear-gradient(135deg, var(--accent-wash) 0%, var(--card) 100%)",
      }}
    >
      <div
        aria-hidden
        style={{
          fontSize: "2.4rem",
          width: 60,
          height: 60,
          display: "grid",
          placeItems: "center",
          borderRadius: 18,
          background: "white",
          border: "1.5px solid var(--accent-soft)",
          boxShadow: "var(--shadow-1)",
          flexShrink: 0,
        }}
      >
        🤖
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.1em", color: "var(--accent)", textTransform: "uppercase" }}>
          Field Companion · 机器人小伙伴
        </div>
        <p style={{ margin: "var(--space-2) 0 0", fontSize: "1.1rem", fontWeight: 700, fontFamily: "var(--font-serif)", lineHeight: 1.6 }}>
          {phase === "intro"
            ? "先站在这里，听十秒钟。你不用急着拍照。"
            : phase === "observing"
              ? prompt
              : "很好——你已经注意到一个别人可能会错过的细节了。"}
        </p>
        {phase === "observing" && (
          <div style={{ marginTop: "var(--space-2)", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
            {dwellDone ? "慢观察完成 ✓" : `慢观察中 · ${seconds}s`}
          </div>
        )}
      </div>
    </div>
  );
}

function DwellBar({ seconds, total }: { seconds: number; total: number }) {
  const pct = Math.min(100, (seconds / total) * 100);
  return (
    <div style={{ height: 8, borderRadius: 999, background: "var(--paper-soft)", overflow: "hidden", border: "1px solid var(--line)" }}>
      <div
        style={{
          height: "100%",
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--accent) 0%, var(--accent-2) 100%)",
          transition: "width 0.9s linear",
        }}
      />
    </div>
  );
}
