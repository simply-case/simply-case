import { Image, Text, View, type ImageSourcePropType } from "react-native";
import { useTheme } from "@/lib/theme";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  message?: string;
  /** Optional illustration above the title — used for the one or two
   * "first run" empty states (e.g. no cases yet) where a bare sentence
   * feels thin. Most callers (no history yet, case not found) omit it. */
  icon?: ImageSourcePropType;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Shared shape for every "nothing here" moment (no cases yet, no history
 * yet, no results). A plain gray sentence was the previous approach
 * everywhere — this gives empty states a title + supporting line so a new
 * user's very first screen doesn't read as broken or unfinished.
 */
export function EmptyState({ title, message, icon, actionLabel, onAction }: EmptyStateProps) {
  const { colors, spacing, fontSize, fontFamily } = useTheme();
  return (
    <View style={{ paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, alignItems: "center" }}>
      {icon && <Image source={icon} style={{ width: 96, height: 96, marginBottom: spacing.lg }} resizeMode="contain" />}
      <Text
        style={{
          fontSize: icon ? fontSize.lg : fontSize.base,
          fontFamily: icon ? fontFamily.serif : undefined,
          fontWeight: "700",
          color: colors.text,
          textAlign: "center",
        }}
      >
        {title}
      </Text>
      {message && (
        <Text
          style={{
            fontSize: fontSize.sm,
            color: colors.textMuted,
            textAlign: "center",
            marginTop: spacing.xs,
            maxWidth: 280,
          }}
        >
          {message}
        </Text>
      )}
      {actionLabel && onAction && (
        <View style={{ marginTop: spacing.lg, alignSelf: "stretch" }}>
          <Button label={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}
