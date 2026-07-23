"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  createStoryAction,
  deleteStoryAction,
  reopenStoryAction,
} from "../_actions";

export function NewStoryButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      className="btn-primary"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const res = await createStoryAction("新故事");
          router.push(`/write/${res.id}`);
        })
      }
    >
      {pending ? "创建中…" : "＋ 开一个新故事"}
    </button>
  );
}

export function DeleteStoryButton({ id, title }: { id: string; title: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn-ghost"
      style={{ color: "var(--danger)" }}
      disabled={pending}
      onClick={() => {
        if (!confirm(`确定删除「${title}」？此操作不可撤销。`)) return;
        startTransition(async () => {
          await deleteStoryAction(id);
        });
      }}
    >
      删除
    </button>
  );
}

export function ReopenStoryButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="btn-ghost"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await reopenStoryAction(id);
        })
      }
    >
      重新打开
    </button>
  );
}
