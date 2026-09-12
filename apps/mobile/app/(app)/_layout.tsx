import { Stack } from "expo-router";
import { useTheme } from "@/lib/theme";

export default function AppLayout() {
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
      <Stack.Screen name="index" options={{ title: "mycase pro" }} />
      <Stack.Screen name="cases/[id]" options={{ title: "Case" }} />
    </Stack>
  );
}
