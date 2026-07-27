// 纯类型定义。故意从 store.ts 抽出：
// SettingsDrawer 等 client 组件只需要这些类型，不能触碰 store.ts
// （store.ts 里的 node:crypto / node:fs 会被 webpack 打包进客户端 bundle 报错）。

export type AiProvider = "mock" | "anthropic" | "openai-compat";

// 设计文档 §"两个实验条件"：
//   trace-bound —— AI 可读取儿童授权的 traces / 现场解释 / pre-AI ideas / Idea Cards / 故事结构与正文。
//   topic-based —— AI 不能读取原始照片/声音/视频/现场语音，只能读统一任务 + 当前 Idea Card + Story Shelf + 正文。
// 唯一核心差异：AI 是否可以直接访问并引用儿童的多模态痕迹及其来源。
export type ExperimentCondition = "trace-bound" | "topic-based";

export interface AiSettings {
  provider: AiProvider;
  condition: ExperimentCondition;
  anthropic: {
    apiKey: string;
    model: string;
    baseUrl: string;
  };
  openaiCompat: {
    apiKey: string;
    model: string;
    baseUrl: string;
  };
}
