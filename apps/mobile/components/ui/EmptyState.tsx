import { Text, View } from "react-native";
import { useTheme } from "@/lib/theme";

/**
 * Shared shape for every "nothing here" moment (no cases yet, no history
 * yet, no results). A plain gray sentence was the previous approach
 * everywhere — this gives empty states a title + supporting line so a new
 * user's very first screen doesn't read as broken or unfinished.
 */
export function EmptyState({ title, message }: { title: string; message?: string }) {
  const { colors, spacing, fontSize } = useTheme();
  return (
    <View style={{ paddingVertical: spacing.xxl, paddingHorizontal: spacing.lg, alignItems: "center" }}>
      <Text style={{ fontSize: fontSize.base, fontWeight: "600", color: colors.text, textAlign: "center" }}>
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
    </View>
  );
}
