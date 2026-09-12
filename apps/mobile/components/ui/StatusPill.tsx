import { Text, View } from "react-native";
import { classifyStatus, statusLabels, type StatusClass } from "@mycasepro/shared";
import { useTheme } from "@/lib/theme";

/**
 * The single most important visual decision in this app: how a case status
 * reads at a glance. Renders a fixed StatusClass label (see
 * packages/shared/src/status.ts), never the raw provider text — "Case Was
 * Received and A Receipt Notice Was Sent" doesn't fit a pill and isn't the
 * point of one; the pill answers "where does this stand", the full text
 * underneath answers "what exactly happened".
 *
 * Deliberately not color-only: label text carries the meaning, color is a
 * secondary reinforcement. A colorblind user or a grayscale screenshot both
 * still get the right information.
 */
export function StatusPill({ statusText, size = "md" }: { statusText: string | null | undefined; size?: "sm" | "md" }) {
  const { statusColor, radii, spacing, fontSize } = useTheme();
  const cls: StatusClass = classifyStatus(statusText);
  const { fg, bg } = statusColor(cls);
  const isSmall = size === "sm";

  return (
    <View
      style={{
        alignSelf: "flex-start",
        backgroundColor: bg,
        borderRadius: radii.full,
        paddingVertical: isSmall ? spacing.xs / 2 : spacing.xs,
        paddingHorizontal: isSmall ? spacing.sm : spacing.md,
      }}
    >
      <Text style={{ color: fg, fontSize: isSmall ? fontSize.xs : fontSize.sm, fontWeight: "600" }}>
        {statusLabels[cls]}
      </Text>
    </View>
  );
}
