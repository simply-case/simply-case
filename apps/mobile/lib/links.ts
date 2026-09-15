import { Alert, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";

// The web app hosts the actual legal text (see sign-in.tsx for the same
// pattern) — one place to keep it accurate.
export const TERMS_URL = "https://simply-case-web.vercel.app/legal/terms";
export const PRIVACY_URL = "https://simply-case-web.vercel.app/legal/privacy";

/**
 * Where "Contact us" and "Send feedback" emails go.
 *
 * PLACEHOLDER — mirrors LEGAL_CONTACT_EMAIL in apps/web/src/lib/legal.ts,
 * which is also still a placeholder. Replace BOTH with the real address
 * (docs/HANDOFF.md §3, launch blocker). Never put a personal address here:
 * the repo is public.
 */
export const CONTACT_EMAIL = "contact@REPLACE-BEFORE-LAUNCH.invalid";

export function openLegalPage(url: string) {
  return WebBrowser.openBrowserAsync(url);
}

/** Opens the user's mail app with a pre-filled subject. Shows an alert
 * instead while the address is still the placeholder, rather than handing
 * the mail app an address that can never deliver. */
export async function openContactEmail(subject: string) {
  if (CONTACT_EMAIL.endsWith(".invalid")) {
    Alert.alert("Not available yet", "The contact email hasn't been set up yet.");
    return;
  }
  const url = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("No mail app found", `You can email us at ${CONTACT_EMAIL}.`);
  }
}
