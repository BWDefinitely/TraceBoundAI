"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { StepIndicator } from "../../_components/StepIndicator";
import { useData } from "../../_components/DataProvider";
import { createStory } from "../../../lib/client-store";
import { emptyMetadata, emptyStructure } from "../../../lib/store";
import type { StoryMetadata } from "../../../lib/store";
import { DATA_CHANGED_EVENT } from "../../_actions";

export default function Step2Page() {
  const router = useRouter();
  const { materials } = useData();
  const [metadata, setMetadata] = useState<StoryMetadata>(emptyMetadata());
  const [saving, setSaving] = useState(false);
  const [showPersonPicker, setShowPersonPicker] = useState(false);

  // 筛选人物素材
  const personMaterials = materials.filter((m) => m.kind === "人物");

  async function handleNext() {
    // 取消必填限制，允许全部为空
    setSaving(true);
    try {
      const story = await createStory({
        title: metadata.event || metadata.place || "新故事",
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
    setShowPersonPicker(false);
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
      </header>

      <div className="card" style={{ padding: "var(--space-6)" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          {/* 时间 */}
          <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
              <span style={{ fontSize: "1.2rem" }}>📅</span>
              <span style={{ fontSize: "0.95rem", fontWeight: 600 }}>时间</span>
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
              <button
                type="button"
                onClick={() => setShowPersonPicker(true)}
                className="btn-secondary"
                style={{ fontSize: "0.85rem" }}
              >
                + 添加人物
              </button>
            </div>

            {/* 人物选择器 */}
            {showPersonPicker && (
              <div className="card" style={{ marginTop: "var(--space-3)", padding: "var(--space-4)" }}>
                <h4 style={{ marginBottom: "var(--space-3)", fontSize: "0.9rem" }}>从素材库选择人物</h4>
                {personMaterials.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", marginBottom: "var(--space-3)" }}>
                    {personMaterials.map((mat) => (
                      <button
                        key={mat.id}
                        onClick={() => addPerson(mat.title)}
                        className="btn-ghost"
                        style={{ justifyContent: "flex-start", textAlign: "left" }}
                      >
                        👤 {mat.title}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "var(--space-3)" }}>
                    素材库中还没有人物素材，请先去素材库添加。
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setShowPersonPicker(false)}
                  className="btn-secondary"
                  style={{ fontSize: "0.85rem" }}
                >
                  取消
                </button>
              </div>
            )}
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
    </div>
  );
}
