import { LEGAL_LAST_UPDATED } from "@mycasepro/shared";
import { supabase } from "./supabase";

/**
 * Whether this account needs to actively reconsent to the current policy —
 * see migration 0019_legal_reconsent.sql for why `legal_accepted_at` exists
 * at all (USCIS's app-review requirement for active consent to policy
 * changes, not just "kept using the app").
 *
 * Fails OPEN (returns false) on any error. A locked-out app because this
 * one read failed would be a far worse outcome than occasionally missing a
 * reconsent prompt — this is a compliance nicety, not a security boundary.
 */
export async function checkNeedsLegalReconsent(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("legal_accepted_at")
      .eq("id", userId)
      .single();

    if (error || !data) return false;
    if (!data.legal_accepted_at) return true;

    return new Date(data.legal_accepted_at) < new Date(LEGAL_LAST_UPDATED);
  } catch {
    return false;
  }
}

/** Records that this account has actively agreed to the CURRENT policy. */
export async function recordLegalAcceptance(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ legal_accepted_at: new Date().toISOString() })
    .eq("id", userId);

  if (error) throw error;
}
