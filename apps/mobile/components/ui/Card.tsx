import { Pressable, View, type PressableProps, type ViewProps } from "react-native";
import { useTheme } from "@/lib/theme";

/**
 * Non-interactive surface. Used for the status card and grouped content;
 * ListRow (below) is the interactive equivalent for tappable rows.
 */
export function Card({ style, ...props }: ViewProps) {
  const { colors, radii, spacing, cardShadow } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: colors.border,
          padding: spacing.lg,
          ...cardShadow,
        },
        style,
      ]}
      {...props}
    />
  );
}

interface ListRowProps extends Omit<PressableProps, "style"> {
  style?: ViewProps["style"];
}

/** Tappable card variant — the case list row. Feedback via opacity + a
 * slightly stronger border on press, no shadow change (avoids the "the
 * whole card lifted off the page" feeling on every tap). */
export function ListRow({ style, ...props }: ListRowProps) {
  const { colors, radii, spacing, cardShadow } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        {
          backgroundColor: colors.surface,
          borderRadius: radii.lg,
          borderWidth: 1,
          borderColor: pressed ? colors.borderStrong : colors.border,
          padding: spacing.lg,
          opacity: pressed ? 0.92 : 1,
          ...cardShadow,
        },
        style,
      ]}
      {...props}
    />
  );
}
