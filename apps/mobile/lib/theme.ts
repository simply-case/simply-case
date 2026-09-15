import { Platform, useColorScheme } from "react-native";
import { colors, fontSize, radii, shadow, spacing, statusColors, type StatusClass } from "@mycasepro/shared";

/**
 * A serif display face for page/screen headlines (the "Welcome back" /
 * "Create your account" style treatment), used sparingly against the
 * default system sans everywhere else. These are OS-bundled fonts — no
 * font files to ship, no expo-font loading step — so this is safe to use
 * immediately anywhere in the app. iOS ships Georgia; Android's generic
 * "serif" family resolves to Noto Serif. Not exported from
 * packages/shared/theme.ts because font family names are platform-specific
 * (web would need actual font files/next/font, not a bare family string).
 */
const fontFamily = {
  serif: Platform.select({ ios: "Georgia", android: "serif", default: "serif" }),
};

/**
 * Resolves the shared color tokens (packages/shared/src/theme.ts) against
 * the device's current color scheme. Everything else in theme.ts (spacing,
 * radii, fontSize) is scheme-independent so it's re-exported as-is.
 */
export function useTheme() {
  // useColorScheme() can return "unspecified" (e.g. certain Android/web
  // contexts), which theme.ts's tokens don't have an entry for — fold that
  // into "light" rather than letting it index out of the color map.
  const raw = useColorScheme();
  const scheme = raw === "dark" ? "dark" : "light";
  const palette = colors[scheme];
  return {
    scheme,
    colors: palette,
    spacing,
    radii,
    fontSize,
    fontFamily,
    cardShadow: shadow.card[scheme],
    statusColor(cls: StatusClass) {
      const s = statusColors[cls];
      return { fg: s[scheme], bg: s.bg[scheme] };
    },
  };
}

export type Theme = ReturnType<typeof useTheme>;
