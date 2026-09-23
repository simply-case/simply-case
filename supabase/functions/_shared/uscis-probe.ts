/**
 * USCIS 4xx probe — deliberately sends known-bad requests to the sandbox so
 * our error-handling paths generate real 4xx traffic USCIS can see on our
 * key(s).
 *
 * Why this exists: after confirming 5 clean days of sandbox traffic, USCIS's
 * reply (2026-09-22) was "we don't observe any 4xx responses on either of
 * your API keys — test that for 5 more days before applying for production
 * access." Our normal polling (check-cases) only ever asks about two valid,
 * existing sandbox receipts (see docs/HANDOFF.md), so it never had a reason
 * to produce a 4xx. This module generates that traffic on purpose.
 *
 * Deliberately bypasses UscisClient.fetchStatus()'s own local validation
 * (which refuses to send a malformed receipt at all — see uscis.ts) by
 * issuing the raw request directly. That's the point here: we WANT USCIS's
 * own 422/400 for a malformed receipt, not our own pre-flight rejection.
 *
 * Hard-pinned to the sandbox base URL — never reads USCIS_ENVIRONMENT and
 * never accepts one. If production access is later granted and that env var
 * flips to "production" elsewhere in the app, this must keep firing
 * deliberately-bad requests only at the sandbox, never at the real API on
 * the account we just got approved for.
 */
import { parseErrorResponse } from "./uscis.ts";

const SANDBOX_BASE = "https://api-int.uscis.gov";

export interface ProbeCase {
  /** Identifies this case in logs and table rows. */
  label: string;
  /** Sent as-is, NOT pre-validated — see module header. */
  receipt: string;
}

// Two deliberately-bad receipts:
//  - a well-formed receipt that simply doesn't exist -> USCIS's own 404
//  - a malformed receipt -> USCIS's own 422/400
// Both go out with a genuinely valid access token, so there's no ambiguity
// about which key the resulting 4xx is attributed to (unlike a bad-token
// 401, which we deliberately do NOT generate here — see docs/HANDOFF.md).
export const PROBE_CASES: ProbeCase[] = [
  { label: "nonexistent_receipt", receipt: "EAC9999000001" },
  { label: "malformed_receipt", receipt: "ABC123" },
];

export function isFourXx(httpStatus: number): boolean {
  return httpStatus >= 400 && httpStatus <= 499;
}

export interface ProbeAttemptResult {
  label: string;
  receipt: string;
  httpStatus: number | null;
  isFourXx: boolean;
  errorKind: string | null;
  message: string | null;
}

/**
 * Issues one raw case-status request for a known-bad receipt against an
 * already-obtained access token.
 */
export async function probeOnce(
  probeCase: ProbeCase,
  accessToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ProbeAttemptResult> {
  let res: Response;
  try {
    res = await fetchImpl(`${SANDBOX_BASE}/case-status/${probeCase.receipt}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    });
  } catch (cause) {
    return {
      label: probeCase.label,
      receipt: probeCase.receipt,
      httpStatus: null,
      isFourXx: false,
      errorKind: "network",
      message: `Could not reach USCIS: ${String(cause)}`,
    };
  }

  const json = await res.json().catch(() => null);

  if (res.ok) {
    // Should never happen for these two cases. If USCIS ever starts
    // returning 2xx for one of them (e.g. the sandbox added that receipt),
    // that's worth surfacing explicitly rather than silently mislabeling it.
    return {
      label: probeCase.label,
      receipt: probeCase.receipt,
      httpStatus: res.status,
      isFourXx: false,
      errorKind: null,
      message: "Unexpectedly succeeded — USCIS returned 2xx for a case expected to fail.",
    };
  }

  const err = parseErrorResponse(res.status, json);
  return {
    label: probeCase.label,
    receipt: probeCase.receipt,
    httpStatus: res.status,
    isFourXx: isFourXx(res.status),
    errorKind: err.kind,
    message: err.message,
  };
}
