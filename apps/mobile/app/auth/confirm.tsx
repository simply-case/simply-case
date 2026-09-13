import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { router } from "expo-router";
import * as QueryParams from "expo-auth-session/build/QueryParams";
import { supabase } from "@/lib/supabase";
import { useTheme } from "@/lib/theme";
import { getLatestDeepLink, subscribeToDeepLinks } from "@/lib/deep-link";

// How long to wait for a valid link before giving up. Generous because on
// a warm app start the link this screen wants may already have been
// consumed by expo-router's own navigation before we even needed it —
// getLatestDeepLink() covers that — but this also has to allow for a
// legitimately bad/expired link, which never arrives at all.
const NO_LINK_TIMEOUT_MS = 4000;

/**
 * There is no browser URL bar on native, so this screen exists to do what
 * the web app's route handler (apps/web/src/app/auth/confirm/route.ts) does
 * server-side: turn the tokens embedded in the magic-link deep link into a
 * real session.
 *
 * The tokens arrive in the URL FRAGMENT (#access_token=...&refresh_token=...),
 * not the query string, which is why this reads the raw URL via
 * lib/deep-link.ts (see that file for why NOT `Linking.useURL()`) and
 * parses it with expo-auth-session's QueryParams helper (its second
 * argument specifically parses the fragment) rather than
 * useLocalSearchParams() — Expo Router's own param matching is built for
 * path/query params and won't reliably surface fragment values. This is the
 * pattern documented at supabase.com/docs/guides/auth/native-mobile-deep-linking,
 * and it's a real difference from the PKCE `code`-exchange flow the web app
 * uses, not two implementations of the same thing.
 */
export default function AuthConfirmScreen() {
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    function tryHandle(url: string) {
      if (handled.current) return;

      const { params, errorCode } = QueryParams.getQueryParams(url);

      if (errorCode) {
        handled.current = true;
        setError(errorCode);
        return;
      }

      const { access_token, refresh_token } = params;
      if (!access_token || !refresh_token) {
        // Not every URL this screen sees necessarily carries the recovery
        // tokens (e.g. expo-router's own initial-route bookkeeping) — keep
        // waiting rather than failing on the first one. NO_LINK_TIMEOUT_MS
        // below is what actually catches a genuinely bad/expired link.
        return;
      }

      handled.current = true;
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
        // password they came here to set. "/" redirects to "/cases" — see
        // the note in reset-password.tsx.
        router.replace(params.type === "recovery" ? "/reset-password" : "/");
      });
    }

    const existing = getLatestDeepLink();
    if (existing) tryHandle(existing);

    const unsubscribe = subscribeToDeepLinks(tryHandle);
    const timeout = setTimeout(() => {
      if (!handled.current) {
        handled.current = true;
        setError("That link is invalid or has expired.");
      }
    }, NO_LINK_TIMEOUT_MS);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const { colors, spacing, fontSize } = useTheme();

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md, backgroundColor: colors.bg }}>
      {error ? (
        <>
          <Text style={{ fontSize: fontSize.md, fontWeight: "600", color: colors.text }}>Sign-in failed</Text>
          <Text style={{ fontSize: fontSize.base, color: colors.danger, textAlign: "center" }}>{error}</Text>
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ fontSize: fontSize.base, color: colors.textMuted }}>Signing you in…</Text>
        </>
      )}
    </View>
  );
}
