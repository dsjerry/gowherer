import { ThemePreference } from '@/hooks/theme-preference';
import { Locale, LocalePreference } from '@/lib/i18n';
import { exportBackupApi, importBackupApi } from '@/lib/api-client';
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

export async function buildAppBackup(_appVersion: string): Promise<AppBackupV1> {
  const data = await exportBackupApi();
  return {
    version: 1,
    exportedAt: data.exportedAt || new Date().toISOString(),
    app: data.app || { slug: 'gowherer', version: 'server' },
    preferences: data.preferences || { locale: 'system', theme: 'system' },
    journeys: data.journeys || [],
    entryTemplates: data.templates || {},
  };
}

export async function writeBackupToFile(backup: AppBackupV1): Promise<{ fileName: string; uri: string }> {
  // In API mode, export returns JSON string
  const json = JSON.stringify(backup, null, 2);
  const fileName = `gowherer-backup-${backup.exportedAt.replace(/[:.]/g, '-').replace('T', '_')}.json`;
  // For React Native, we'd need expo-file-system to write to cache
  // For now, return the JSON as a shareable string
  return { fileName, uri: `data:application/json,${encodeURIComponent(json)}` };
}

export function serializeBackup(backup: AppBackupV1) {
  return JSON.stringify(backup, null, 2);
}

export function parseBackupString(raw: string): AppBackupV1 {
  const parsed = JSON.parse(raw) as Partial<AppBackupV1>;

  if (parsed.version !== 1) {
    throw new Error('Unsupported backup version.');
  }

  return {
    version: 1,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : new Date().toISOString(),
    app: parsed.app || { slug: 'gowherer', version: 'unknown' },
    preferences: parsed.preferences || { locale: 'system', theme: 'system' },
    journeys: Array.isArray(parsed.journeys) ? parsed.journeys : [],
    entryTemplates: parsed.entryTemplates || {},
  };
}

export async function importBackup(backup: AppBackupV1): Promise<ImportResult> {
  await importBackupApi(backup);
  return {
    localePreference: backup.preferences?.locale || 'system',
    themePreference: backup.preferences?.theme || 'system',
  };
}
