import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

import { ThemePreference } from '@/hooks/theme-preference';
import { Locale, LocalePreference } from '@/lib/i18n';
import { normalizeJourneyList } from '@/lib/journey-storage';
import {
  getEntryTemplateStorageKey,
  JOURNEY_STORAGE_KEY,
  LOCALE_PREFERENCE_KEY,
  THEME_PREFERENCE_KEY,
} from '@/lib/storage-keys';
import {
  getDefaultEntryTemplateConfig,
  normalizeTemplateConfig,
} from '@/lib/template-storage-i18n';
import { Journey } from '@/types/journey';
import { EntryTemplateConfig } from '@/types/template';

export type AppBackupV1 = {
  version: 1;
  exportedAt: string;
  app: {
    slug: string;
    version: string;
  };
  preferences: {
    locale: LocalePreference;
    theme: ThemePreference;
  };
  journeys: Journey[];
  entryTemplates: Record<Locale, EntryTemplateConfig>;
};

type ImportResult = {
  localePreference: LocalePreference;
  themePreference: ThemePreference;
};

function isLocalePreference(value: unknown): value is LocalePreference {
  return value === 'system' || value === 'zh' || value === 'en';
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function buildBackupFilename(exportedAt: string) {
  return `gowherer-backup-${exportedAt.replace(/[:.]/g, '-').replace('T', '_')}.json`;
}

async function loadPreference<T extends string>(
  key: string,
  fallback: T,
  guard: (value: unknown) => value is T
) {
  const raw = await AsyncStorage.getItem(key);
  return guard(raw) ? raw : fallback;
}

export async function buildAppBackup(appVersion: string): Promise<AppBackupV1> {
  const journeysRaw = await AsyncStorage.getItem(JOURNEY_STORAGE_KEY);
  const journeys = journeysRaw ? normalizeJourneyList(JSON.parse(journeysRaw)) : [];

  const [localePreference, themePreference, zhTemplatesRaw, enTemplatesRaw] = await Promise.all([
    loadPreference(LOCALE_PREFERENCE_KEY, 'system', isLocalePreference),
    loadPreference(THEME_PREFERENCE_KEY, 'system', isThemePreference),
    AsyncStorage.getItem(getEntryTemplateStorageKey('zh')),
    AsyncStorage.getItem(getEntryTemplateStorageKey('en')),
  ]);

  const zhFallback = getDefaultEntryTemplateConfig('zh');
  const enFallback = getDefaultEntryTemplateConfig('en');

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: {
      slug: 'gowherer',
      version: appVersion,
    },
    preferences: {
      locale: localePreference,
      theme: themePreference,
    },
    journeys,
    entryTemplates: {
      zh: zhTemplatesRaw ? normalizeTemplateConfig(JSON.parse(zhTemplatesRaw), zhFallback) : zhFallback,
      en: enTemplatesRaw ? normalizeTemplateConfig(JSON.parse(enTemplatesRaw), enFallback) : enFallback,
    },
  };
}

export async function writeBackupToFile(backup: AppBackupV1): Promise<{ fileName: string; uri: string }> {
  const directory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!directory) {
    throw new Error('File system directory is unavailable.');
  }

  const fileName = buildBackupFilename(backup.exportedAt);
  const uri = `${directory}${fileName}`;
  await FileSystem.writeAsStringAsync(uri, JSON.stringify(backup, null, 2), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  return { fileName, uri };
}

export function serializeBackup(backup: AppBackupV1) {
  return JSON.stringify(backup, null, 2);
}

export function parseBackupString(raw: string): AppBackupV1 {
  const parsed = JSON.parse(raw) as Partial<AppBackupV1> & { preferences?: Record<string, unknown> };

  if (parsed.version !== 1) {
    throw new Error('Unsupported backup version.');
  }

  if (!parsed.entryTemplates || typeof parsed.entryTemplates !== 'object') {
    throw new Error('Backup templates are missing.');
  }

  const localePreference = isLocalePreference(parsed.preferences?.locale)
    ? parsed.preferences.locale
    : 'system';
  const themePreference = isThemePreference(parsed.preferences?.theme)
    ? parsed.preferences.theme
    : 'system';

  return {
    version: 1,
    exportedAt:
      typeof parsed.exportedAt === 'string' && parsed.exportedAt.trim()
        ? parsed.exportedAt
        : new Date().toISOString(),
    app: {
      slug:
        typeof parsed.app?.slug === 'string' && parsed.app.slug.trim()
          ? parsed.app.slug
          : 'gowherer',
      version:
        typeof parsed.app?.version === 'string' && parsed.app.version.trim()
          ? parsed.app.version
          : 'unknown',
    },
    preferences: {
      locale: localePreference,
      theme: themePreference,
    },
    journeys: normalizeJourneyList(parsed.journeys),
    entryTemplates: {
      zh: normalizeTemplateConfig(parsed.entryTemplates.zh, getDefaultEntryTemplateConfig('zh')),
      en: normalizeTemplateConfig(parsed.entryTemplates.en, getDefaultEntryTemplateConfig('en')),
    },
  };
}

export async function importBackup(backup: AppBackupV1): Promise<ImportResult> {
  await Promise.all([
    AsyncStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(backup.journeys)),
    AsyncStorage.setItem(getEntryTemplateStorageKey('zh'), JSON.stringify(backup.entryTemplates.zh)),
    AsyncStorage.setItem(getEntryTemplateStorageKey('en'), JSON.stringify(backup.entryTemplates.en)),
    AsyncStorage.setItem(LOCALE_PREFERENCE_KEY, backup.preferences.locale),
    AsyncStorage.setItem(THEME_PREFERENCE_KEY, backup.preferences.theme),
  ]);

  return {
    localePreference: backup.preferences.locale,
    themePreference: backup.preferences.theme,
  };
}
