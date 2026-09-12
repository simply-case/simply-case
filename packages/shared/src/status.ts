import type { StatusClass } from "./theme";

/**
 * Maps a provider's free-form status text into one of a fixed small set of
 * StatusClasses (see theme.ts) so the UI has exactly one thing to render
 * against, regardless of which of USCIS's ~40 documented status strings (or
 * a future EOIR/CEAC one) actually comes back.
 *
 * Keyword-matched against real USCIS status text (see
 * supabase/functions/_shared/uscis.ts test fixtures for the corpus this was
 * checked against), ordered most-specific-first so "Case Was Approved" and
 * "... Approval Notice Was Mailed" both hit `approved` before any broader
 * pattern could claim them. New provider text that matches nothing falls
 * through to `unknown` rather than guessing — showing the raw status text
 * with a neutral treatment is always safer than mislabeling someone's case.
 */
export function classifyStatus(statusText: string | null | undefined): StatusClass {
  if (!statusText) return "unknown";
  const s = statusText.toLowerCase();

  // Denied/rejected/terminated — check before "action needed" patterns since
  // a denial notice can also mention next steps (e.g. appeal instructions).
  if (/\b(denied|rejected|terminated|revoked|withdrawn|abandoned)\b/.test(s)) {
    return "denied";
  }

  // Approved / completed / issued — the good-outcome terminal states.
  if (
    /\b(approved|approval)\b/.test(s) ||
    /\b(card was (mailed|produced|delivered)|document was (mailed|produced))\b/.test(s) ||
    /\bcase was (completed|resolved)\b/.test(s) ||
    /\boath ceremony\b/.test(s)
  ) {
    return "approved";
  }

  // Needs something from the applicant — the state most worth surfacing
  // distinctly, since it's the one where inaction has a real cost.
  if (
    /\b(request for evidence|rfe|notice to appear|intent to deny|intent to revoke)\b/.test(s) ||
    /\b(biometrics? (appointment|services) (was |is )?(scheduled|required))\b/.test(s) ||
    /\binterview (was |is )?(scheduled|required)\b/.test(s) ||
    /\baction (is |was )?required\b/.test(s) ||
    /\bresponse (is |was )?(due|required)\b/.test(s)
  ) {
    return "actionNeeded";
  }

  // Just filed, nothing has happened yet — checked before the broader
  // "in progress" patterns below since "Case Was Received" would otherwise
  // also match a looser "received" pattern there.
  if (/\b(case was (received|filed)|initial review)\b/.test(s)) {
    return "pending";
  }

  // Actively moving — transferred, under review, ready for decision. This
  // is the largest bucket in practice; most of a case's lifetime after the
  // initial receipt is spent here.
  if (
    /\b(transferred|reopened|reissued)\b/.test(s) ||
    /\b(being (actively )?reviewed|under review)\b/.test(s) ||
    /\b(ready to be scheduled|new card is being produced)\b/.test(s) ||
    /\bfingerprint (fee|review)\b/.test(s)
  ) {
    return "inProgress";
  }

  // A status we don't recognize the shape of at all — "unknown" so the UI
  // shows the raw text plainly instead of asserting a category we're not
  // confident of. Safer than guessing on someone's immigration case.
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
