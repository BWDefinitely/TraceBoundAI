import { prisma } from "../lib/prisma";
import { getStory } from "../story/storyService";
import { StoryWorkspace } from "./story/StoryWorkspace";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const usingMemoryDb = !process.env.DATABASE_URL;

  let story = null;
  try {
    story = await getStory(prisma, "story-1");
  } catch {
    story = null;
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* 顶部标题栏 / Header */}
      <header
        style={{
          background: "linear-gradient(135deg, var(--color-ocean) 0%, var(--color-sky) 100%)",
          color: "white",
          padding: "var(--space-xl)",
          textAlign: "center",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <h1
          style={{
            fontSize: "2.5rem",
            fontFamily: "var(--font-display)",
            marginBottom: "var(--space-sm)",
          }}
        >
          <span className="emoji" style={{ fontSize: "3rem" }}>
            📖
          </span>{" "}
          我的轨迹故事
        </h1>
        <p style={{ fontSize: "1.2rem", opacity: 0.95 }}>
          收集你的轨迹,反思你的想法,写下属于你自己的故事
        </p>
      </header>

      {/* 演示模式提示 / Demo mode banner */}
      {usingMemoryDb && (
        <div
          style={{
            maxWidth: "1200px",
            margin: "var(--space-lg) auto",
            padding: "0 var(--space-lg)",
          }}
        >
          <div
            className="card animate-in"
            style={{
              background: "linear-gradient(135deg, #FFF9E6 0%, #FFE8D6 100%)",
              borderLeft: "4px solid var(--color-sunshine)",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-md)",
            }}
          >
            <span className="emoji" style={{ fontSize: "2rem" }}>
              🎮
            </span>
            <div>
              <p style={{ fontWeight: "600", marginBottom: "var(--space-xs)" }}>
                现在是<strong>演示模式</strong>
              </p>
              <p style={{ fontSize: "0.95rem", color: "var(--color-text-soft)" }}>
                你看到的数据存在电脑的内存里,关闭浏览器后会重置。AI 使用的是模拟回复,不会连接真实的 AI 服务。
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 主内容 / Main content */}
      <main>
        {story ? (
          <StoryWorkspace
            childId="child-1"
            story={story}
            selectedTraceIds={["trace-photo-1", "trace-text-1"]}
          />
        ) : (
          <div
            style={{
              maxWidth: "600px",
              margin: "var(--space-2xl) auto",
              padding: "var(--space-lg)",
              textAlign: "center",
            }}
          >
            <div className="card">
              <p style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }}>
                📝
              </p>
              <h2 style={{ marginBottom: "var(--space-md)" }}>还没有故事</h2>
              <p style={{ color: "var(--color-text-soft)", lineHeight: "1.6" }}>
                如果你配置了真实的数据库(<code>DATABASE_URL</code>),请先运行数据库迁移并创建一个故事。
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 页脚 / Footer */}
      <footer
        style={{
          marginTop: "var(--space-2xl)",
          padding: "var(--space-xl)",
          textAlign: "center",
          color: "var(--color-text-soft)",
          fontSize: "0.9rem",
        }}
      >
        <p>
          <span className="emoji">🌟</span>
          记住:这是<strong>你的</strong>故事,没有对错。
        </p>
      </footer>
    </div>
  );
}
