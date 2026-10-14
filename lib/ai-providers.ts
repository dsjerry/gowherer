export type AiProviderPreset = {
  id: string;
  /** 供应商标识，作为 openai-compatible 的 name 参与请求排错，不翻译 */
  label: string;
  baseUrl: string;
  /** 快选模型列表，用户可自行输入其他模型 id */
  models: string[];
  /** 本地服务（如 Ollama）无需 API key */
  requiresApiKey: boolean;
  /** API Key 输入框占位符（不同供应商 key 格式不同，如 sk-/tp-） */
  apiKeyPlaceholder?: string;
};

/** 全部走 OpenAI 兼容协议，一个连接器覆盖所有供应商 */
export const AI_PROVIDER_PRESETS: AiProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o-mini', 'gpt-4o'],
    requiresApiKey: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
    requiresApiKey: true,
  },
  {
    id: 'moonshot',
    label: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['moonshot-v1-8k', 'kimi-k2-0905-preview'],
    requiresApiKey: true,
  },
  {
    id: 'zhipu',
    label: 'Zhipu GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: ['glm-4-flash', 'glm-4-plus'],
    requiresApiKey: true,
  },
  {
    id: 'qwen',
    label: 'Qwen 通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    models: ['qwen-plus', 'qwen-turbo'],
    requiresApiKey: true,
  },
  {
    id: 'xiaomi',
    label: '小米 MiMo',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    models: ['mimo-v2.6-pro', 'mimo-v2.6-flash'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'sk-...',
  },
  {
    id: 'xiaomi-token-plan',
    label: '小米 Token Plan',
    baseUrl: 'https://token-plan-cn.xiaomimimo.com/v1',
    models: ['mimo-v2.6-pro', 'mimo-v2.6-flash'],
    requiresApiKey: true,
    apiKeyPlaceholder: 'tp-...',
  },
  {
    id: 'ollama',
    label: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    models: ['llama3.1', 'qwen2.5'],
    requiresApiKey: false,
  },
  {
    id: 'custom',
    label: 'OpenAI 兼容',
    baseUrl: '',
    models: [],
    requiresApiKey: true,
  },
];

export function getAiProviderPreset(id: string): AiProviderPreset {
  return AI_PROVIDER_PRESETS.find((preset) => preset.id === id) ?? AI_PROVIDER_PRESETS[0];
}
