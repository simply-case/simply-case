import * as SecureStore from "expo-secure-store";

/**
 * The nationality EOIR's ACIS lookup asks for on every single search,
 * alongside the A-Number. Stored ONLY in iOS/Android secure storage,
 * keyed per tracked_case_id — never sent to Supabase — same reasoning
 * and pattern as lib/ceac-details.ts. The A-Number itself is NOT stored
 * here: it's the case_key, already held server-side (needed to identify/
 * track the case at all), the same way a USCIS receipt number is.
 */
export interface EoirDetails {
  /** EOIR's own nationality CODE (e.g. "IN" for India), not the display
   * name — see lib/eoir-nationalities.ts. Stored as the code so autofill
   * can match ACIS's dropdown option exactly rather than by text, and so
   * it's already in the shape their API's `natCode` parameter wants. */
  nationalityCode: string;
}

function storageKey(trackedCaseId: string): string {
  return `eoir_details_${trackedCaseId}`;
}

export async function getEoirDetails(trackedCaseId: string): Promise<EoirDetails | null> {
  try {
    const raw = await SecureStore.getItemAsync(storageKey(trackedCaseId));
    if (!raw) return null;
    return JSON.parse(raw) as EoirDetails;
  } catch {
    return null;
  }
}

export async function saveEoirDetails(trackedCaseId: string, details: EoirDetails): Promise<void> {
  await SecureStore.setItemAsync(storageKey(trackedCaseId), JSON.stringify(details));
}

export async function deleteEoirDetails(trackedCaseId: string): Promise<void> {
  await SecureStore.deleteItemAsync(storageKey(trackedCaseId));
}
