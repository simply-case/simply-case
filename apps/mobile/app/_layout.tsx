import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme";
// Side-effect import: starts the deep-link listener before any screen
// mounts or navigates, so an incoming recovery link is never missed. See
// lib/deep-link.ts for why this has to happen this early.
import "@/lib/deep-link";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

/**
 * Stack.Protected's guard is evaluated on every render, so a case-detail
 * link never briefly flashes before redirecting to sign-in. It replaces the
 * older pattern of reading useSegments() and calling router.replace() by
 * hand — this is the current Expo Router API (SDK 57 / expo-router ~57.0),
 * not what earlier training data would suggest.
 */
function RootNavigator() {
  const { colors } = useTheme();
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Applied once here rather than per-screen: every Stack.Screen below
  // inherits it, so a new screen added later is themed by default instead
  // of needing its own header options to avoid looking like an outlier.
  const screenOptions = {
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    contentStyle: { backgroundColor: colors.bg },
  };

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!session}>
        <Stack.Screen name="sign-in" options={{ title: "Simply Case" }} />
        <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
      </Stack.Protected>

      {/* Reachable regardless of session state — it's what CREATES the
          session from an incoming recovery deep link. */}
      <Stack.Screen name="auth/confirm" options={{ title: "Opening…" }} />

      {/* Guarded by session, not by !session: following a recovery link
          signs the user in first, so they arrive here already
          authenticated and just need to choose a new password. */}
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="reset-password" options={{ title: "New password" }} />
      </Stack.Protected>
    </Stack>
  );
}
