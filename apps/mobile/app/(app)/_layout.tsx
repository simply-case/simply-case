import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "mycase pro" }} />
      <Stack.Screen name="cases/[id]" options={{ title: "Case" }} />
    </Stack>
  );
}
