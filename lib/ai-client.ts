import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { fetch as expoFetch } from 'expo/fetch';

import { getAiProviderPreset } from '@/lib/ai-providers';
import { AiSettings } from '@/lib/ai-settings';

/** RN 的全局 fetch 不支持流式读取，统一走 expo/fetch（WinterCG 兼容实现） */
export const modelFetch = expoFetch as unknown as typeof fetch;

/** 用用户自带（BYOK）的供应商配置创建模型实例 */
export function createAiModel(settings: AiSettings) {
  const provider = createOpenAICompatible({
    name: getAiProviderPreset(settings.providerId).id,
    baseURL: settings.baseUrl,
    apiKey: settings.apiKey || undefined,
    fetch: modelFetch,
  });
  return provider(settings.model);
}
