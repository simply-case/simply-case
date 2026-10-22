import { Pressable } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

/**
 * A square checkbox. Checked state is carried by color AND the check glyph,
 * never color alone — same accessibility rule the status colors follow
 * (packages/shared/src/theme.ts): don't make color the only channel of
 * information.
 *
 * Deliberately renders only the box. The label lives at the call site so it
 * can contain tappable links (Terms / Privacy Policy) without this
 * component having to know about them.
 */
export function Checkbox({
  checked,
  onChange,
  accessibilityLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  accessibilityLabel: string;
}) {
  const { colors, radii } = useTheme();

  return (
    <Pressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={accessibilityLabel}
      // Generous hitSlop: the box itself is deliberately small, but the
      // tap target shouldn't be.
      hitSlop={10}
      style={{
        width: 22,
        height: 22,
        borderRadius: radii.sm,
        borderWidth: 1.5,
        borderColor: checked ? colors.accent : colors.borderStrong,
        backgroundColor: checked ? colors.accent : colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked && <FontAwesome name="check" size={12} color={colors.accentText} />}
    </Pressable>
  );
}
