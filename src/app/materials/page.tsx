"use client";

import { useState } from "react";
import { useData } from "../_components/DataProvider";
import { createMaterialAction, deleteMaterialAction, updateMaterialAction } from "../_actions";
import { getMediaBlob } from "../../lib/client-store";
import type { MaterialKind } from "../../lib/store";

const KINDS: MaterialKind[] = ["观察", "感受", "想法", "对话", "人物"];

export default function MaterialsPage() {
  const { materials } = useData();
  const [mode, setMode] = useState<"list" | "add">("list");
  const [filter, setFilter] = useState<MaterialKind | "all">("all");

  return (
    <div className="fade-in">
      <header style={{ marginBottom: "var(--space-6)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>素材库</h1>
          <p className="muted">查看和管理所有素材，支持添加图片、文字、音频。</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setMode(mode === "list" ? "add" : "list")}
        >
          {mode === "list" ? "+ 添加素材" : "← 返回列表"}
        </button>
      </header>

      {mode === "add" ? (
        <AddMaterialForm onSuccess={() => setMode("list")} />
      ) : (
        <>
          {/* 筛选器 */}
          <div style={{ marginBottom: "var(--space-5)", display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            <button
              onClick={() => setFilter("all")}
              style={{
                padding: "8px 16px",
                background: filter === "all" ? "var(--accent)" : "var(--surface)",
                color: filter === "all" ? "white" : "var(--ink)",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius)",
                cursor: "pointer",
              }}
            >
              全部 ({materials.length})
            </button>
            {KINDS.map((kind) => {
              const count = materials.filter((m) => m.kind === kind).length;
              return (
                <button
                  key={kind}
                  onClick={() => setFilter(kind)}
                  style={{
                    padding: "8px 16px",
                    background: filter === kind ? "var(--accent)" : "var(--surface)",
                    color: filter === kind ? "white" : "var(--ink)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius)",
                    cursor: "pointer",
                  }}
                >
                  {kind} ({count})
                </button>
              );
            })}
          </div>

          {/* 素材列表 */}
          <MaterialsList materials={materials} filter={filter} />
        </>
      )}
    </div>
  );
}

function AddMaterialForm({ onSuccess }: { onSuccess: () => void }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<MaterialKind>("观察");
  const [iNoticed, setINoticed] = useState("");
  const [itRemindsMe, setItRemindsMe] = useState("");
  const [mediaKind, setMediaKind] = useState<"text" | "photo" | "audio">("text");
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      alert("请填写标题");
      return;
    }

    setSaving(true);
    try {
      await createMaterialAction({
        title,
        kind,
        tags: "",
        iNoticed,
        itRemindsMe,
        stillUnsure: "",
        aiAllowed: true,
        mediaKind,
        media: mediaFile || undefined,
      });
      onSuccess();
    } catch (err) {
      alert("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card" style={{ maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
        {/* 标题 */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontWeight: 600 }}>标题 *</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="给素材起个名字"
            required
          />
        </label>

        {/* 类型 */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontWeight: 600 }}>类型</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as MaterialKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>

        {/* 媒体类型 */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontWeight: 600 }}>媒体类型</span>
          <select value={mediaKind} onChange={(e) => setMediaKind(e.target.value as "text" | "photo" | "audio")}>
            <option value="text">文字</option>
            <option value="photo">图片</option>
            <option value="audio">音频</option>
          </select>
        </label>

        {/* 文件上传 */}
        {mediaKind !== "text" && (
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontWeight: 600 }}>上传{mediaKind === "photo" ? "图片" : "音频"}</span>
            <input
              type="file"
              accept={mediaKind === "photo" ? "image/*" : "audio/*"}
              onChange={(e) => setMediaFile(e.target.files?.[0] || null)}
            />
          </label>
        )}

        {/* 三问 */}
        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontWeight: 600 }}>我注意到</span>
          <textarea
            value={iNoticed}
            onChange={(e) => setINoticed(e.target.value)}
            placeholder="你注意到了什么？"
            style={{ minHeight: 80, resize: "vertical" }}
          />
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span style={{ fontWeight: 600 }}>它让我想到</span>
          <textarea
            value={itRemindsMe}
            onChange={(e) => setItRemindsMe(e.target.value)}
            placeholder="这让你联想到什么？"
            style={{ minHeight: 80, resize: "vertical" }}
          />
        </label>

        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? "保存中..." : "保存素材"}
        </button>
      </div>
    </form>
  );
}

function MaterialsList({ materials, filter }: { materials: any[]; filter: MaterialKind | "all" }) {
  const filtered = filter === "all" ? materials : materials.filter((m) => m.kind === filter);

  if (filtered.length === 0) {
    return (
      <div className="card" style={{ padding: "var(--space-6)", textAlign: "center" }}>
        <p className="muted">还没有{filter === "all" ? "" : filter}素材</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
      {filtered.map((m) => (
        <MaterialCard key={m.id} material={m} />
      ))}
    </div>
  );
}

function MaterialCard({ material }: { material: any }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // 加载图片
  useState(() => {
    if (material.mediaKind === "photo") {
      getMediaBlob(material.id).then((blob) => {
        if (blob) setImageUrl(URL.createObjectURL(blob));
      });
    }
  });

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {/* 头部 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <span className="tag">{material.kind}</span>
        <span style={{ fontSize: "0.75rem", color: "var(--ink-soft)" }}>
          {new Date(material.createdAt).toLocaleDateString("zh-CN")}
        </span>
      </div>

      {/* 图片预览 */}
      {imageUrl && (
        <div style={{ width: "100%", height: 180, borderRadius: "var(--radius)", overflow: "hidden", background: "var(--surface)" }}>
          <img src={imageUrl} alt={material.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      {/* 标题 */}
      <h3 style={{ fontSize: "1.05rem", fontWeight: 600, margin: 0 }}>{material.title}</h3>

      {/* 三问摘要 */}
      {material.iNoticed && (
        <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", margin: 0, lineHeight: 1.5 }}>
          💭 {material.iNoticed.slice(0, 60)}{material.iNoticed.length > 60 ? "..." : ""}
        </p>
      )}
    </div>
  );
}
