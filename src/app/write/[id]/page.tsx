"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useData } from "../../_components/DataProvider";
import { StoryEditor } from "./StoryEditor";

export default function StoryEditPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { ready, stories, materials, ideas, firstThoughts } = useData();

  if (!ready) {
    return (
      <div className="fade-in">
        <p className="muted">正在加载故事…</p>
      </div>
    );
  }

  const story = stories.find((s) => s.id === id);
  if (!story) {
    return (
      <div className="fade-in">
        <div className="card" style={{ padding: "var(--space-6)", textAlign: "center" }}>
          <p className="muted" style={{ marginBottom: "var(--space-4)" }}>
            找不到这篇故事，可能已被删除。
          </p>
          <Link href="/write" className="btn-primary">
            回到故事列表 →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <StoryEditor
      story={{ ...story, body: story.body }}
      materials={materials}
      ideas={ideas}
      firstThoughts={firstThoughts}
    />
  );
}
