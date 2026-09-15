import { forwardRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Renders an eye/eye-off toggle inside the field and lets the user
   * reveal the value instead of trusting `secureTextEntry` blind — only
   * meaningful when `secureTextEntry` is also passed. */
  secureToggle?: boolean;
}

/**
 * forwardRef so a screen can chain focus (email's onSubmitEditing -> focus
 * the password field). Nothing uses the ref yet — the screens currently
 * submit on return instead — but the alternative is rewriting every caller
 * later, and forwardRef costs nothing until then.
 */
export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, error, style, secureToggle, secureTextEntry, ...props },
  ref,
) {
  const { colors, spacing, radii, fontSize } = useTheme();
  const [revealed, setRevealed] = useState(false);
  const isSecure = secureToggle ? secureTextEntry && !revealed : secureTextEntry;

  return (
    <View style={{ gap: spacing.xs }}>
      {label && (
        <Text style={{ fontSize: fontSize.sm, fontWeight: "500", color: colors.textMuted }}>{label}</Text>
      )}
      <View style={{ justifyContent: "center" }}>
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textFaint}
          secureTextEntry={isSecure}
          style={[
            styles.base,
            {
              borderColor: error ? colors.danger : colors.border,
              borderRadius: radii.md,
              padding: spacing.md,
              paddingRight: secureToggle ? spacing.xxl : spacing.md,
              fontSize: fontSize.base,
              color: colors.text,
              backgroundColor: colors.surface,
            },
            style,
          ]}
          {...props}
        />
        {secureToggle && (
          <Pressable
            onPress={() => setRevealed((r) => !r)}
            accessibilityRole="button"
            accessibilityLabel={revealed ? "Hide password" : "Show password"}
            hitSlop={12}
            style={{ position: "absolute", right: spacing.md }}
          >
            <Ionicons name={revealed ? "eye-off-outline" : "eye-outline"} size={18} color={colors.textFaint} />
          </Pressable>
        )}
      </View>
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
