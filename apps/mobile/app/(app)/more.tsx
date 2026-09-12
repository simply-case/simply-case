import { View } from "react-native";
import { useTheme } from "@/lib/theme";
import { EmptyState } from "@/components/ui";
import { AppHeader } from "@/components/AppHeader";

/**
 * Fourth tab slot, not yet assigned a feature. Kept as a real (if empty)
 * screen rather than a disabled tab — a disabled tab with no explanation
 * reads as broken; an intentional "coming soon" reads as a decision.
 */
export default function MoreScreen() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppHeader />
      <View style={{ flex: 1, justifyContent: "center" }}>
        <EmptyState title="Coming soon" message="This tab doesn't have a feature yet." />
      </View>
    </View>
  );
}
