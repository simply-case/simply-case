import { Redirect } from "expo-router";

/**
 * A Tabs layout, unlike a Stack, does NOT automatically map "/" to its
 * first declared Tabs.Screen — there's no implicit index. This file exists
 * only to give "/" (and therefore router.replace("/"), used by
 * reset-password.tsx and auth/confirm.tsx before this file existed) a real
 * destination. Hidden from the tab bar via `href: null` in
 * (app)/_layout.tsx's `Tabs.Screen name="index"` — it should never appear
 * as a fifth tab.
 */
export default function AppIndexRedirect() {
  return <Redirect href="/cases" />;
}
