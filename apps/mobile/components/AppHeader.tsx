import { useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

const LOGO_ASPECT_RATIO = 1286 / 238; // header-logo.png's native dimensions

const LEFT_SLOT_SIZE = 26; // the hamburger's icon size; HeaderMenu's offset below depends on it

const MENU_ITEMS: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; href: "/notifications" | "/help" }> = [
  { icon: "notifications-outline", label: "Notification settings", href: "/notifications" },
  { icon: "help-circle-outline", label: "Help & feedback", href: "/help" },
];

/**
 * The brand header shown at the top of every tab root (Cases, News,
 * Resources, Profile) — a hamburger top-left that opens a dropdown
 * (Notification settings, Help & feedback), wordmark top-right, no page
 * title text. The menu lives here, not in each screen, so the header is
 * identical on every tab and a new menu item is added in one place. Not a native navigation header: Tabs.screenOptions has
 * headerShown:false (see (app)/_layout.tsx) because a Tabs navigator's
 * header wraps the whole nested navigator, which would double up with the
 * Cases tab's own Stack header on its detail screen. Rendering this
 * directly in each screen avoids that, at the cost of manually handling
 * the safe-area top inset here (a native header does this for free).
 *
 * header-logo.png is a TRIMMED export of assets/simplycase.png (see git
 * history / commit message — the raw file has ~80% baked-in transparent
 * padding, which made the wordmark look tiny and adrift no matter the
 * display size) — same artwork, kept as the header logo for that reason.
 * Sized by height with the real aspect ratio, not a fixed width, so it
 * can't look stretched if the source is ever swapped.
 */
export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const logoHeight = 22;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <View style={{ width: LEFT_SLOT_SIZE }}>
        <Pressable onPress={() => setMenuOpen(true)} accessibilityRole="button" accessibilityLabel="Menu" hitSlop={12}>
          <Ionicons name="menu-outline" size={LEFT_SLOT_SIZE} color={colors.text} />
        </Pressable>
      </View>

      <Image
        source={require("../assets/header-logo.png")}
        style={{ height: logoHeight, width: logoHeight * LOGO_ASPECT_RATIO }}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Simply Case"
      />

      <HeaderMenu visible={menuOpen} onClose={() => setMenuOpen(false)} items={MENU_ITEMS} />
    </View>
  );
}

/**
 * Dropdown anchored under the hamburger in the top-left corner, rather than
 * a bottom sheet: it should visibly come from the button that opened it.
 * The offset mirrors AppHeader's own layout (safe-area inset + its
 * vertical padding + icon height), so it lands just below the header.
 */
function HeaderMenu({
  visible,
  onClose,
  items,
}: {
  visible: boolean;
  onClose: () => void;
  items: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; href: "/notifications" | "/help" }>;
}) {
  const { colors, spacing, radii, fontSize, cardShadow } = useTheme();
  const insets = useSafeAreaInsets();
  const top = insets.top + spacing.sm + 26 + spacing.sm + spacing.xs;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.15)" }} onPress={onClose} accessibilityLabel="Close menu">
        <View
          style={{
            position: "absolute",
            top,
            left: spacing.lg,
            minWidth: 230,
            backgroundColor: colors.surface,
            borderRadius: radii.lg,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: "hidden",
            ...cardShadow,
            shadowOpacity: 0.12,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          {items.map((item, i) => (
            <Pressable
              key={item.href}
              onPress={() => {
                onClose();
                router.push(item.href);
              }}
              accessibilityRole="menuitem"
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.md,
                paddingVertical: spacing.md,
                paddingHorizontal: spacing.lg,
                backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                borderBottomWidth: i < items.length - 1 ? 1 : 0,
                borderBottomColor: colors.border,
              })}
            >
              <Ionicons name={item.icon} size={20} color={colors.accent} />
              <Text style={{ fontSize: fontSize.base, color: colors.text }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
