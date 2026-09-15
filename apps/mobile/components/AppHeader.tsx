import { Image, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "@/lib/theme";

const LOGO_ASPECT_RATIO = 1286 / 238; // header-logo.png's native dimensions

const LEFT_SLOT_SIZE = 26; // matches the icon size, so the logo doesn't shift when a screen has no left action

interface AppHeaderProps {
  /** Optional top-left icon button. Omitted on screens that don't need
   * one (News, Resources, Profile) — the slot still reserves its width so
   * the logo stays in the same place switching between tabs. Cases is the
   * only screen using this today (a hamburger that opens that screen's own
   * menu sheet); there's no shared drawer behind it. */
  leftAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    accessibilityLabel: string;
  };
}

/**
 * The brand header shown at the top of every tab root (Cases, News, More,
 * Profile) — an optional icon button top-left, wordmark top-right, no page
 * title text. Not a native navigation header: Tabs.screenOptions has
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
export function AppHeader({ leftAction }: AppHeaderProps) {
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
        {leftAction && (
          <Pressable onPress={leftAction.onPress} accessibilityRole="button" accessibilityLabel={leftAction.accessibilityLabel} hitSlop={12}>
            <Ionicons name={leftAction.icon} size={LEFT_SLOT_SIZE} color={colors.text} />
          </Pressable>
        )}
      </View>

      <Image
        source={require("../assets/header-logo.png")}
        style={{ height: logoHeight, width: logoHeight * LOGO_ASPECT_RATIO }}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Simply Case"
      />
    </View>
  );
}
