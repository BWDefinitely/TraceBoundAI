"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator } from "../../_components/StepIndicator";
import { useData } from "../../_components/DataProvider";
import { createStory } from "../../../lib/client-store";
import { emptyMetadata, emptyStructure } from "../../../lib/store";
import type { StoryMetadata, MaterialKind } from "../../../lib/store";
import { createMaterialAction } from "../../_actions";
import { DATA_CHANGED_EVENT } from "../../_actions";

export default function Step2Page() {
  const router = useRouter();
  const { materials } = useData();
  const [metadata, setMetadata] = useState<StoryMetadata>(emptyMetadata());
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState("");
  const [storyTitle, setStoryTitle] = useState("");

  // 素材选择器：时间 / 地点 / 人物 / 物品 都从同一个弹窗里添加素材
  const [pickerKind, setPickerKind] = useState<MaterialKind | null>(null);

  useEffect(() => {
    // 从 sessionStorage 获取 userId 和标题
    const storedUserId = sessionStorage.getItem("newStoryUserId");
    const storedTitle = sessionStorage.getItem("newStoryTitle");
    if (storedUserId) setUserId(storedUserId);
    if (storedTitle) setStoryTitle(storedTitle);
  }, []);

  // 从素材选择器选中（或新建）一条素材后，写回对应元数据字段
  function handlePickMaterial(kind: MaterialKind, title: string) {
    if (kind === "时间") setMetadata({ ...metadata, time: title });
    else if (kind === "地点") setMetadata({ ...metadata, place: title });
    else if (kind === "人物") addPerson(title);
    // 物品：只入库，没有对应元数据字段，无需写回
  }

  async function handleNext() {
    // 取消必填限制，允许全部为空
    setSaving(true);
    try {
      const story = await createStory({
        userId: userId,
        title: storyTitle || "新故事", // 标题留空时默认「新故事」
        metadata,
        structure: emptyStructure(),
      });
      
      // 触发数据刷新事件，让 DataProvider 重新加载
      window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT));
      
      // 将 story.id 存入 sessionStorage，供后续步骤使用
      sessionStorage.setItem("currentStoryId", story.id);
      
      // 等待一小段时间确保 DataProvider 完成重载
      await new Promise(resolve => setTimeout(resolve, 100));
      
      router.push("/create/step3");
    } catch (err) {
      console.error("Failed to create story:", err);
      alert("创建失败，请重试");
      setSaving(false);
    }
  }

  function addPerson(personName: string) {
    if (personName.trim() && !metadata.people.includes(personName.trim())) {
      setMetadata({ ...metadata, people: [...metadata.people, personName.trim()] });
    }
  }

  function removePerson(index: number) {
    setMetadata({ ...metadata, people: metadata.people.filter((_: string, i: number) => i !== index) });
  }

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: "0 auto" }}>
      <StepIndicator currentStep={2} totalSteps={5} />
      
      <header style={{ marginBottom: "var(--space-6)", textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>步骤 2：填写故事元数据</h1>
        <p className="muted" style={{ fontSize: "0.95rem", lineHeight: 1.7 }}>
          描述故事的时间、地点、人物、事件。这将成为故事的骨架。
        </p>
        {userId && storyTitle && (
          <div style={{ marginTop: "var(--space-3)", fontSize: "0.9rem", color: "var(--accent)" }}>
            当前用户：<strong>{userId}</strong> · 故事：<strong>{storyTitle}</strong>
          </div>
        )}
      </header>

      <div className="card" style={{ padding: "var(--space-6)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {/* 时间 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "1.2rem" }}>📅</span>
              <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>时间</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPickerKind("时间")}
                style={{ fontSize: "0.78rem", padding: "4px 12px", marginLeft: "var(--space-1)" }}
              >
                ➕ 添加时间素材
              </button>
            </div>
            <input
              type="text"
              value={metadata.time}
              onChange={(e) => setMetadata({ ...metadata, time: e.target.value })}
              placeholder="例如：2024年春天、某个下雨的下午..."
              style={{ fontSize: "0.95rem" }}
            />
          </label>

          {/* 地点 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "1.2rem" }}>📍</span>
              <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>地点</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPickerKind("地点")}
                style={{ fontSize: "0.78rem", padding: "4px 12px", marginLeft: "var(--space-1)" }}
              >
                ➕ 添加地点素材
              </button>
            </div>
            <input
              type="text"
              value={metadata.place}
              onChange={(e) => setMetadata({ ...metadata, place: e.target.value })}
              placeholder="例如：公园、学校、神秘的森林..."
              style={{ fontSize: "0.95rem" }}
            />
          </label>

          {/* 人物 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "1.2rem" }}>👤</span>
              <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>人物</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPickerKind("人物")}
                style={{ fontSize: "0.78rem", padding: "4px 12px", marginLeft: "var(--space-1)" }}
              >
                ➕ 添加人物素材
              </button>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)", alignItems: "center" }}>
              {metadata.people.map((person: string, index: number) => (
                <span
                  key={index}
                  className="tag"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-2)",
                    paddingRight: "var(--space-2)",
                  }}
                >
                  {person}
                  <button
                    type="button"
                    onClick={() => removePerson(index)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--ink-soft)",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: "1.1rem",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
              {metadata.people.length === 0 && (
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  还没有人物，点上方按钮添加
                </span>
              )}
            </div>
          </div>

          {/* 物品 */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "1.2rem" }}>🎒</span>
              <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>物品</span>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPickerKind("物品")}
                style={{ fontSize: "0.78rem", padding: "4px 12px", marginLeft: "var(--space-1)" }}
              >
                ➕ 添加物品素材
              </button>
            </div>
            <p className="muted" style={{ fontSize: "0.8rem", margin: 0 }}>
              可以把故事里重要的物品写成素材存进素材库，之后在步骤 3 中拖入场景。
            </p>
          </div>

          {/* 事件 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "1.2rem" }}>⚡</span>
              <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>事件</span>
            </div>
            <textarea
              value={metadata.event}
              onChange={(e) => setMetadata({ ...metadata, event: e.target.value })}
              placeholder="例如：发现了一个秘密、遇到了一个神秘人..."
              style={{ minHeight: 100, resize: "vertical", fontSize: "0.95rem" }}
            />
          </label>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "var(--space-6)" }}>
        <button onClick={() => router.push("/create/step1")} className="btn-secondary">
          ← 上一步
        </button>
        <button onClick={handleNext} className="btn-primary" disabled={saving}>
          {saving ? "创建中..." : "下一步：素材炼金 →"}
        </button>
      </div>

      {/* 素材选择器：从素材库选择，或直接写文字新建该类型素材 */}
      {pickerKind && (
        <MaterialKindPicker
          kind={pickerKind}
          userId={userId}
          materials={materials}
          onPick={(title) => {
            handlePickMaterial(pickerKind, title);
            setPickerKind(null);
          }}
          onClose={() => setPickerKind(null)}
        />
      )}
    </div>
  );
}

// 素材选择器：展示素材库中某类型的素材，点选即用；也可直接写文字新建该类型素材
function MaterialKindPicker({
  kind,
  userId,
  materials,
  onPick,
  onClose,
}: {
  kind: MaterialKind;
  userId: string;
  materials: { id: string; title: string; kind: MaterialKind }[];
  onPick: (title: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  const kindMaterials = materials.filter((m) => m.kind === kind);

  async function handleCreate() {
    const content = text.trim();
    if (!content || adding) return;
    if (!userId) {
      alert("未找到用户ID，请先回到首页填写故事信息");
      return;
    }
    setAdding(true);
    try {
      const res = await createMaterialAction({
        userId,
        title: content,
        kind,
        tags: "",
        iNoticed: content,
        mediaKind: "text",
      });
      if (res.ok) {
        onPick(content);
      } else {
        alert(res.message);
      }
    } catch (err) {
      console.error("添加素材失败:", err);
      alert("添加失败，请重试");
    } finally {
      setAdding(false);
    }
  }

  return (
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
        zIndex: 1100,
        padding: "var(--space-4)",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: 480,
          width: "100%",
          maxHeight: "85vh",
          overflowY: "auto",
          padding: "var(--space-5)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-4)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ fontSize: "1.2rem", margin: 0, marginBottom: "var(--space-1)" }}>
              {kind === "时间" ? "📅 添加时间素材" :
               kind === "地点" ? "📍 添加地点素材" :
               kind === "人物" ? "👤 添加人物素材" :
               "🎒 添加物品素材"}
            </h3>
            <span className="muted" style={{ fontSize: "0.8rem" }}>
              选择已有素材，或直接写一段话新建素材
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              fontSize: "1.4rem",
              cursor: "pointer",
              color: "var(--ink-soft)",
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* 已有素材列表 */}
        {kindMaterials.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>从素材库选择</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", maxHeight: 240, overflowY: "auto" }}>
              {kindMaterials.map((mat) => (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => onPick(mat.title)}
                  className="btn-ghost"
                  style={{ justifyContent: "flex-start", textAlign: "left", fontSize: "0.9rem" }}
                >
                  {mat.title}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
            素材库里还没有{kind}素材，可以在下方直接写一段话新建。
          </p>
        )}

        {/* 新建素材 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", borderTop: "1px dashed var(--line)", paddingTop: "var(--space-3)" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>直接写文字新建{kind}素材</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              kind === "时间" ? "例如：某个下雨的下午" :
              kind === "地点" ? "例如：小区后门的旧车棚" :
              kind === "人物" ? "例如：会讲故事的邻居爷爷" :
              "例如：奶奶织了一半的红围巾"
            }
            style={{ minHeight: 70, resize: "vertical", fontSize: "0.9rem" }}
          />
          <button onClick={handleCreate} className="btn-primary" disabled={adding || !text.trim()}>
            {adding ? "保存中..." : "✓ 保存为新素材"}
          </button>
        </div>
      </div>
    </div>
  );
}
