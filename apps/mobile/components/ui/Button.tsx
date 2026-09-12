import { ActivityIndicator, Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { useTheme } from "@/lib/theme";

interface ButtonProps extends Omit<PressableProps, "style" | "children"> {
  label: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost";
}

/**
 * The one button component every screen uses. Disabled state during
 * `loading` isn't just cosmetic — it's what prevents the double-submit bugs
 * that hand-rolled per-screen buttons were prone to (e.g. tapping "Add case"
 * twice before the first request resolves).
 */
export function Button({ label, loading, variant = "primary", disabled, ...props }: ButtonProps) {
  const { colors, spacing, radii, fontSize } = useTheme();
  const isDisabled = disabled || loading;

  const bg = variant === "primary" ? colors.accent : variant === "secondary" ? colors.surfaceMuted : "transparent";
  const fg = variant === "primary" ? colors.accentText : colors.text;
  const borderColor = variant === "secondary" ? colors.border : "transparent";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderRadius: radii.md,
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.lg,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: fontSize.base, fontWeight: "600" }}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
});
