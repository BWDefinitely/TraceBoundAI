"use client";

// 客户端数据上下文。整个应用的数据都在浏览器 IndexedDB（见 lib/client-store）。
// 这里在首次挂载时加载全部集合，并监听 `tracebound:changed` 事件（写操作后广播）
// 自动重载，替代原来服务端的 revalidatePath。
//
// 页面/组件通过 useData() 拿到最新数据，不再靠 server component 直接读文件。

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  listMaterials,
  listStories,
  listIdeaCards,
  listAlchemy,
  listReflections,
  listFirstThoughts,
  readMaterialBody,
  readStoryBody,
  getAiSettings,
} from "../../lib/client-store";
import { modelLabelOf } from "../../lib/ai";
import type {
  Story,
  AlchemyRecord,
  Reflection,
  IdeaCard,
  FirstThought,
} from "../../lib/store";
import type { MaterialWithBody } from "../../lib/types";
import type { AiSettings } from "../../lib/ai-settings";
import { DATA_CHANGED_EVENT } from "../_actions";

export interface StoryWithBody extends Story {
  body: string;
  preview: string;
}

interface DataState {
  ready: boolean;
  materials: MaterialWithBody[];
  stories: StoryWithBody[];
  ideas: IdeaCard[];
  alchemy: AlchemyRecord[];
  reflections: Reflection[];
  firstThoughts: FirstThought[];
  settings: AiSettings | null;
  providerLabel: string;
  reload: () => Promise<void>;
}

const Ctx = createContext<DataState | null>(null);

export function useData(): DataState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<DataState, "reload">>({
    ready: false,
    materials: [],
    stories: [],
    ideas: [],
    alchemy: [],
    reflections: [],
    firstThoughts: [],
    settings: null,
    providerLabel: "本地模拟 · 本地模拟",
  });

  const reload = useCallback(async () => {
    const [materials, stories, ideas, alchemy, reflections, firstThoughts, settings] =
      await Promise.all([
        listMaterials(),
        listStories(),
        listIdeaCards(),
        listAlchemy(),
        listReflections(),
        listFirstThoughts(),
        getAiSettings(),
      ]);
    const materialsWithBody = await Promise.all(
      materials.map(async (m) => ({ ...m, body: await readMaterialBody(m.id) }))
    );
    const storiesWithBody = await Promise.all(
      stories.map(async (s) => {
        const body = await readStoryBody(s.id);
        return { ...s, body, preview: body.slice(0, 140) };
      })
    );
    const providerLabel = `${settings.provider} · ${modelLabelOf(settings)}`;
    setState({
      ready: true,
      materials: materialsWithBody,
      stories: storiesWithBody,
      ideas,
      alchemy,
      reflections,
      firstThoughts,
      settings,
      providerLabel,
    });
  }, []);

  useEffect(() => {
    // 仅在客户端执行
    if (typeof window === 'undefined') return;
    
    reload().catch((err) => console.error("[data] initial load failed:", err));
    const handler = () => {
      reload().catch((err) => console.error("[data] reload failed:", err));
    };
    window.addEventListener(DATA_CHANGED_EVENT, handler);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, handler);
  }, [reload]);

  return <Ctx.Provider value={{ ...state, reload }}>{children}</Ctx.Provider>;
}
