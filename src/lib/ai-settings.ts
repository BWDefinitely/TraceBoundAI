// 纯类型定义。故意从 store.ts 抽出：
// SettingsDrawer 等 client 组件只需要这些类型，不能触碰 store.ts
// （store.ts 里的某些依赖会被 webpack 打包进客户端 bundle 报错）。

export type AiProvider = "mock" | "anthropic" | "openai-compat";

export interface AiSettings {
  provider: AiProvider;
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
  // 图片识别（Vision）
  vision: {
    provider: 'anthropic' | 'openai-compat' | 'custom' | 'mock';
    apiKey: string;
    model: string;
    baseUrl: string;
  };
  // 图片生成
  imageGeneration: {
    provider: 'dall-e-3' | 'custom' | 'mock';
    apiKey: string;
    model: string;
    baseUrl: string;
  };
}

export function defaultAiSettings(): AiSettings {
  return {
    provider: "mock",
    anthropic: {
      apiKey: "",
      model: "claude-3-5-sonnet-20241022",
      baseUrl: "https://api.anthropic.com",
    },
    openaiCompat: {
      apiKey: "",
      model: "gpt-4o",
      baseUrl: "https://api.openai.com/v1",
    },
    vision: {
      provider: "mock",
      apiKey: "",
      model: "gpt-4o",
      baseUrl: "https://api.openai.com/v1",
    },
    imageGeneration: {
      provider: "mock",
      apiKey: "",
      model: "dall-e-3",
      baseUrl: "https://api.openai.com/v1",
    },
  };
}
