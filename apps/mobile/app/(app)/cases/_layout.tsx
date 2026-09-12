import { Stack } from "expo-router";
import { useTheme } from "@/lib/theme";

/**
 * Nested stack for the Cases tab: list -> detail. Kept as its own stack
 * (rather than flattening into the parent Tabs) so pushing into a case
 * detail slides in over the tab bar and the back gesture returns to the
 * list, the standard iOS/Android pattern for a tab that has drill-down
 * content — the tab bar itself stays visible throughout.
 */
export default function CasesLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      {/* headerShown: false here — the list screen renders <AppHeader/>
          itself (the shared brand header used by all 4 tab roots). The
          detail screen keeps its native header for the back button. */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: "Case" }} />
    </Stack>
  );
}
