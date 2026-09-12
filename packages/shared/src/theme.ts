/**
 * Design tokens shared by web (Tailwind theme + CSS vars) and mobile
 * (StyleSheet values). One source of truth so a color/spacing change
 * doesn't have to be made twice and can't silently drift between platforms.
 *
 * Design intent: this app is opened by someone anxious about an immigration
 * case. That's the brief behind every choice here — quiet color, no
 * alarm-red for ordinary states, generous spacing over density. A pending
 * status should never *look* like bad news.
 */

export const colors = {
  light: {
    bg: "#FAFAF9",
    surface: "#FFFFFF",
    surfaceMuted: "#F3F2F0",
    border: "#E7E5E2",
    borderStrong: "#D6D3CE",
    text: "#1C1B1A",
    textMuted: "#6B6863",
    textFaint: "#9B9792",
    accent: "#2F5D50", // deep, quiet green — not corporate blue, not alarm-anything
    accentText: "#FFFFFF",
    danger: "#B3492F", // muted terracotta, not saturated red — reserved for real errors
    dangerBg: "#FBEEEA",
  },
  dark: {
    bg: "#15140F",
    surface: "#1E1D18",
    surfaceMuted: "#26241E",
    border: "#33312A",
    borderStrong: "#403D34",
    text: "#F2F0EC",
    textMuted: "#B0ABA2",
    textFaint: "#78746C",
    accent: "#7FB0A0",
    accentText: "#0F1A16",
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

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
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
  // Single soft elevation used app-wide — this is a calm, flat product, not
  // one that reaches for depth to signal importance.
  card: {
    light: { shadowColor: "#1C1B1A", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
    dark: { shadowColor: "#000000", shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  },
} as const;
