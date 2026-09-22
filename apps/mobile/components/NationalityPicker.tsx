import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { EOIR_NATIONALITIES, eoirNationalityLabel, type EoirNationality } from "@/lib/eoir-nationalities";
import { Input } from "@/components/ui";

/**
 * Searchable modal picker over EOIR_NATIONALITIES, structurally identical
 * to components/LocationPicker.tsx — same reasoning (too many options for
 * BottomSheet, a plain list over a search box instead).
 *
 * Shows EOIR's own "NAME (CODE)" label rather than just the name, on
 * purpose: their list contains several entries that are indistinguishable
 * without the code (five separate codes all named "Former Countries"), and
 * showing exactly what their own dropdown shows means what the user picks
 * here reads the same as what they'd see on the real page.
 */
export function NationalityPicker({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedCode: string | null;
  onSelect: (nationality: EoirNationality) => void;
  onClose: () => void;
}) {
  const { colors, spacing, fontSize, radii } = useTheme();
  const [query, setQuery] = useState("");

  const trimmed = query.trim().toLowerCase();
  const filtered = trimmed
    ? EOIR_NATIONALITIES.filter(
        (n) => n.name.toLowerCase().includes(trimmed) || n.code.toLowerCase() === trimmed,
      )
    : EOIR_NATIONALITIES;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60 }}>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.text }}>Select nationality</Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
              <Text style={{ fontSize: fontSize.sm, color: colors.link, fontWeight: "600" }}>Close</Text>
            </Pressable>
          </View>
          <Input value={query} onChangeText={setQuery} placeholder="Search country" autoCapitalize="none" autoCorrect={false} />
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => item.code}
          contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl }}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onSelect(item)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.md,
                borderRadius: radii.md,
                backgroundColor: item.code === selectedCode ? colors.surfaceMuted : pressed ? colors.surfaceMuted : "transparent",
              })}
            >
              <Text style={{ fontSize: fontSize.base, color: colors.text, fontWeight: item.code === selectedCode ? "700" : "400" }}>
                {eoirNationalityLabel(item)}
              </Text>
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
          ListEmptyComponent={
            <Text style={{ fontSize: fontSize.sm, color: colors.textMuted, textAlign: "center", marginTop: spacing.xl }}>
              No matches.
            </Text>
          }
        />
      </View>
    </Modal>
  );
}
