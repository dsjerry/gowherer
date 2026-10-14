import AsyncStorage from '@react-native-async-storage/async-storage';

import { AI_INSIGHTS_KEY } from '@/lib/storage-keys';

/** 一次「全部旅程 AI 分析」的结果，回顾页以列表形式展示 */
export type AiInsight = {
  id: string;
  content: string;
  model: string;
  createdAt: string;
  journeyCount: number;
};

function sortByNewest(insights: AiInsight[]) {
  return [...insights].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function isInsight(value: unknown): value is AiInsight {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const item = value as Partial<AiInsight>;
  return (
    typeof item.id === 'string' &&
    typeof item.content === 'string' &&
    typeof item.model === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.journeyCount === 'number'
  );
}

/** 读取分析列表，默认按时间降序 */
export async function loadAiInsights(): Promise<AiInsight[]> {
  try {
    const raw = await AsyncStorage.getItem(AI_INSIGHTS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return sortByNewest(parsed.filter((item): item is AiInsight => isInsight(item)));
  } catch {
    return [];
  }
}

/** 追加一条分析结果（自动生成 id 与时间），返回带完整字段的记录 */
export async function addAiInsight(input: {
  content: string;
  model: string;
  journeyCount: number;
}): Promise<AiInsight> {
  const insight: AiInsight = {
    id: `insight-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  const current = await loadAiInsights();
  await AsyncStorage.setItem(AI_INSIGHTS_KEY, JSON.stringify([insight, ...current]));
  return insight;
}
