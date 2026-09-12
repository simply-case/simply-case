import { useColorScheme } from "react-native";
import { colors, fontSize, radii, shadow, spacing, statusColors, type StatusClass } from "@mycasepro/shared";

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
    cardShadow: shadow.card[scheme],
    statusColor(cls: StatusClass) {
      const s = statusColors[cls];
      return { fg: s[scheme], bg: s.bg[scheme] };
    },
  };
}

export type Theme = ReturnType<typeof useTheme>;
