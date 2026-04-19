import AsyncStorage from '@react-native-async-storage/async-storage';

import { Locale, getTemplateDefaults } from '@/lib/i18n';
import { JourneyKind } from '@/types/journey';
import { EntryTemplate, EntryTemplateConfig } from '@/types/template';

const ENTRY_TEMPLATE_STORAGE_KEY = 'gowherer:entry-templates:v1';

function getStorageKey(locale: Locale) {
  return `${ENTRY_TEMPLATE_STORAGE_KEY}:${locale}`;
}

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

function normalizeTemplateList(
  raw: unknown,
  kind: JourneyKind,
  fallback: EntryTemplateConfig
): EntryTemplate[] {
  if (!Array.isArray(raw)) {
    return fallback[kind];
  }

  const normalized = raw
    .map((item) => normalizeTemplateItem(item))
    .filter((item): item is EntryTemplate => Boolean(item));

  if (normalized.length === 0) {
    return fallback[kind];
  }

  return normalized;
}

function normalizeTemplateConfig(raw: unknown, fallback: EntryTemplateConfig): EntryTemplateConfig {
  if (!raw || typeof raw !== 'object') {
    return fallback;
  }

  const maybeConfig = raw as Partial<Record<JourneyKind, unknown>>;

  return {
    travel: normalizeTemplateList(maybeConfig.travel, 'travel', fallback),
    commute: normalizeTemplateList(maybeConfig.commute, 'commute', fallback),
  };
}

export function getDefaultEntryTemplateConfig(locale: Locale): EntryTemplateConfig {
  return getTemplateDefaults(locale);
}

export async function loadEntryTemplateConfig(locale: Locale): Promise<EntryTemplateConfig> {
  const fallback = getDefaultEntryTemplateConfig(locale);
  const raw = await AsyncStorage.getItem(getStorageKey(locale));
  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return normalizeTemplateConfig(parsed, fallback);
  } catch {
    return fallback;
  }
}

export async function saveEntryTemplateConfig(
  locale: Locale,
  config: EntryTemplateConfig
): Promise<void> {
  await AsyncStorage.setItem(getStorageKey(locale), JSON.stringify(config));
}
