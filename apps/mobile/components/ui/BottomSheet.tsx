import { Modal, Pressable, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";

/**
 * Generic bottom sheet: dims the screen, slides a rounded panel up from the
 * bottom. Used for the Sort and Filter panels on the case list — plain
 * RN Modal rather than a bottom-sheet library, since this app doesn't
 * otherwise need gesture-driven snap points, just "show some options, tap
 * outside or Done to dismiss."
 */
export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const { colors, spacing, radii, fontSize } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      {/* Backdrop: tapping it (but not the sheet itself, below) dismisses.
          The sheet is a plain View, not a nested Pressable — RN's touch
          responder system already keeps a tap on it from reaching this
          Pressable, so it doesn't need to stop propagation itself. */}
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <View
          style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radii.xl,
            borderTopRightRadius: radii.xl,
            padding: spacing.xl,
            paddingBottom: spacing.xxl,
            gap: spacing.md,
          }}
        >
          <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.text }}>{title}</Text>
          {children}
        </View>
      </Pressable>
    </Modal>
  );
}

/** A single selectable row inside a sheet — a filled dot for single-select
 * (sort), a checkmark box for multi-select (filter). */
export function SheetOption({
  label,
  selected,
  onPress,
  multi,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  multi?: boolean;
}) {
  const { colors, spacing, radii, fontSize } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={multi ? "checkbox" : "radio"}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: multi ? radii.sm : radii.full,
          borderWidth: 1.5,
          borderColor: selected ? colors.accent : colors.borderStrong,
          backgroundColor: selected ? colors.accent : "transparent",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {selected && (
          <View
            style={
              multi
                ? { width: 8, height: 8, backgroundColor: colors.accentText, borderRadius: 2 }
                : { width: 8, height: 8, backgroundColor: colors.accentText, borderRadius: 4 }
            }
          />
        )}
      </View>
      <Text style={{ fontSize: fontSize.base, color: colors.text }}>{label}</Text>
    </Pressable>
  );
}
