import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { useTheme } from "@/lib/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

/**
 * forwardRef so a screen can chain focus (email's onSubmitEditing -> focus
 * the password field). Nothing uses the ref yet — the screens currently
 * submit on return instead — but the alternative is rewriting every caller
 * later, and forwardRef costs nothing until then.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, style, ...props },
  ref,
) {
  const { colors, spacing, radii, fontSize } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      {label && (
        <Text style={{ fontSize: fontSize.sm, fontWeight: "500", color: colors.textMuted }}>{label}</Text>
      )}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.textFaint}
        style={[
          styles.base,
          {
            borderColor: error ? colors.danger : colors.border,
            borderRadius: radii.md,
            padding: spacing.md,
            fontSize: fontSize.base,
            color: colors.text,
            backgroundColor: colors.surface,
          },
          style,
        ]}
        {...props}
      />
      {error && (
        <Text accessibilityLiveRegion="polite" style={{ fontSize: fontSize.xs, color: colors.danger }}>
          {error}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  base: { borderWidth: 1 },
});
