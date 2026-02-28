import { Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemePreference } from '@/hooks/theme-preference';

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useThemePreference();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Pressable
      style={[
        styles.button,
        {
          borderColor: isDark ? '#475569' : '#94a3b8',
          backgroundColor: isDark ? '#1e293b' : '#f8fafc',
        },
      ]}
      onPress={toggleTheme}>
      <MaterialIcons
        name={resolvedTheme === 'dark' ? 'light-mode' : 'dark-mode'}
        size={18}
        color={isDark ? '#e2e8f0' : '#0f172a'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 999,
    borderWidth: 1,
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
