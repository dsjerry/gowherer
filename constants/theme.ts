/**
 * GoWherer Material Design Theme Tokens
 *
 * Color system inspired by Material Design with a purple/violet accent palette.
 * Based on the Open Design prototype (gowherer-material-ui.html).
 */

import { Platform } from "react-native";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemeColors {
  /** Page background */
  bg: string;
  /** Card / elevated surface fill */
  surface: string;
  /** Primary accent, interactive elements */
  fg: string;
  /** Secondary text, disabled states */
  muted: string;
  /** Dividers, card borders */
  border: string;
  /** Secondary accent, highlight fills */
  accent: string;
  /** Success / positive actions */
  accentSecondary: string;
  /** Text on foreground-colored surfaces */
  fgOn: string;
  /** Headings, primary body text */
  textPrimary: string;
  /** Labels, secondary text */
  textSecondary: string;
  /** Hints, captions, timestamps */
  textTertiary: string;
  /** Semantic colors */
  success: string;
  warn: string;
  danger: string;
  teal: string;
  /** Tab bar background */
  tabBg: string;
}

// ---------------------------------------------------------------------------
// Light theme
// ---------------------------------------------------------------------------

const light: ThemeColors = {
  bg: "#ffffff",
  surface: "#f9f7fd",
  fg: "#6442d6",
  muted: "#b9aaed",
  border: "#e9e5f9",
  accent: "#c8b3fd",
  accentSecondary: "#16a34a",
  fgOn: "#ffffff",
  textPrimary: "#1a1625",
  textSecondary: "#5a4f73",
  textTertiary: "#8a7fa3",
  success: "#16a34a",
  warn: "#f9ab00",
  danger: "#d93025",
  teal: "#0f766e",
  tabBg: "#f9f7fd",
};

// ---------------------------------------------------------------------------
// Dark theme
// ---------------------------------------------------------------------------

const dark: ThemeColors = {
  bg: "#1a1625",
  surface: "#252031",
  fg: "#c8b3fd",
  muted: "#7c6db5",
  border: "#3d3555",
  accent: "#c8b3fd",
  accentSecondary: "#16a34a",
  fgOn: "#ffffff",
  textPrimary: "#e8e0f5",
  textSecondary: "#b8a8d8",
  textTertiary: "#7c6db5",
  success: "#16a34a",
  warn: "#f9ab00",
  danger: "#d93025",
  teal: "#0f766e",
  tabBg: "#252031",
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export const Colors = { light, dark };

export type ColorScheme = "light" | "dark";

export function getThemeColors(scheme: ColorScheme): ThemeColors {
  return scheme === "dark" ? dark : light;
}

// ---------------------------------------------------------------------------
// Fonts
// ---------------------------------------------------------------------------

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
