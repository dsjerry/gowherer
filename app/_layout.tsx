import {
    DarkTheme,
    DefaultTheme,
    ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { LocalePreferenceProvider } from "@/hooks/locale-preference";
import { ThemePreferenceProvider } from "@/hooks/theme-preference";
import { useColorScheme } from "@/hooks/use-color-scheme";
import "@/lib/amap-privacy";
import "@/lib/background-location";

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  return (
    <LocalePreferenceProvider>
      <ThemePreferenceProvider>
        <RootNavigator />
      </ThemePreferenceProvider>
    </LocalePreferenceProvider>
  );
}

function RootNavigator() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
    </ThemeProvider>
  );
}
