import type { StatusClass } from "./theme";

/**
 * Maps a provider's free-form status text into one of a fixed small set of
 * StatusClasses (see theme.ts) so the UI has exactly one thing to render
 * against, regardless of which of USCIS's ~40 documented status strings (or
 * a future EOIR/CEAC one) actually comes back.
 *
 * Ordering is the whole design here, and it is load-bearing: USCIS status
 * text routinely contains a phrase that belongs to one class inside a
 * sentence that means another ("Case Closed Because You Did Not Respond To
 * A Request For Evidence" contains "request for evidence" but is an
 * outcome, not a to-do). So the checks run most-specific-first, and the
 * "already handled" patterns run before the pattern they'd otherwise be
 * swallowed by.
 *
 * The bias when uncertain is toward `unknown`, NOT toward a guess: the UI
 * falls back to showing the provider's raw text with neutral treatment,
 * which is always safer than mislabeling someone's immigration case. In
 * particular a false `actionNeeded` is the worst outcome this function can
 * produce — it tells an anxious person to act when nothing is required of
 * them — so that branch is kept deliberately narrow.
 *
 * Coverage is NOT complete and isn't claimed to be. It was checked against
 * the status strings in supabase/functions/_shared/uscis.fixtures.ts plus a
 * wider list of commonly-seen USCIS statuses; anything unmatched degrades
 * to `unknown` by design rather than by omission.
 */
export function classifyStatus(statusText: string | null | undefined): StatusClass {
  if (!statusText) return "unknown";
  const s = statusText.toLowerCase();

  // --- Terminal negative outcomes -----------------------------------------
  // First, because a denial/closure notice frequently also names the thing
  // that was missed ("...Because You Did Not Respond To A Request For
  // Evidence") or the remedy ("...An Appeal May Be Filed"), either of which
  // would otherwise be claimed by the actionNeeded branch below and shown
  // as a to-do on a case that is already over.
  if (
    /\b(denied|rejected|terminated|revoked|withdrawn|withdrawal|abandoned)\b/.test(s) ||
    /\bcase (was )?closed\b/.test(s)
  ) {
    return "denied";
  }

  // --- Terminal positive outcomes -----------------------------------------
  // Card/document delivery statuses are the most common "it actually
  // worked" signal for green card and EAD cases, and USCIS expresses
  // delivery several different ways (mailed / delivered / picked up by the
  // Postal Service), so all of them are matched rather than just "mailed".
  if (
    /\b(approved|approval)\b/.test(s) ||
    /\b(card|document|notice) was (mailed|delivered|picked up)\b/.test(s) ||
    /\bwas picked up by the united states postal service\b/.test(s) ||
    /\bcase was (completed|resolved)\b/.test(s) ||
    /\boath ceremony\b/.test(s)
  ) {
    return "approved";
  }

  // --- Applicant has already acted ----------------------------------------
  // Must precede actionNeeded. "Response To USCIS' Request For Evidence Was
  // Received" contains "request for evidence", but the applicant has
  // already done the thing — showing "Action needed" there would tell
  // someone to redo work they've completed, which is the single most
  // misleading thing this classifier could say.
  if (
    /\bresponse to\b.*\bwas received\b/.test(s) ||
    /\b(evidence|document|correspondence) was received\b/.test(s)
  ) {
    return "inProgress";
  }

  // --- Something is genuinely required of the applicant -------------------
  // Kept narrow on purpose (see the false-actionNeeded note above).
  if (
    /\b(request for evidence|rfe|notice to appear|intent to deny|intent to revoke)\b/.test(s) ||
    /\b(biometrics? (appointment|services) (was |is )?(scheduled|required))\b/.test(s) ||
    /\binterview (was |is )?(scheduled|required)\b/.test(s) ||
    /\baction (is |was )?required\b/.test(s) ||
    /\bresponse (is |was )?(due|required)\b/.test(s) ||
    // Undeliverable mail means USCIS has no working address for this person
    // — genuinely requires them to act, and easy to miss.
    /\bcould not (be )?deliver/.test(s)
  ) {
    return "actionNeeded";
  }

  // --- Just filed ----------------------------------------------------------
  // Before the broader inProgress patterns, since "Case Was Received" would
  // otherwise be claimed by a looser "received" match there.
  if (/\b(case was (received|filed)|initial review)\b/.test(s)) {
    return "pending";
  }

  // --- Actively moving -----------------------------------------------------
  // The largest bucket in practice; most of a case's lifetime after the
  // initial receipt is spent here.
  if (
    /\b(transferred|reopened|reissued)\b/.test(s) ||
    /\b(being (actively )?reviewed|under review)\b/.test(s) ||
    /\b(ready to be scheduled|is being produced)\b/.test(s) ||
    /\bfingerprint (fee|review)\b/.test(s)
  ) {
    return "inProgress";
  }

  // Unrecognized — the UI shows the provider's raw text plainly instead of
  // asserting a category we aren't confident of.
  return "unknown";
}

export const statusLabels: Record<StatusClass, string> = {
  pending: "Pending",
  inProgress: "In progress",
  actionNeeded: "Action needed",
  approved: "Approved",
  denied: "Denied",
  unknown: "Status",
};
