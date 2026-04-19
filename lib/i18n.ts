import * as Localization from 'expo-localization';

import en from '@/locales/en';
import zh from '@/locales/zh';
import { EntryTemplateConfig } from '@/types/template';

export type Locale = 'en' | 'zh';
export type LocalePreference = Locale | 'system';

type TranslationValue = string | { [key: string]: TranslationValue };

const translations: Record<Locale, TranslationValue> = {
  en,
  zh,
};

function getLocaleFromString(raw: string | undefined): Locale {
  if (!raw) {
    return 'en';
  }
  return raw.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function getSystemLocale(): Locale {
  const locales = Localization.getLocales?.() ?? [];
  const first = locales[0];
  if (first?.languageCode) {
    return getLocaleFromString(first.languageCode);
  }
  if (first?.languageTag) {
    return getLocaleFromString(first.languageTag);
  }
  if ((Localization as { locale?: string }).locale) {
    return getLocaleFromString((Localization as { locale?: string }).locale);
  }
  const fallback = Intl.DateTimeFormat().resolvedOptions().locale;
  return getLocaleFromString(fallback);
}

function resolveTranslation(dict: TranslationValue, key: string): string | undefined {
  const parts = key.split('.');
  let current: TranslationValue | undefined = dict;
  for (const part of parts) {
    if (!current || typeof current === 'string') {
      return undefined;
    }
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

export function createTranslator(locale: Locale) {
  return (key: string, params?: Record<string, string | number>) => {
    const value = resolveTranslation(translations[locale], key);
    if (value) {
      return interpolate(value, params);
    }
    const fallback = resolveTranslation(translations.en, key) ?? key;
    return interpolate(fallback, params);
  };
}

export function getTemplateDefaults(locale: Locale): EntryTemplateConfig {
  const dict = translations[locale] as { templates?: EntryTemplateConfig };
  const templates = dict.templates ?? (translations.en as { templates: EntryTemplateConfig }).templates;
  return {
    travel: templates.travel.map((item) => ({ ...item, tags: [...item.tags] })),
    commute: templates.commute.map((item) => ({ ...item, tags: [...item.tags] })),
  };
}
