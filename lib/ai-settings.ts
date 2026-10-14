import AsyncStorage from '@react-native-async-storage/async-storage';

import { getAiProviderPreset } from '@/lib/ai-providers';
import { AI_SETTINGS_KEY } from '@/lib/storage-keys';

export type AiSettings = {
  providerId: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export function getDefaultAiSettings(): AiSettings {
  const preset = getAiProviderPreset('deepseek');
  return {
    providerId: preset.id,
    baseUrl: preset.baseUrl,
    apiKey: '',
    model: preset.models[0] ?? '',
  };
}

export function isAiConfigured(settings: AiSettings): boolean {
  const preset = getAiProviderPreset(settings.providerId);
  return Boolean(settings.baseUrl && settings.model && (!preset.requiresApiKey || settings.apiKey));
}

export async function loadAiSettings(): Promise<AiSettings> {
  const defaults = getDefaultAiSettings();
  try {
    const raw = await AsyncStorage.getItem(AI_SETTINGS_KEY);
    if (!raw) {
      return defaults;
    }
    const parsed = JSON.parse(raw) as Partial<AiSettings>;
    return {
      providerId: typeof parsed.providerId === 'string' ? parsed.providerId : defaults.providerId,
      baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl.trim() : defaults.baseUrl,
      apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey.trim() : '',
      model: typeof parsed.model === 'string' ? parsed.model.trim() : defaults.model,
    };
  } catch {
    return defaults;
  }
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await AsyncStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(settings));
}
