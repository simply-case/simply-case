import { Alert, Linking } from "react-native";
import { LEGAL_CONTACT_EMAIL } from "@mycasepro/shared";

// The public copies of the legal documents. The APP no longer opens these
// — it renders the same text natively from packages/shared/src/legal.ts
// (app/legal/[doc].tsx). These URLs still matter because App Store and
// Play Store review require a reachable terms/privacy URL for the store
// listing, and a reviewer is never signed in.
export const TERMS_URL = "https://simply-case-web.vercel.app/legal/terms";
export const PRIVACY_URL = "https://simply-case-web.vercel.app/legal/privacy";

/**
 * Where "Contact us" and "Send feedback" emails go.
 *
 * Re-exported from packages/shared so there is exactly ONE definition of
 * this address across web and mobile — it used to be declared separately
 * in both, which meant the launch blocker had to be remembered twice.
 * Still a placeholder; see LEGAL_CONTACT_EMAIL for the warning.
 */
export const CONTACT_EMAIL = LEGAL_CONTACT_EMAIL;

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
