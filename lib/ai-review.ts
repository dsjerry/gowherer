import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { generateText } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';

import { getAiProviderPreset } from '@/lib/ai-providers';
import { AiSettings, isAiConfigured } from '@/lib/ai-settings';
import { Locale } from '@/lib/i18n';
import { sumJourneyCosts } from '@/lib/journey-cost';
import { computeJourneyStats, formatDateTime } from '@/lib/journey-stats';
import { Journey } from '@/types/journey';

/** RN 的全局 fetch 不支持流式读取，统一走 expo/fetch（WinterCG 兼容实现） */
const modelFetch = expoFetch as unknown as typeof fetch;

function createAiModel(settings: AiSettings) {
  const provider = createOpenAICompatible({
    name: getAiProviderPreset(settings.providerId).id,
    baseURL: settings.baseUrl,
    apiKey: settings.apiKey || undefined,
    fetch: modelFetch,
  });
  return provider(settings.model);
}

const MAX_MATERIAL_ENTRIES = 200;
const MAX_MATERIAL_JOURNEYS = 300;

/** 把旅程压缩成给模型的结构化文本材料（媒体只计数，不传内容） */
export function buildJourneyMaterial(journey: Journey): string {
  const stats = computeJourneyStats(journey);
  const lines: string[] = [
    `title: ${journey.title}`,
    `kind: ${journey.kind}`,
    `status: ${journey.status}`,
    `startedAt: ${formatDateTime(journey.createdAt)}`,
    journey.endedAt ? `endedAt: ${formatDateTime(journey.endedAt)}` : '',
    `stats: entries=${journey.entries.length}, media=${journey.entries.reduce((sum, entry) => sum + entry.media.length, 0)}, trackPoints=${journey.trackLocations.length}, distanceKm=${stats.distanceKm != null ? stats.distanceKm.toFixed(2) : 'unknown'}, totalCostCNY=${sumJourneyCosts(journey)}`,
    'timeline:',
  ];

  journey.entries.slice(0, MAX_MATERIAL_ENTRIES).forEach((entry, index) => {
    const parts = [
      `${index + 1}. ${formatDateTime(entry.createdAt)}`,
      entry.location?.placeName ?? '',
      entry.text,
      entry.tags.length > 0 ? `tags=[${entry.tags.join(',')}]` : '',
      entry.cost ? `cost=${entry.cost.amount}CNY(${entry.cost.mode})` : '',
    ];
    lines.push(parts.filter(Boolean).join(' | '));
  });
  if (journey.entries.length > MAX_MATERIAL_ENTRIES) {
    lines.push(`...(${journey.entries.length - MAX_MATERIAL_ENTRIES} more entries omitted)`);
  }

  return lines.filter(Boolean).join('\n');
}

function buildAnalysisPrompt(journey: Journey, locale: Locale): string {
  const languageHint =
    locale === 'zh' ? '请用简体中文撰写分析结果。' : 'Write the analysis in English.';
  return [
    '你是一位专业的旅行与通勤记录分析助手。下面是一段旅程的完整时间线数据（记录文本、地点、标签、交通费与轨迹统计）。',
    '请基于数据生成一份详实的「旅程回顾分析」，要求：',
    '1. 结构：用简短小标题分段，至少覆盖——整体概览、行程节奏（各记录点之间的时间分布与停留）、路线与活动特点（地点、距离、速度）、花费观察（各交通方式的金额与占比）、值得记住的瞬间（引用 1-2 条具体记录原文）、实用建议（1-3 条，针对下次同类出行）。',
    '2. 深度：每个部分 2-4 句，全文不少于 300 字；分析要由数据推导得出，引用具体的时间、地点、数字作为依据，避免空泛形容。',
    '3. 忠实：只使用数据中出现的信息，不要编造；数据中缺失的维度直接跳过，不要硬凑。',
    languageHint,
    '',
    buildJourneyMaterial(journey),
  ].join('\n');
}

/** 全部旅程的压缩材料：整体统计 + 每条旅程一行摘要，避免提示词随记录数失控 */
export function buildJourneysMaterial(journeys: Journey[]): string {
  const totalCost = journeys.reduce((sum, journey) => sum + sumJourneyCosts(journey), 0);
  const totalEntries = journeys.reduce((sum, journey) => sum + journey.entries.length, 0);
  const lines: string[] = [
    `overview: journeys=${journeys.length}, entries=${totalEntries}, totalCostCNY=${Math.round(totalCost * 100) / 100}`,
    'journeys:',
  ];

  journeys.slice(0, MAX_MATERIAL_JOURNEYS).forEach((journey) => {
    const stats = computeJourneyStats(journey);
    const tagCounts = new Map<string, number>();
    journey.entries.forEach((entry) => {
      entry.tags.forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1));
    });
    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
    lines.push(
      `- ${journey.title} | ${journey.kind} | ${formatDateTime(journey.createdAt)}${
        journey.endedAt ? `~${formatDateTime(journey.endedAt)}` : ''
      } | entries=${journey.entries.length} | distanceKm=${
        stats.distanceKm != null ? stats.distanceKm.toFixed(1) : 'unknown'
      } | costCNY=${sumJourneyCosts(journey)}${topTags.length > 0 ? ` | tags=[${topTags.join(',')}]` : ''}`,
    );
  });
  if (journeys.length > MAX_MATERIAL_JOURNEYS) {
    lines.push(`...(${journeys.length - MAX_MATERIAL_JOURNEYS} more journeys omitted)`);
  }

  return lines.join('\n');
}

function buildInsightsPrompt(journeys: Journey[], locale: Locale): string {
  const languageHint =
    locale === 'zh' ? '请用简体中文撰写分析结果。' : 'Write the analysis in English.';
  return [
    '你是一位专业的旅行与通勤记录分析助手。下面是用户全部旅程记录的摘要数据（每条旅程一行：标题、类型、起止时间、记录数、里程、花费、高频标签）。',
    '请基于数据生成一份详实的「整体回顾分析」，要求：',
    '1. 结构：用简短小标题分段，至少覆盖——记录习惯与活跃度（频率、时段、变化趋势）、旅程类型偏好（旅行与通勤的比例与各自特点）、路线与活动特点（常去地点、典型距离）、花费观察（总额、单程水平、主要交通方式）、亮点旅程（点名 1-2 条并引用数据说明原因）、实用建议（1-3 条）。',
    '2. 深度：每个部分 2-4 句，全文不少于 400 字；先从数据中归纳出具体数字（如两类旅程的占比、平均每程花费、最活跃的时间段），再给出解读，避免空泛形容。',
    '3. 忠实：只使用数据中出现的信息，不要编造；数据不足的维度直接跳过，不要硬凑。',
    languageHint,
    '',
    buildJourneysMaterial(journeys),
  ].join('\n');
}

export type AiAnalysisResult = {
  content: string;
  model: string;
};

/** 调用配置好的模型分析旅程；返回结果由调用方持久化到 journey.aiReview */
export async function analyzeJourney(
  journey: Journey,
  settings: AiSettings,
  locale: Locale,
): Promise<AiAnalysisResult> {
  if (!isAiConfigured(settings)) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  const { text, finishReason, reasoning } = await generateText({
    model: createAiModel(settings),
    prompt: buildAnalysisPrompt(journey, locale),
    maxRetries: 1,
  });
  const content = text.trim();
  if (!content) {
    throw new Error(
      `AI_EMPTY_RESPONSE (finishReason=${finishReason}${reasoning ? ', reasoning-only' : ''})`,
    );
  }
  return { content, model: settings.model };
}

/** 拉取供应商可用模型列表（OpenAI 兼容协议 GET /models） */
export async function fetchAiModels(settings: AiSettings): Promise<string[]> {
  if (!settings.baseUrl) {
    throw new Error('AI_NOT_CONFIGURED');
  }
  const url = `${settings.baseUrl.replace(/\/+$/, '')}/models`;
  const headers: Record<string, string> = {};
  if (settings.apiKey) {
    headers.Authorization = `Bearer ${settings.apiKey}`;
  }
  const response = await modelFetch(url, { headers });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const payload = (await response.json()) as { data?: unknown };
  if (!Array.isArray(payload.data)) {
    throw new Error('AI_MODELS_INVALID_RESPONSE');
  }
  const ids = payload.data
    .map((item) => (item && typeof item === 'object' ? (item as { id?: unknown }).id : undefined))
    .filter((id): id is string => typeof id === 'string' && id.length > 0);
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

/** 调用配置好的模型分析全部旅程；返回结果由调用方存入分析列表 */
export async function analyzeAllJourneys(
  journeys: Journey[],
  settings: AiSettings,
  locale: Locale,
): Promise<AiAnalysisResult> {
  if (!isAiConfigured(settings)) {
    throw new Error('AI_NOT_CONFIGURED');
  }
  if (journeys.length === 0) {
    throw new Error('AI_NO_DATA');
  }

  const { text, finishReason, reasoning } = await generateText({
    model: createAiModel(settings),
    prompt: buildInsightsPrompt(journeys, locale),
    maxRetries: 1,
  });
  const content = text.trim();
  if (!content) {
    throw new Error(
      `AI_EMPTY_RESPONSE (finishReason=${finishReason}${reasoning ? ', reasoning-only' : ''})`,
    );
  }
  return { content, model: settings.model };
}

/** 设置页「测试连接」：发一个最小请求验证地址/密钥/模型可用 */
export async function testAiConnection(settings: AiSettings): Promise<void> {
  if (!isAiConfigured(settings)) {
    throw new Error('AI_NOT_CONFIGURED');
  }
  const { text } = await generateText({
    model: createAiModel(settings),
    prompt: 'Reply with the single word: OK',
    maxRetries: 0,
  });
  if (!text.trim()) {
    throw new Error('AI_EMPTY_RESPONSE');
  }
}
