import { Locale } from '@/lib/i18n';

export const JOURNEY_STORAGE_KEY = 'gowherer:journeys:v1';
export const LOCALE_PREFERENCE_KEY = 'gowherer:locale-preference:v1';
export const THEME_PREFERENCE_KEY = 'gowherer:theme-preference:v1';

const ENTRY_TEMPLATE_STORAGE_KEY = 'gowherer:entry-templates:v1';

export function getEntryTemplateStorageKey(locale: Locale) {
  return `${ENTRY_TEMPLATE_STORAGE_KEY}:${locale}`;
}
