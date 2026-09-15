/**
 * Design tokens shared by web (Tailwind theme + CSS vars) and mobile
 * (StyleSheet values). One source of truth so a color/spacing change
 * doesn't have to be made twice and can't silently drift between platforms.
 *
 * Design direction: "warm official" (revised 2026-09-15, replacing the
 * cooler "crisp & official" pass from 2026-09-11 — this is now the SECOND
 * revision, from the user's own reference design). A warm cream background
 * instead of cool gray, softer/rounder radii, and a two-color accent
 * system: `accent` (institutional navy, sampled from the Simply Case logo,
 * apps/mobile/assets/icon.PNG, #0C3D81) stays reserved for primary
 * buttons/filled controls, while the new `link` token (a brighter,
 * approachable blue) is for tappable text — "Forgot password?", "Create
 * account", inline links — so a button and a text link never look like the
 * same affordance. Still legal/government-adjacent, but the earlier
 * "crisp/cool" pass read as colder than intended.
 *
 * The ORIGINAL brief still governs every choice: this app is opened by
 * someone anxious about an immigration case. No alarm-red for ordinary
 * states, and a pending status should never *look* like bad news. Official
 * can still be reassuring (see: Mercury, well-run government portals) —
 * that tension is the thing to keep checking against, not resolve once and
 * forget.
 */

export const colors = {
  light: {
    bg: "#FAF3E9",
    surface: "#FFFFFF",
    surfaceMuted: "#F4ECDF",
    border: "#E6DCC9",
    borderStrong: "#D2C4A9",
    text: "#1C2230",
    textMuted: "#6B6558",
    textFaint: "#9A9284",
    accent: "#0C3D81", // brand navy, sampled from the logo — reserved for buttons/filled controls
    accentText: "#FFFFFF",
    link: "#2554C7", // brighter blue, distinct from `accent` — for tappable text only
    danger: "#B3492F", // muted terracotta, not saturated red — reserved for real errors
    dangerBg: "#FBEEEA",
  },
  dark: {
    bg: "#0B0F16",
    surface: "#141A24",
    surfaceMuted: "#1C2330",
    border: "#2A3242",
    borderStrong: "#3B4457",
    text: "#EDEFF3",
    textMuted: "#9AA4B5",
    textFaint: "#6B7484",
    accent: "#6FA0E0", // lightened brand navy — #0C3D81 reads too dark on a dark ground
    accentText: "#08172E",
    link: "#7FA8F5",
    danger: "#E08A70",
    dangerBg: "#2E1E17",
  },
} as const;

/**
 * Status classes, not raw status strings. USCIS/EOIR/CEAC text is free-form
 * ("Case Was Received", "Request for Evidence Was Sent", ...) so this is a
 * fixed small vocabulary every provider's text gets mapped into by
 * classifyStatus() (see status.ts) — the thing every screen actually renders
 * against, so status color/icon logic lives in exactly one place.
 *
 * Deliberately NOT using red/green semantics: "approved" and "actionNeeded"
 * both matter, but this is someone's immigration case, not a build pipeline.
 * Legibility comes from icon + label + a restrained color shift, never color
 * alone (accessibility: don't make this the only channel of information).
 */
export const statusClasses = ["pending", "inProgress", "actionNeeded", "approved", "denied", "unknown"] as const;
export type StatusClass = (typeof statusClasses)[number];

export const statusColors: Record<StatusClass, { light: string; dark: string; bg: { light: string; dark: string } }> = {
  pending: {
    light: "#8A6D3B", dark: "#D9B876",
    bg: { light: "#F7F0E3", dark: "#2E2717" },
  },
  inProgress: {
    light: "#2F5D50", dark: "#7FB0A0",
    bg: { light: "#EAF1EE", dark: "#1B2621" },
  },
  actionNeeded: {
    light: "#8A4B2F", dark: "#E0A17A",
    bg: { light: "#F7EDE4", dark: "#2E2117" },
  },
  approved: {
    light: "#3D6B3F", dark: "#8FC492",
    bg: { light: "#EBF3EB", dark: "#1C2A1D" },
  },
  denied: {
    light: "#8A3B3B", dark: "#D98F8F",
    bg: { light: "#F7E9E9", dark: "#2E1B1B" },
  },
  unknown: {
    light: "#6B6863", dark: "#B0ABA2",
    bg: { light: "#F3F2F0", dark: "#26241E" },
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// Softer again for "warm official" (was 4/8/10/14) — inputs and buttons
// get a noticeably rounded corner, matching the reference design, while
// staying short of the fully pill-shaped extreme.
export const radii = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

/**
 * Type scale. Sizes only — platform-specific weight/lineHeight application
 * lives in each app's own primitives (mobile StyleSheet, web Tailwind
 * classes) since the two platforms express "semibold" differently.
 */
export const fontSize = {
  xs: 12,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
} as const;

export const shadow = {
  // Tightened for "crisp & official" — mostly flat, structure comes from
  // the border color instead of elevation. Shadow is now a subtle hint,
  // not the thing separating a card from the page.
  card: {
    light: { shadowColor: "#111827", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
    dark: { shadowColor: "#000000", shadowOpacity: 0.3, shadowRadius: 6, shadowOffset: { width: 0, height: 1 } },
  },
} as const;
