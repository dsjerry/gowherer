import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

import { useOptionalThemePreference } from '@/hooks/theme-preference';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const themePreference = useOptionalThemePreference();
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (themePreference) {
    return themePreference.resolvedTheme;
  }

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}
