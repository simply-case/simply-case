import { Image, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/lib/theme";

const LOGO_ASPECT_RATIO = 1286 / 238; // header-logo.png's native dimensions

/**
 * The brand header shown at the top of every tab root (Cases, News, More,
 * Profile) — the wordmark, top-left, no page title text. Not a native
 * navigation header: Tabs.screenOptions has headerShown:false (see
 * (app)/_layout.tsx) because a Tabs navigator's header wraps the whole
 * nested navigator, which would double up with the Cases tab's own Stack
 * header on its detail screen. Rendering this directly in each screen
 * avoids that, at the cost of manually handling the safe-area top inset
 * here (a native header does this for free).
 *
 * header-logo.png is a TRIMMED export (see git history / commit message —
 * the original simplycase.png had ~80% baked-in transparent padding,
 * which made the wordmark look tiny and adrift no matter the display
 * size). Sized by height with the real aspect ratio, not a fixed width,
 * so it can't look stretched if the source is ever swapped.
 */
export function AppHeader() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const logoHeight = 22;

  return (
    <View
      style={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
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
