"use client";

import { createContext, useCallback, useContext, useState, useMemo, useEffect } from "react";
import type { ReactNode } from "react";
import type { Material } from "../../lib/types";
import { MaterialsDrawer } from "./MaterialsDrawer";
import { AlchemyDrawer } from "./AlchemyDrawer";
import { SettingsDrawer } from "./SettingsDrawer";
import { useData } from "./DataProvider";

export type DrawerKind = "materials" | "alchemy" | "settings" | null;

interface DrawerCtx {
  open: DrawerKind;
  openDrawer: (k: Exclude<DrawerKind, null>) => void;
  close: () => void;
  // 当在故事编辑器里打开抽屉时，注册回调，抽屉里可以把素材或炼金结果发回编辑器
  handoff: HandoffTarget | null;
  registerHandoff: (t: HandoffTarget | null) => void;
}

export interface HandoffTarget {
  // 素材抽屉“加到故事”按钮 → 传素材 id
  onAttachMaterial?: (materialId: string) => void;
  // 炼金抽屉“作为灵感放进正文”按钮 → 传结果文本
  onInsertAlchemy?: (text: string) => void;
  label?: string; // 可选，显示“送回 XX 故事”提示
}

const Ctx = createContext<DrawerCtx | null>(null);

export function useDrawers(): DrawerCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useDrawers must be used inside <AppShell>");
  return ctx;
}

interface Props {
  children: ReactNode;
}

export function AppShell({ children }: Props) {
  const { materials, alchemy: alchemyHistory, firstThoughts, providerLabel } = useData();
  const [open, setOpen] = useState<DrawerKind>(null);
  const [handoff, setHandoff] = useState<HandoffTarget | null>(null);

  const openDrawer = useCallback((k: Exclude<DrawerKind, null>) => setOpen(k), []);
  const close = useCallback(() => setOpen(null), []);
  const registerHandoff = useCallback((t: HandoffTarget | null) => setHandoff(t), []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const value: DrawerCtx = useMemo(
    () => ({ open, openDrawer, close, handoff, registerHandoff }),
    [open, openDrawer, close, handoff, registerHandoff]
  );

  return (
    <Ctx.Provider value={value}>
      <div style={{ minHeight: "100vh", background: "var(--sky)", display: "flex", flexDirection: "column" }}>
        {/* 顶部导航栏 */}
        <header
          style={{
            background: "white",
            borderBottom: "1px solid var(--line)",
            padding: "var(--space-4) var(--space-6)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <a href="/" style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
            Trace-Bound
          </a>
          <button
            onClick={() => openDrawer("settings")}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            ⚙️ 设置
          </button>
        </header>

        {/* 主内容区 */}
        <main style={{ flex: 1, padding: "var(--space-6)", maxWidth: 1400, margin: "0 auto", width: "100%" }}>
          {children}
        </main>

        {/* 抽屉 */}
        {open === "materials" && (
          <MaterialsDrawer
            open={true}
            onClose={close}
            materials={materials}
            firstThoughts={firstThoughts}
            handoff={handoff}
          />
        )}
        {open === "alchemy" && (
          <AlchemyDrawer
            open={true}
            onClose={close}
            materials={materials as Material[]}
            history={alchemyHistory}
            providerLabel={providerLabel}
            handoff={handoff}
          />
        )}
        {open === "settings" && <SettingsDrawer open={true} onClose={close} />}
      </div>
    </Ctx.Provider>
  );
}
