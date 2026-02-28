import { useColorScheme as useRNColorScheme } from 'react-native';

import { useOptionalThemePreference } from '@/hooks/theme-preference';

export function useColorScheme() {
  const themePreference = useOptionalThemePreference();
  const systemScheme = useRNColorScheme();

  if (themePreference) {
    return themePreference.resolvedTheme;
  }

  return systemScheme ?? 'light';
}
