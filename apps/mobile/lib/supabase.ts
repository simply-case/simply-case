import "react-native-url-polyfill/auto";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@mycasepro/shared";

/**
 * SecureStore backs the session (Keychain / Keystore) rather than
 * AsyncStorage — this holds a refresh token, which is a long-lived
 * credential, not throwaway UI state.
 *
 * SecureStore's API is callback/promise-based per key, so it's adapted to
 * the sync-shaped storage interface supabase-js expects; getItem specifically
 * must never throw on a missing key (it must resolve null), or the client's
 * initial session bootstrap treats a normal "logged out" state as an error.
 */
const SecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
      "Expo only inlines env vars prefixed EXPO_PUBLIC_ at build time — see apps/mobile/.env.example.",
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    // There's no browser URL bar on native — the magic-link redirect arrives
    // as a deep link we parse ourselves in app/auth/confirm.tsx, not as a
    // URL the client can inspect directly.
    detectSessionInUrl: false,
  },
});

// supabase-js's own refresh timer keeps running while the app is backgrounded
// unless told otherwise, burning battery and risking a refresh call the OS
// has no guarantee of letting complete. Tie it to app foreground/background
// state instead — the standard React Native pattern for this client.
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
