import { useMemo } from "react";
import { StyleSheet } from "react-native";

import { ColorScheme, ThemeColors, getThemeColors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";

/**
 * Returns the Material Design theme colors for the current color scheme,
 * plus a pre-built set of common StyleSheet helpers.
 */
export function useMaterialTheme() {
  const colorScheme = useColorScheme();
  const scheme: ColorScheme = colorScheme === "dark" ? "dark" : "light";
  const colors = useMemo(() => getThemeColors(scheme), [scheme]);
  const isDark = scheme === "dark";

  const styles = useMemo(() => buildStyles(colors, isDark), [colors, isDark]);

  return { colors, isDark, scheme, styles };
}

// ---------------------------------------------------------------------------
// Shared StyleSheet helpers
// ---------------------------------------------------------------------------

function buildStyles(c: ThemeColors, _isDark: boolean) {
  return StyleSheet.create({
    // Page
    page: {
      backgroundColor: c.bg,
      flex: 1,
    },

    // Cards
    card: {
      backgroundColor: c.surface,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: c.border,
      padding: 16,
    },

    // Text
    textPrimary: {
      color: c.textPrimary,
      fontSize: 16,
      fontWeight: "600",
    },
    textSecondary: {
      color: c.textSecondary,
      fontSize: 14,
    },
    textTertiary: {
      color: c.textTertiary,
      fontSize: 12,
    },

    // Section header
    sectionHeader: {
      fontSize: 14,
      fontWeight: "500",
      color: c.textTertiary,
      letterSpacing: 0.02,
      marginBottom: 10,
    },

    // Input
    input: {
      borderWidth: 1.5,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.textPrimary,
      backgroundColor: "transparent",
    },

    // Primary button
    btnPrimary: {
      backgroundColor: c.fg,
      borderRadius: 999,
      paddingVertical: 12,
      paddingHorizontal: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    btnPrimaryText: {
      color: c.fgOn,
      fontSize: 14,
      fontWeight: "600",
      letterSpacing: 0.02,
    },

    // Secondary button
    btnSecondary: {
      backgroundColor: c.surface,
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingVertical: 10,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    btnSecondaryText: {
      color: c.fg,
      fontSize: 13,
      fontWeight: "600",
    },

    // Chip
    chip: {
      borderRadius: 999,
      borderWidth: 1.5,
      borderColor: c.border,
      paddingHorizontal: 14,
      paddingVertical: 6,
      backgroundColor: "transparent",
    },
    chipText: {
      fontSize: 13,
      fontWeight: "500",
      color: c.textSecondary,
    },
    chipActive: {
      backgroundColor: c.fg,
      borderColor: c.fg,
    },
    chipActiveText: {
      color: c.fgOn,
    },

    // Divider
    divider: {
      height: 1,
      backgroundColor: c.border,
      marginVertical: 12,
    },

    // Row
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: c.border,
    },
  });
}
