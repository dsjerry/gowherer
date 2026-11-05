import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { getCityWalkTheme } from '@/components/city-walk-theme';
import { LocalePreferenceProvider } from '@/hooks/locale-preference';
import { ThemePreferenceProvider } from '@/hooks/theme-preference';
import { useColorScheme } from '@/hooks/use-color-scheme';
import '@/lib/amap-privacy';
import '@/lib/background-location';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <LocalePreferenceProvider>
        <ThemePreferenceProvider>
          <RootNavigator />
        </ThemePreferenceProvider>
      </LocalePreferenceProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <ThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: isDark ? '#0b1220' : '#f3f5f3' },
          }}
        />
        <Stack.Screen
          name="city-walk"
          options={{
            headerShown: false,
            contentStyle: { backgroundColor: getCityWalkTheme(isDark).page },
            animation: Platform.OS === 'android' ? 'fade_from_bottom' : 'default',
          }}
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}
