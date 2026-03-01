import AsyncStorage from '@react-native-async-storage/async-storage';

import { JourneyKind } from '@/types/journey';
import { EntryTemplate, EntryTemplateConfig } from '@/types/template';

const ENTRY_TEMPLATE_STORAGE_KEY = 'gowherer:entry-templates:v1';

const DEFAULT_ENTRY_TEMPLATE_CONFIG: EntryTemplateConfig = {
  travel: [
    {
      id: 'travel-departure',
      label: '出发',
      text: '出发，旅程正式开始。',
      tags: ['出发', '旅行'],
    },
    {
      id: 'travel-arrival',
      label: '到达',
      text: '顺利到达目的地，记录一下此刻。',
      tags: ['到达', '旅行'],
    },
    {
      id: 'travel-rest',
      label: '休息',
      text: '在这里休息片刻，整理接下来的计划。',
      tags: ['休息'],
    },
    {
      id: 'travel-checkin',
      label: '打卡',
      text: '旅途打卡，补充一个关键节点。',
      tags: ['打卡', '节点'],
    },
  ],
  commute: [
    {
      id: 'commute-departure',
      label: '出发',
      text: '出发，开始本次通勤。',
      tags: ['出发', '通勤'],
    },
    {
      id: 'commute-arrival',
      label: '到达',
      text: '到达目的地，本次通勤结束。',
      tags: ['到达', '通勤'],
    },
    {
      id: 'commute-rest',
      label: '休息',
      text: '中途短暂停留，补充状态。',
      tags: ['休息'],
    },
    {
      id: 'commute-checkin',
      label: '打卡',
      text: '完成一个通勤节点打卡。',
      tags: ['打卡', '节点'],
    },
  ],
};

function normalizeTemplateItem(item: unknown): EntryTemplate | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const maybeTemplate = item as {
    id?: unknown;
    label?: unknown;
    text?: unknown;
    tags?: unknown;
  };

  if (
    typeof maybeTemplate.id !== 'string' ||
    typeof maybeTemplate.label !== 'string' ||
    typeof maybeTemplate.text !== 'string'
  ) {
    return null;
  }

  const tags = Array.isArray(maybeTemplate.tags)
    ? Array.from(
        new Set(
          maybeTemplate.tags
            .filter((tag): tag is string => typeof tag === 'string')
            .map((tag) => tag.trim())
            .filter(Boolean)
        )
      )
    : [];

  return {
    id: maybeTemplate.id,
    label: maybeTemplate.label.trim(),
    text: maybeTemplate.text.trim(),
    tags,
  };
}

function normalizeTemplateList(raw: unknown, kind: JourneyKind): EntryTemplate[] {
  if (!Array.isArray(raw)) {
    return DEFAULT_ENTRY_TEMPLATE_CONFIG[kind];
  }

  const normalized = raw
    .map((item) => normalizeTemplateItem(item))
    .filter((item): item is EntryTemplate => Boolean(item));

  if (normalized.length === 0) {
    return DEFAULT_ENTRY_TEMPLATE_CONFIG[kind];
  }

  return normalized;
}

function normalizeTemplateConfig(raw: unknown): EntryTemplateConfig {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_ENTRY_TEMPLATE_CONFIG;
  }

  const maybeConfig = raw as Partial<Record<JourneyKind, unknown>>;

  return {
    travel: normalizeTemplateList(maybeConfig.travel, 'travel'),
    commute: normalizeTemplateList(maybeConfig.commute, 'commute'),
  };
}

export function getDefaultEntryTemplateConfig(): EntryTemplateConfig {
  return {
    travel: DEFAULT_ENTRY_TEMPLATE_CONFIG.travel.map((item) => ({ ...item, tags: [...item.tags] })),
    commute: DEFAULT_ENTRY_TEMPLATE_CONFIG.commute.map((item) => ({ ...item, tags: [...item.tags] })),
  };
}

export async function loadEntryTemplateConfig(): Promise<EntryTemplateConfig> {
  const raw = await AsyncStorage.getItem(ENTRY_TEMPLATE_STORAGE_KEY);
  if (!raw) {
    return getDefaultEntryTemplateConfig();
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeTemplateConfig(parsed);
  } catch {
    return getDefaultEntryTemplateConfig();
  }
}

export async function saveEntryTemplateConfig(config: EntryTemplateConfig): Promise<void> {
  await AsyncStorage.setItem(ENTRY_TEMPLATE_STORAGE_KEY, JSON.stringify(config));
}
