/**
 * Parsing and formatting for EOIR (immigration court) case data, from
 * ACIS's GetCaseInfo API.
 *
 * Lives in `shared` rather than beside the screen that uses it for one
 * reason: TESTABILITY. The test runner only picks up
 * `packages/shared/src/*.test.ts` and `supabase/functions/_shared/*.test.ts`
 * (see the root `test` script), so logic buried in a .tsx screen can never
 * be covered. This is the half of EOIR most worth locking down — it turns
 * a government API response into the hearing date someone plans their life
 * around, and a silent misparse there is the worst failure this app has.
 * See eoir.test.ts, which pins it against a REAL captured response.
 */
/**
 * ACIS's GetCaseInfo response shape, reverse-engineered from ONE real
 * successful response (2026-09-21, the user's own case) — every field is
 * optional/nullable because a single sample can't confirm what's always
 * present. Field meanings not confirmed by EOIR documentation are shown
 * as their raw codes rather than translated (e.g. CaseType "RMV",
 * ClockStatus "R") — guessing at a code's meaning risks stating something
 * false as fact, the same principle as CEAC's status relay.
 */
export interface EoirCaseInfoResponse {
  Data?: {
    ValidAlienNumber?: boolean;
    AlienName?: string | null;
    CaseID?: number | null;
    OSC_Date?: string | null;
    ElapsedDays?: string | null;
    LatestHearingDate?: string | null;
    LatestHearingTime?: string | null;
    DocketDate?: string | null;
    CaseDecisionString?: string | null;
    MTRDecisionString?: string | null;
    ReopenDecisionString?: string | null;
    AppealDecisionString?: string | null;
    AppealFiled?: boolean;
    ReopenExists?: boolean;
    PendingAtBIA?: boolean;
  } | null;
  Proceeding?: {
    CaseType?: string | null;
    HearingLocationAddress?: string | null;
  } | null;
  Schedule?: {
    AdjDate?: string | null;
    AdjTime?: string | null;
    IJ_Name?: string | null;
    IJ_WebExURLLink?: string | null;
    HearingLocationAddress?: string | null;
    /** "M" seen in the one real sample — "Master Calendar" is standard,
     * well-documented EOIR terminology (vs. "I" for Individual/Merits),
     * so CAL_TYPE_LABELS translates it. An unrecognized code falls back
     * to showing the raw value rather than a made-up label. */
    CalType?: string | null;
    /** "P" seen in the one real sample. Unlike CalType, EOIR doesn't
     * publicly document these letters as clearly — HEARING_MEDIUM_LABELS
     * is a reasonable guess (P/V/W/T for person/video/webex/telephonic,
     * the mediums EOIR is known to use), not a confirmed mapping. An
     * unrecognized code shows the raw value. */
    HearingMedium?: string | null;
  } | null;
}

/** "Master Calendar" vs "Individual (Merits) Calendar" is standard,
 * well-established immigration court terminology — confident enough to
 * translate outright. */
export const CAL_TYPE_LABELS: Record<string, string> = {
  M: "Master Calendar",
  I: "Individual (Merits) Calendar",
};

/** Best-effort guess, NOT confirmed by EOIR documentation — see the
 * HearingMedium comment on EoirCaseInfoResponse above. */
export const HEARING_MEDIUM_LABELS: Record<string, string> = {
  P: "in person",
  V: "by video",
  W: "by WebEx",
  T: "by telephone",
};

/**
 * "Your next Master Calendar hearing is in person on January 12, 2027 at
 * 8:30 AM." — the single most important sentence on this screen. Returns
 * null (never a half-built sentence) if there's no hearing date to anchor
 * it to.
 */
export function formatEoirHeadline(res: EoirCaseInfoResponse): string | null {
  const when = formatEoirDate(
    res.Schedule?.AdjDate ?? res.Data?.LatestHearingDate,
    res.Schedule?.AdjTime ?? res.Data?.LatestHearingTime,
  );
  if (!when) return null;
  const calCode = res.Schedule?.CalType;
  const kind = calCode ? `${CAL_TYPE_LABELS[calCode] ?? calCode} hearing` : "hearing";
  // An unrecognized medium code is left OUT of the sentence rather than
  // spliced in raw — "your next hearing is (Z) on January 12" reads like a
  // bug. The code isn't lost: formatEoirResult surfaces it as its own row
  // so the information is still there, just not pretending to be English.
  const mediumLabel = res.Schedule?.HearingMedium ? HEARING_MEDIUM_LABELS[res.Schedule.HearingMedium] : undefined;
  const mediumPart = mediumLabel ? ` ${mediumLabel}` : "";
  return `Your next ${kind} is${mediumPart} on ${when}.`;
}

export interface EoirResultRow {
  label: string;
  value: string;
}

export function formatEoirDate(dateIso?: string | null, time?: string | null): string | null {
  if (!dateIso) return null;
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return time ? `${dateIso} ${time}` : dateIso;
  const dateStr = d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return time ? `${dateStr} at ${time}` : dateStr;
}

/**
 * ACIS's HearingLocationAddress is pipe-delimited, and courts with 3
 * segments repeat the city — e.g. "SEATTLE, WASHINGTON|915 2ND AVENUE,
 * SUITE 613|SEATTLE, WA 98174": segment 1 is a spelled-out city/state
 * name, segment 3 is the actual mailing line (street city/state/zip
 * already covers it). Confirmed on device, 2026-09-22 — showed as
 * "SEATTLE, WASHINGTON, 915 2ND AVENUE, SUITE 613, SEATTLE, WA 98174"
 * before this fix. Drops segment 1 only when its city matches segment 3's
 * — courts with a genuinely different first line (not just a repeated
 * city name) keep all their segments.
 */
export function formatEoirAddress(raw?: string | null): string | null {
  if (!raw) return null;
  const parts = raw
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 3) {
    // `shared` compiles with stricter index checking than the mobile app
    // does, which is what surfaced these as possibly-undefined when this
    // moved here — the guards are real, not ceremony: a segment could be
    // an empty string before .filter(Boolean) ran, and indexing past the
    // end is a plain runtime error.
    const cityOf = (segment: string | undefined) => segment?.split(",")[0]?.trim().toLowerCase() ?? "";
    const firstCity = cityOf(parts[0]);
    const lastCity = cityOf(parts[parts.length - 1]);
    if (firstCity !== "" && firstCity === lastCity) parts.shift();
  }
  return parts.join(", ");
}

/**
 * Turns the raw API response into what gets SAVED (statusText, a short
 * canonical phrase — see EOIR_STATUS_CLASS in packages/shared/src/status.ts
 * for what each one classifies to; statusDetail, the long human sentence)
 * plus a list of "everything else" rows: decisions, appeal/reopen flags,
 * the hearing link. Name, A-Number, docket date, the headline hearing
 * sentence, judge and court address are NOT in `rows` — the screen renders
 * those directly as dedicated fields in a fixed order per the user's
 * request, not as a generic label/value list.
 *
 * statusText is deliberately SHORT and from a small controlled vocabulary
 * — an earlier version tried to save the whole multi-line summary as the
 * status and pattern-match it for classification, which is exactly the
 * fragile "guess at a paragraph" approach the rest of this app avoids
 * (see status.ts's own header comment on why CEAC uses exact short
 * strings). Two fields, like USCIS's status_text_en/status_detail_en
 * split, not one long one.
 *
 * Deliberately does NOT include the applicant's name in what's SAVED —
 * it's the user's own case, they know their own name, and there's no
 * reason to put a piece of PII into stored status text with no benefit
 * (it's still shown live on this screen, just not persisted this way).
 */
export function formatEoirResult(
  res: EoirCaseInfoResponse,
): { statusText: string; statusDetail: string; rows: EoirResultRow[] } {
  const rows: EoirResultRow[] = [];
  const lines: string[] = [];

  if (res.Data?.ValidAlienNumber === false) {
    return {
      statusText: "No information found",
      statusDetail: "The court's system didn't recognize this A-Number and nationality combination.",
      rows: [],
    };
  }

  const headline = formatEoirHeadline(res);
  if (headline) lines.push(headline);

  const location = formatEoirAddress(res.Schedule?.HearingLocationAddress ?? res.Proceeding?.HearingLocationAddress);
  if (location) lines.push(`Location: ${location}`);
  if (res.Schedule?.IJ_Name) lines.push(`Judge: ${res.Schedule.IJ_Name}`);

  // "P" is confidently "in person" (see HEARING_MEDIUM_LABELS) — no point
  // showing a WebEx link for a hearing that isn't virtual. Still shown
  // when the medium is unrecognized/missing, since hiding it would risk
  // losing a genuinely virtual hearing's link on an uncertain guess.
  if (res.Schedule?.IJ_WebExURLLink && res.Schedule?.HearingMedium !== "P") {
    rows.push({ label: "Hearing link", value: res.Schedule.IJ_WebExURLLink });
  }

  // Only when we couldn't translate it (see formatEoirHeadline) — a
  // recognized medium is already stated in the headline sentence, so
  // repeating it here would be noise.
  const mediumCode = res.Schedule?.HearingMedium;
  if (mediumCode && !HEARING_MEDIUM_LABELS[mediumCode]) {
    rows.push({ label: "Hearing medium", value: mediumCode });
  }

  const decisions: Array<[string, string | null | undefined]> = [
    ["Case decision", res.Data?.CaseDecisionString],
    ["Motion decision", res.Data?.MTRDecisionString],
    ["Reopened case decision", res.Data?.ReopenDecisionString],
    ["Appeal decision", res.Data?.AppealDecisionString],
  ];
  let hasDecision = false;
  for (const [label, value] of decisions) {
    if (value) {
      rows.push({ label, value });
      lines.push(`${label}: ${value}`);
      hasDecision = true;
    }
  }

  if (res.Data?.AppealFiled) lines.push("An appeal has been filed.");
  if (res.Data?.PendingAtBIA) lines.push("Pending at the Board of Immigration Appeals.");
  if (res.Data?.ReopenExists) lines.push("A motion to reopen exists on this case.");

  const hasAppealOrMotion = Boolean(res.Data?.AppealFiled || res.Data?.PendingAtBIA || res.Data?.ReopenExists);

  // Priority order, most specific/certain first — mirrors classifyStatus's
  // own "most specific pattern wins" philosophy (status.ts).
  let statusText: string;
  if (hasDecision) {
    statusText = "Decision issued";
  } else if (hasAppealOrMotion) {
    statusText = "Appeal or motion pending";
  } else if (headline) {
    statusText = "Hearing scheduled";
  } else {
    statusText = "No information found";
    lines.push("The court returned a response, but we couldn't find a hearing date or decision in it — check the details below.");
  }

  return { statusText, statusDetail: lines.join("\n"), rows };
}
