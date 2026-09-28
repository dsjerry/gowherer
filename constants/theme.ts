/**
 * GoWherer Apple-style Theme Tokens
 *
 * Color system based on the Open Design prototype (gowherer-apple-ui.html):
 * Apple graphite neutrals with a bright link-blue accent, ink-inverted chips,
 * and a single black hero card for the active journey.
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
  /** Elevated fill used by inset elements in dark mode */
  surfaceWarm: string;
  /** Primary ink; also the black hero-card fill in light mode */
  fg: string;
  /** Secondary ink */
  fg2: string;
  /** Secondary text, disabled states */
  muted: string;
  /** Tertiary meta text */
  meta: string;
  /** Dividers, card borders */
  border: string;
  /** Soft dividers, quiet card borders */
  borderSoft: string;
  /** Primary accent, interactive elements */
  accent: string;
  /** Success / positive actions */
  accentSecondary: string;
  /** Text on accent-colored surfaces */
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
  surface: "#f5f5f7",
  surfaceWarm: "#fbfbfd",
  fg: "#1d1d1f",
  fg2: "#424245",
  muted: "#6e6e73",
  meta: "#86868b",
  border: "#d2d2d7",
  borderSoft: "#e8e8ed",
  accent: "#0071e3",
  accentSecondary: "#16a34a",
  fgOn: "#ffffff",
  textPrimary: "#1d1d1f",
  textSecondary: "#424245",
  textTertiary: "#6e6e73",
  success: "#16a34a",
  warn: "#eab308",
  danger: "#dc2626",
  teal: "#0f766e",
  tabBg: "#ffffff",
};

// ---------------------------------------------------------------------------
// Dark theme
// ---------------------------------------------------------------------------

const dark: ThemeColors = {
  bg: "#000000",
  surface: "#1d1d1f",
  surfaceWarm: "#272729",
  fg: "#f5f5f7",
  fg2: "#d2d2d7",
  muted: "#86868b",
  meta: "#86868b",
  border: "rgba(255,255,255,0.14)",
  borderSoft: "rgba(255,255,255,0.08)",
  accent: "#0071e3",
  accentSecondary: "#16a34a",
  fgOn: "#ffffff",
  textPrimary: "#f5f5f7",
  textSecondary: "#d2d2d7",
  textTertiary: "#86868b",
  success: "#16a34a",
  warn: "#eab308",
  danger: "#dc2626",
  teal: "#0f766e",
  tabBg: "#000000",
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
