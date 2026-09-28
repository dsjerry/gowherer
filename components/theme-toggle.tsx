import { MaterialIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet } from "react-native";

import { useThemePreference } from "@/hooks/theme-preference";
import { useMaterialTheme } from "@/hooks/use-material-theme";

export function ThemeToggle() {
  const { resolvedTheme, toggleTheme } = useThemePreference();
  const { colors: c } = useMaterialTheme();

  return (
    <Pressable
      style={[
        styles.button,
        {
          borderColor: c.border,
          backgroundColor: c.surface,
        },
      ]}
      onPress={toggleTheme}
    >
      <MaterialIcons
        name={resolvedTheme === "dark" ? "light-mode" : "dark-mode"}
        size={18}
        color={c.textSecondary}
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
    alignItems: "center",
    justifyContent: "center",
  },
});
