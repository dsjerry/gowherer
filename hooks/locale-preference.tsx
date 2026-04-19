import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import * as Localization from 'expo-localization';

import { createTranslator, getSystemLocale, Locale, LocalePreference } from '@/lib/i18n';

type LocalePreferenceContextValue = {
  preference: LocalePreference;
  resolvedLocale: Locale;
  setPreference: (next: LocalePreference) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const LOCALE_PREFERENCE_KEY = 'gowherer:locale-preference:v1';

const LocalePreferenceContext = createContext<LocalePreferenceContextValue | null>(null);

export function LocalePreferenceProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<LocalePreference>('system');
  const [systemLocale, setSystemLocale] = useState<Locale>(getSystemLocale());

  useEffect(() => {
    let active = true;
    (async () => {
      const raw = await AsyncStorage.getItem(LOCALE_PREFERENCE_KEY);
      if (!active) {
        return;
      }
      if (raw === 'system' || raw === 'en' || raw === 'zh') {
        setPreferenceState(raw);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const update = () => setSystemLocale(getSystemLocale());
    update();
    const subscription = Localization.addLocalizationListener?.(update);
    return () => {
      subscription?.remove?.();
    };
  }, []);

  const resolvedLocale = preference === 'system' ? systemLocale : preference;

  const setPreference = useCallback((next: LocalePreference) => {
    setPreferenceState(next);
    void AsyncStorage.setItem(LOCALE_PREFERENCE_KEY, next);
  }, []);

  const t = useMemo(() => createTranslator(resolvedLocale), [resolvedLocale]);

  const value = useMemo(
    () => ({
      preference,
      resolvedLocale,
      setPreference,
      t,
    }),
    [preference, resolvedLocale, setPreference, t]
  );

  return (
    <LocalePreferenceContext.Provider value={value}>
      {children}
    </LocalePreferenceContext.Provider>
  );
}

export function useLocalePreference() {
  const context = useContext(LocalePreferenceContext);
  if (!context) {
    throw new Error('useLocalePreference must be used within LocalePreferenceProvider');
  }
  return context;
}

export function useI18n() {
  const { resolvedLocale, preference, setPreference, t } = useLocalePreference();
  return {
    locale: resolvedLocale,
    preference,
    setPreference,
    t,
  };
}
