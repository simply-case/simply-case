import * as Linking from "expo-linking";

/**
 * Expo's `Linking.useURL()` only starts listening for the native 'url'
 * event once a component using the hook has mounted. That's fine for a
 * cold app start (the OS-delivered URL is retrievable later via
 * `getInitialURL()`), but it silently drops a link that arrives while the
 * app is already open and mid-navigation — exactly what happens on a
 * password-reset deep link: tap the link, expo-router's own linking
 * listener fires and navigates to `auth/confirm`, and only THEN does that
 * screen mount and subscribe. The one-shot 'url' event has already been
 * dispatched to whichever listeners existed at that moment, ours wasn't
 * one of them, and `useURL()` falls back to `getInitialURL()` — the URL
 * the app was ORIGINALLY launched with (Expo Go's own launch link, not the
 * recovery link) — which auth/confirm.tsx then correctly reports as
 * missing tokens, i.e. "invalid or expired," even though the real link was
 * fine.
 *
 * Fix: subscribe here, at module load time. `_layout.tsx` imports this
 * module for its side effect before any screen mounts or navigates, so
 * the listener is already registered no matter whether the link arrives
 * as a cold start or while the app is open.
 */
let latestUrl: string | null = null;
const listeners = new Set<(url: string) => void>();

Linking.getInitialURL().then((url) => {
  if (url && !latestUrl) {
    latestUrl = url;
    listeners.forEach((fn) => fn(url));
  }
});

Linking.addEventListener("url", ({ url }) => {
  latestUrl = url;
  listeners.forEach((fn) => fn(url));
});

/** The most recent deep link seen since app start, if any. */
export function getLatestDeepLink(): string | null {
  return latestUrl;
}

/** Notified with every deep link from the moment of subscription onward. */
export function subscribeToDeepLinks(fn: (url: string) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
