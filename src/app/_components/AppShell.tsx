"use client";

import { createContext, useCallback, useContext, useEffect, useState, useMemo } from "react";
import type { ReactNode } from "react";
import type { AlchemyRecord, FirstThought, Material, MaterialWithBody } from "../../lib/types";
import { Sidebar } from "./Sidebar";
import { MaterialsDrawer } from "./MaterialsDrawer";
import { AlchemyDrawer } from "./AlchemyDrawer";
import { SettingsDrawer } from "./SettingsDrawer";

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
  materials: MaterialWithBody[];
  alchemyHistory: AlchemyRecord[];
  firstThoughts: FirstThought[];
  providerLabel: string;
}

export function AppShell({ children, materials, alchemyHistory, firstThoughts, providerLabel }: Props) {
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
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">{children}</main>
      </div>

      <MaterialsDrawer
        open={open === "materials"}
        onClose={close}
        materials={materials}
        firstThoughts={firstThoughts}
        handoff={handoff}
      />
      <AlchemyDrawer
        open={open === "alchemy"}
        onClose={close}
        materials={materials as Material[]}
        history={alchemyHistory}
        providerLabel={providerLabel}
        handoff={handoff}
      />
      <SettingsDrawer open={open === "settings"} onClose={close} />
    </Ctx.Provider>
  );
}
