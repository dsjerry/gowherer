import { JourneyKind } from '@/types/journey';
import { EntryTemplate, EntryTemplateConfig } from '@/types/template';
import { fetchTemplates, updateTemplateApi } from '@/lib/api-client';

const DEFAULT_ENTRY_TEMPLATE_CONFIG: EntryTemplateConfig = {
  travel: [
    { id: 'travel-departure', label: '出发', text: '出发，旅程正式开始。', tags: ['出发', '旅行'] },
    { id: 'travel-arrival', label: '到达', text: '顺利到达目的地，记录一下此刻。', tags: ['到达', '旅行'] },
    { id: 'travel-rest', label: '休息', text: '在这里休息片刻，整理接下来的计划。', tags: ['休息'] },
    { id: 'travel-checkin', label: '打卡', text: '旅途打卡，补充一个关键节点。', tags: ['打卡', '节点'] },
  ],
  commute: [
    { id: 'commute-departure', label: '出发', text: '出发，开始本次通勤。', tags: ['出发', '通勤'] },
    { id: 'commute-arrival', label: '到达', text: '到达目的地，本次通勤结束。', tags: ['到达', '通勤'] },
    { id: 'commute-rest', label: '休息', text: '中途短暂停留，补充状态。', tags: ['休息'] },
    { id: 'commute-checkin', label: '打卡', text: '完成一个通勤节点打卡。', tags: ['打卡', '节点'] },
  ],
};

export function getDefaultEntryTemplateConfig(): EntryTemplateConfig {
  return {
    travel: DEFAULT_ENTRY_TEMPLATE_CONFIG.travel.map((item) => ({ ...item, tags: [...item.tags] })),
    commute: DEFAULT_ENTRY_TEMPLATE_CONFIG.commute.map((item) => ({ ...item, tags: [...item.tags] })),
  };
}

export async function loadEntryTemplateConfig(): Promise<EntryTemplateConfig> {
  try {
    const data = await fetchTemplates();
    // Server returns grouped by locale, pick first available or default
    const firstLocale = Object.keys(data)[0];
    if (firstLocale && data[firstLocale]) {
      return data[firstLocale] as EntryTemplateConfig;
    }
    return getDefaultEntryTemplateConfig();
  } catch {
    return getDefaultEntryTemplateConfig();
  }
}

export async function saveEntryTemplateConfig(config: EntryTemplateConfig): Promise<void> {
  // Update each template via API
  for (const kind of ['travel', 'commute'] as JourneyKind[]) {
    const templates = config[kind];
    if (!templates) continue;
    for (const t of templates) {
      try {
        await updateTemplateApi(t.id, { label: t.label, text: t.text, tags: t.tags });
      } catch {
        // Ignore individual update failures
      }
    }
  }
}
