import { useState } from "react";
import { FlatList, Modal, Pressable, Text, View } from "react-native";
import { useTheme } from "@/lib/theme";
import { CEAC_LOCATIONS, type CeacLocation } from "@/lib/ceac-locations";
import { Input } from "@/components/ui";

/**
 * Full-screen searchable picker for CEAC's ~230-entry consulate list
 * (lib/ceac-locations.ts) — too many to usefully show as a scrollable
 * BottomSheet (components/ui/BottomSheet.tsx is sized for a handful of
 * options like Sort/Filter), so this gets its own modal with a search box
 * over a FlatList instead.
 */
export function LocationPicker({
  visible,
  selectedCode,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selectedCode: string | null;
  onSelect: (location: CeacLocation) => void;
  onClose: () => void;
}) {
  const { colors, spacing, fontSize, radii } = useTheme();
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? CEAC_LOCATIONS.filter((l) => l.label.toLowerCase().includes(query.trim().toLowerCase()))
    : CEAC_LOCATIONS;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 60 }}>
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, marginBottom: spacing.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={{ fontSize: fontSize.lg, fontWeight: "700", color: colors.text }}>Select a location</Text>
            <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
              <Text style={{ fontSize: fontSize.sm, color: colors.link, fontWeight: "600" }}>Close</Text>
            </Pressable>
          </View>
          <Input value={query} onChangeText={setQuery} placeholder="Search country or city" autoCapitalize="none" autoCorrect={false} />
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
                {item.label}
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
