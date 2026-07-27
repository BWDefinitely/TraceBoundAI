"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "../_components/PageHeader";
import { ReflectForm } from "./ReflectForm";
import { useData } from "../_components/DataProvider";

export default function ReflectPage() {
  return (
    <Suspense fallback={<div className="fade-in"><p className="muted">正在加载…</p></div>}>
      <ReflectPageInner />
    </Suspense>
  );
}

function ReflectPageInner() {
  const searchParams = useSearchParams();
  const { stories, reflections, materials } = useData();
  const initial = searchParams.get("story") ?? "";
  const done = stories.filter((s) => s.completedAt).length;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="反思回顾"
        title="回望这次旅程"
        intro={
          done > 0
            ? `你已经完成了 ${done} 篇故事。挑一篇，写下这次写作里让你留下印象的部分。`
            : "写完一篇故事后，可以停下来看看：这一路走过什么、留下了什么、下次想再往哪里走。"
        }
      />
      <ReflectForm
        stories={stories}
        reflections={reflections}
        materials={materials}
        initialStoryId={initial}
      />
    </div>
  );
}
