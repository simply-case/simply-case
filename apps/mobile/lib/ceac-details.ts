import * as SecureStore from "expo-secure-store";

/**
 * The passport number, surname and (for a DS-160/NIV case) consulate
 * location CEAC's form asks for on every single lookup. Stored ONLY in
 * iOS/Android secure storage (the Keychain / Keystore), keyed per
 * tracked_case_id — NEVER sent to Supabase, logged, or included in any
 * crash report. This is a deliberate product decision (docs/HANDOFF.md
 * §5): if our server never holds this, a server bug can never leak it.
 * The cost is that it lives on this one device only — a reinstall or a
 * new phone means re-entering it once.
 *
 * Keyed per case rather than per user, since a person may track more than
 * one case (their own and a family member's) with different applicants.
 */
export interface CeacDetails {
  passportNumber: string;
  surname: string;
  /** Only meaningful for nonimmigrant (DS-160) cases — CEAC's NIV form
   * has a "Select a location" dropdown the IV form doesn't. Stores the
   * consulate CODE (e.g. "MTL"), the actual `<option value>` on CEAC's
   * #Location_Dropdown (see lib/ceac-locations.ts) — not the display
   * label, so it can be set directly by value with no text matching. */
  location: string | null;
}

function storageKey(trackedCaseId: string): string {
  return `ceac_details_${trackedCaseId}`;
}

export async function getCeacDetails(trackedCaseId: string): Promise<CeacDetails | null> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey(trackedCaseId));
    if (!raw) return null;
    return JSON.parse(raw) as CeacDetails;
  } catch {
    // A corrupted or unreadable entry should degrade to "not saved yet",
    // not crash the refresh screen.
    return null;
  }
}

export async function saveCeacDetails(trackedCaseId: string, details: CeacDetails): Promise<void> {
  await SecureStore.setItemAsync(storageKey(trackedCaseId), JSON.stringify(details));
}

export async function deleteCeacDetails(trackedCaseId: string): Promise<void> {
  await SecureStore.deleteItemAsync(storageKey(trackedCaseId));
}
