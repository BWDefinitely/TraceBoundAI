"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useData } from "../_components/DataProvider";
import { getMediaBlob } from "../../lib/client-store";
import { useEffect, useState, Suspense } from "react";

export default function ReflectPage() {
  return (
    <Suspense fallback={<div className="fade-in"><p className="muted">加载中...</p></div>}>
      <ReflectPageContent />
    </Suspense>
  );
}

function ReflectPageContent() {
  const searchParams = useSearchParams();
  const storyId = searchParams.get("story");
  const { stories, materials } = useData();

  const story = stories.find((s) => s.id === storyId);

  if (!story) {
    return (
      <div className="fade-in">
        <div className="card" style={{ padding: "var(--space-6)", textAlign: "center" }}>
          <p className="muted">请先选择一个故事</p>
          <Link href="/write" className="btn-primary" style={{ marginTop: "var(--space-3)" }}>
            查看故事列表
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <header style={{ marginBottom: "var(--space-6)" }}>
        <Link href="/write" style={{ color: "var(--accent)", fontSize: "0.9rem", marginBottom: "var(--space-3)", display: "inline-block" }}>
          ← 返回
        </Link>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>{story.title}</h1>
        <div style={{ display: "flex", gap: "var(--space-4)", fontSize: "0.9rem", color: "var(--ink-soft)" }}>
          {story.metadata.time && <span>📅 {story.metadata.time}</span>}
          {story.metadata.place && <span>📍 {story.metadata.place}</span>}
          {story.completedAt && (
            <span>✅ 完成于 {new Date(story.completedAt).toLocaleDateString("zh-CN")}</span>
          )}
        </div>
      </header>

      {/* 故事正文 */}
      <section className="card" style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--space-4)" }}>故事正文</h2>
        <div
          style={{
            fontSize: "1.05rem",
            lineHeight: 1.8,
            whiteSpace: "pre-wrap",
            fontFamily: "var(--font-serif)",
          }}
        >
          {story.body || <span className="muted">还没有正文</span>}
        </div>
        <div style={{ marginTop: "var(--space-4)", paddingTop: "var(--space-4)", borderTop: "1px solid var(--line)" }}>
          <div style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
            字数统计：{story.body.length} 字
          </div>
        </div>
      </section>

      {/* 故事线可视化 */}
      <section className="card" style={{ marginBottom: "var(--space-6)" }}>
        <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--space-4)" }}>故事线</h2>
        <StoryStructureView structure={story.structure} materials={materials} />
      </section>

      {/* 场景图片画廊 */}
      {story.sceneImages && story.sceneImages.length > 0 && (
        <section className="card">
          <h2 style={{ fontSize: "1.3rem", marginBottom: "var(--space-4)" }}>场景图片</h2>
          <SceneGallery sceneImages={story.sceneImages} />
        </section>
      )}
    </div>
  );
}

function StoryStructureView({ structure, materials }: { structure: any; materials: any[] }) {
  const slots = [
    { key: "qi", label: "起", color: "var(--accent)" },
    { key: "cheng", label: "承", color: "var(--blue)" },
    { key: "zhuan", label: "转", color: "var(--amber)" },
    { key: "he", label: "合", color: "var(--green)" },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "var(--space-4)" }}>
      {slots.map((slot) => {
        const data = structure[slot.key];
        return (
          <div
            key={slot.key}
            style={{
              padding: "var(--space-4)",
              background: "var(--surface)",
              borderRadius: "var(--radius)",
              borderLeft: `4px solid ${slot.color}`,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: slot.color,
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                }}
              >
                {slot.label}
              </div>
              <span style={{ fontWeight: 600 }}>{slot.label}</span>
            </div>
            {data?.text ? (
              <p style={{ fontSize: "0.9rem", lineHeight: 1.6, margin: 0 }}>{data.text}</p>
            ) : (
              <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                未填写
              </p>
            )}
            {data?.linkedMaterials && data.linkedMaterials.length > 0 && (
              <div style={{ marginTop: "var(--space-3)", display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
                {data.linkedMaterials.map((matId: string) => {
                  const mat = materials.find((m: any) => m.id === matId);
                  return mat ? (
                    <span key={matId} className="tag" style={{ fontSize: "0.75rem" }}>
                      {mat.title}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SceneGallery({ sceneImages }: { sceneImages: Array<{ blobId: string; prompt: string; createdAt: string }> }) {
  const [imageUrls, setImageUrls] = useState<Array<{ url: string | null; prompt: string }>>([]);

  useEffect(() => {
    Promise.all(
      sceneImages.map(async (img) => {
        const blob = await getMediaBlob(img.blobId);
        return {
          url: blob ? URL.createObjectURL(blob) : null,
          prompt: img.prompt,
        };
      })
    ).then(setImageUrls);

    return () => {
      imageUrls.forEach((img) => {
        if (img.url) URL.revokeObjectURL(img.url);
      });
    };
  }, [sceneImages]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
      {imageUrls.map((img, index) => (
        <div
          key={index}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-2)",
            background: "var(--surface)",
            borderRadius: "var(--radius)",
            overflow: "hidden",
          }}
        >
          <div style={{ width: "100%", height: 280, background: "var(--card)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {img.url ? (
              <img src={img.url} alt={img.prompt} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: "3rem" }}>🎨</span>
            )}
          </div>
          <div style={{ padding: "var(--space-3)" }}>
            <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
              {img.prompt}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
