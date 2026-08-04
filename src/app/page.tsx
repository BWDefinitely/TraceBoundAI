"use client";

import Link from "next/link";
import { useData } from "./_components/DataProvider";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  const { materials, stories, alchemy, reflections, settings, providerLabel } = useData();
  const provider = settings?.provider ?? "mock";
  const modelLabel = providerLabel.split(" · ")[1] ?? providerLabel;
  const active = stories.filter((s) => !s.completedAt);
  const done = stories.filter((s) => s.completedAt);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newUserId, setNewUserId] = useState("");
  const [newStoryTitle, setNewStoryTitle] = useState("");
  const [reuseOldMaterials, setReuseOldMaterials] = useState(false);

  // 统计生成的场景图片总数
  const totalSceneImages = stories.reduce((sum, s) => sum + (s.sceneImages?.length ?? 0), 0);

  function handleStartNewStory() {
    if (!newUserId.trim()) {
      alert("请输入用户ID（不能为空）");
      return;
    }
    // 保存到 sessionStorage，传递给后续步骤；故事标题留空时默认「新故事」
    sessionStorage.setItem("newStoryUserId", newUserId.trim());
    sessionStorage.setItem("newStoryTitle", newStoryTitle.trim() || "新故事");
    sessionStorage.setItem("newStoryReuseOld", reuseOldMaterials ? "1" : "0");
    router.push("/create/step1");
  }

  return (
    <div className="fade-in">
      <header style={{ marginBottom: "var(--space-8)" }}>
        <div
          style={{
            fontSize: "0.75rem",
            letterSpacing: "0.14em",
            fontWeight: 700,
            color: "var(--accent)",
            textTransform: "uppercase",
            marginBottom: "var(--space-2)",
          }}
        >
          Story Trace · 写作工作室
        </div>
        <h1 style={{ fontSize: "2.4rem", marginBottom: "var(--space-3)" }}>
          今天，我们想创作什么故事？
        </h1>
        <p className="muted" style={{ maxWidth: 640, fontSize: "1.05rem", lineHeight: 1.8 }}>
          从采集素材开始，到故事创作，再到回顾反思——每一步都有 AI 陪伴你探索。
        </p>
      </header>

      {/* 数据统计 */}
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "var(--space-4)",
          marginBottom: "var(--space-8)",
        }}
      >
        <Stat label="素材库" value={materials.length} unit="份" />
        <Stat label="进行中" value={active.length} unit="个故事" />
        <Stat label="已完成" value={done.length} unit="个故事" />
        <Stat label="炼金记录" value={alchemy.length} unit="次" />
        <Stat label="场景图片" value={totalSceneImages} unit="张" />
        <Stat label="反思回顾" value={reflections.length} unit="篇" />
      </section>

      {/* 六大功能入口 */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--space-4)" }}>功能导航</h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "var(--space-5)",
          }}
        >
          <FeatureCard
            number="1"
            title="创建新故事"
            description="按照 5 步向导创建故事：导入素材 → 填写元数据 → 炼金 → 撰写 → 回顾。"
            href="#"
            icon="✨"
            badge="开始"
            onClick={() => setShowCreateDialog(true)}
          />
          <FeatureCard
            number="2"
            title="素材库"
            description="查看和管理所有素材，支持单独添加图片、文字、音频素材。"
            href="/materials"
            icon="📦"
          />
          <FeatureCard
            number="3"
            title="故事列表"
            description="查看所有进行中和已完成的故事，继续编辑或查看回顾。"
            href="/write"
            icon="📖"
          />
          <FeatureCard
            number="4"
            title="AI 设置"
            description="配置 AI 模型、API Key、生图和读图功能。"
            href="#"
            icon="⚙️"
            onClick={() => {
              if (typeof window !== 'undefined') {
                const event = new CustomEvent('openDrawer', { detail: 'settings' });
                window.dispatchEvent(event);
              }
            }}
          />
          <FeatureCard
            number="5"
            title="数据管理"
            description="导出备份、导入数据，管理本地存储。"
            href="/settings"
            icon="💾"
          />
        </div>
      </section>

      {/* 进行中的故事 */}
      <section style={{ marginBottom: "var(--space-8)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: "var(--space-4)",
          }}
        >
          <h2 style={{ fontSize: "1.2rem", margin: 0 }}>进行中的故事</h2>
          <Link href="/write" style={{ fontSize: "0.9rem" }}>
            查看全部 →
          </Link>
        </div>
        {active.length === 0 ? (
          <div className="card" style={{ padding: "var(--space-5)", textAlign: "center" }}>
            <p className="muted">还没有进行中的故事</p>
            <button onClick={() => setShowCreateDialog(true)} className="btn-primary" style={{ marginTop: "var(--space-3)" }}>
              创建新故事
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            {active.slice(0, 6).map((s) => (
              <Link
                key={s.id}
                href={`/create/step4?storyId=${s.id}`}
                onClick={() => {
                  if (typeof window !== "undefined") sessionStorage.setItem("currentStoryId", s.id);
                }}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--space-3)",
                  textDecoration: "none",
                  transition: "transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "var(--shadow-3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "var(--shadow-1)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                  <span className="tag tag-accent">故事</span>
                  {s.sceneImages && s.sceneImages.length > 0 && (
                    <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)" }}>
                      🎨 {s.sceneImages.length}
                    </span>
                  )}
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-serif)",
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    color: "var(--ink)",
                  }}
                >
                  {s.title}
                </span>
                {s.metadata && (s.metadata.time || s.metadata.place || s.metadata.people?.length > 0) && (
                  <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                    {s.metadata.time && <span>📅 {s.metadata.time}</span>}
                    {s.metadata.place && <span>📍 {s.metadata.place}</span>}
                    {s.metadata.people && s.metadata.people.length > 0 && (
                      <span>👤 {s.metadata.people.join("、")}</span>
                    )}
                  </div>
                )}
                <span style={{ fontSize: "0.8rem", color: "var(--ink-soft)", marginTop: "auto" }}>
                  更新于 {new Date(s.updatedAt).toLocaleDateString("zh-CN")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 系统信息 */}
      <section
        className="card"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-4)",
        }}
      >
        <div>
          <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "var(--space-1)" }}>
            数据存储
          </div>
          <div style={{ fontFamily: "monospace", fontSize: "0.9rem" }}>浏览器本地 · IndexedDB</div>
        </div>
        <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          AI 引擎：
          <strong style={{ color: "var(--ink)", marginLeft: 4 }}>{provider}</strong>
          <span className="muted" style={{ marginLeft: 6 }}>· {modelLabel}</span>
        </div>
      </section>

      {/* 创建新故事对话框 */}
      {showCreateDialog && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowCreateDialog(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 480,
              width: "90%",
              padding: "var(--space-6)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ fontSize: "1.5rem", marginBottom: "var(--space-4)" }}>创建新故事</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
              <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                  用户ID <span style={{ color: "var(--danger)" }}>*</span>
                </span>
                <input
                  type="text"
                  value={newUserId}
                  onChange={(e) => setNewUserId(e.target.value)}
                  placeholder="输入你的ID（用于区分不同用户的素材和故事，不能为空）"
                  style={{ fontSize: "0.95rem" }}
                  required
                />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
                <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>故事标题</span>
                <input
                  type="text"
                  value={newStoryTitle}
                  onChange={(e) => setNewStoryTitle(e.target.value)}
                  placeholder="输入故事标题"
                  style={{ fontSize: "0.95rem" }}
                />
              </label>

              {/* 复用之前导入的素材 */}
              <label style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", cursor: "pointer", margin: 0 }}>
                <input
                  type="checkbox"
                  checked={reuseOldMaterials}
                  onChange={(e) => setReuseOldMaterials(e.target.checked)}
                  style={{ width: 20, height: 20, cursor: "pointer", flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>复用之前导入的素材</div>
                  <div className="muted" style={{ fontSize: "0.8rem" }}>
                    勾选后，之前导入的同用户ID素材也将参与本次故事创作
                  </div>
                </div>
              </label>

              <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "flex-end", marginTop: "var(--space-2)" }}>
                <button
                  className="btn-secondary"
                  onClick={() => setShowCreateDialog(false)}
                >
                  取消
                </button>
                <button
                  className="btn-primary"
                  onClick={handleStartNewStory}
                >
                  开始创作 →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: number; unit: string }) {
  return (
    <div className="card" style={{ padding: "var(--space-4)" }}>
      <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: "var(--space-2)" }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: "0.35rem" }}>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: "2rem",
            fontWeight: 700,
            color: "var(--ink)",
          }}
        >
          {value}
        </span>
        <span style={{ color: "var(--ink-soft)", fontSize: "0.85rem" }}>{unit}</span>
      </div>
    </div>
  );
}

function FeatureCard({
  number,
  title,
  description,
  href,
  icon,
  badge,
  onClick,
}: {
  number: string;
  title: string;
  description: string;
  href: string;
  icon: string;
  badge?: string;
  onClick?: () => void;
}) {
  const content = (
    <div
      className="card"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        transition: "all 0.2s",
        cursor: "pointer",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "var(--shadow-2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "var(--shadow-1)";
      }}
      onClick={onClick}
    >
      {badge && (
        <span
          style={{
            position: "absolute",
            top: "var(--space-3)",
            right: "var(--space-3)",
            fontSize: "0.7rem",
            padding: "2px 8px",
            background: "var(--accent)",
            color: "white",
            borderRadius: "var(--radius)",
            fontWeight: 600,
          }}
        >
          {badge}
        </span>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
        <span style={{ fontSize: "2rem" }}>{icon}</span>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: "50%",
            background: "var(--accent-wash)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            color: "var(--accent)",
          }}
        >
          {number}
        </div>
      </div>
      <h3
        style={{
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "var(--ink)",
          margin: 0,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--ink-soft)",
          lineHeight: 1.6,
          margin: 0,
        }}
      >
        {description}
      </p>
    </div>
  );

  if (onClick) {
    return content;
  }

  return <Link href={href}>{content}</Link>;
}
