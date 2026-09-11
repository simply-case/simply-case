import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import * as Linking from "expo-linking";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "@/lib/supabase";

/**
 * There is no browser URL bar on native, so this screen exists to do what
 * the web app's route handler (apps/web/src/app/auth/confirm/route.ts) does
 * server-side: turn the tokens embedded in the magic-link deep link into a
 * real session.
 *
 * The tokens arrive in the URL FRAGMENT (#access_token=...&refresh_token=...),
 * not the query string, which is why this reads the raw URL via
 * Linking.useURL() and parses it with expo-auth-session's QueryParams helper
 * (its second argument specifically parses the fragment) rather than
 * useLocalSearchParams() — Expo Router's own param matching is built for
 * path/query params and won't reliably surface fragment values. This is the
 * pattern documented at supabase.com/docs/guides/auth/native-mobile-deep-linking,
 * and it's a real difference from the PKCE `code`-exchange flow the web app
 * uses, not two implementations of the same thing.
 */
export default function AuthConfirmScreen() {
  const url = Linking.useURL();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (!url || handled.current) return;
    handled.current = true;

    const { params, errorCode } = QueryParams.getQueryParams(url);

    if (errorCode) {
      setError(errorCode);
      return;
    }

    const { access_token, refresh_token } = params;
    if (!access_token || !refresh_token) {
      setError("That link is invalid or has expired.");
      return;
    }

    supabase.auth.setSession({ access_token, refresh_token }).then(({ error: sessionError }) => {
      if (sessionError) {
        setError(sessionError.message);
        return;
      }
      // AuthProvider's onAuthStateChange listener picks up the new session
      // from setSession() above; Stack.Protected in the root layout then
      // swaps to the (app) group on its own. These replaces just clear
      // auth/confirm off the stack so back-navigation can't return to it.
      //
      // A recovery link signs the user in like any other, so without this
      // branch they'd land on the dashboard and never be asked for the new
      // password they came here to set.
      router.replace(params.type === "recovery" ? "/reset-password" : "/");
    });
  }, [url]);

  return (
    <View style={styles.container}>
      {error ? (
        <>
          <Text style={styles.errorTitle}>Sign-in failed</Text>
          <Text style={styles.errorText}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator />
          <Text style={styles.text}>Signing you in…</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  text: { fontSize: 14, color: "#666" },
  errorTitle: { fontSize: 16, fontWeight: "600" },
  errorText: { fontSize: 14, color: "#dc2626", textAlign: "center" },
});
