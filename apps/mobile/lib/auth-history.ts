import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Tracks whether THIS DEVICE has ever completed a real sign-in or sign-up —
 * separate from whether a session currently exists.
 *
 * Why a separate flag, rather than just checking for a session: a brand-new
 * install and a signed-out returning user are both "no session right now",
 * but they should land on different default screens — a new user should
 * see Create account first, a returning one should see Sign in. The
 * session itself can't tell those apart once it's cleared, so this flag has
 * to survive sign-out on purpose (never cleared by lib/auth-context.tsx's
 * signOut()), unlike the session credentials in lib/supabase.ts.
 *
 * Plain AsyncStorage, not SecureStore: this is a non-secret UI preference
 * (a boolean), not a credential, so Keychain/Keystore would be overkill —
 * SecureStore is reserved elsewhere in this app for things like CEAC/EOIR
 * passport details that are actually sensitive.
 */
const KEY = "ever_authenticated";

export async function hasEverAuthenticated(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(KEY)) === "true";
  } catch {
    // Default to false (the "new user" assumption) rather than let a
    // storage read failure block app startup.
    return false;
  }
}

export async function markEverAuthenticated(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, "true");
  } catch {
    // Best-effort: worst case, this device asks "Create account?" again
    // next time it's signed out, which is a cosmetic miss, not a bug worth
    // surfacing to the user.
  }
}
