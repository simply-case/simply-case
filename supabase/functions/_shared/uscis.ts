/**
 * USCIS Case Status API adapter.
 *
 * Written against Web APIs only (fetch, crypto.subtle, TextEncoder) so the same
 * file runs under Deno in Supabase Edge Functions and under Node for tests.
 *
 * Documented behaviour: https://developer.uscis.gov/api/case-status
 * Where the live API diverges from those docs, the divergence is noted inline —
 * it was verified against the sandbox, not assumed.
 */

const SANDBOX_BASE = "https://api-int.uscis.gov";
const PRODUCTION_BASE = "https://api.uscis.gov";

/** Refresh this many ms before actual expiry, to avoid racing the boundary. */
const TOKEN_REFRESH_MARGIN_MS = 60_000;

/**
 * USCIS accepts two receipt formats (from their own OpenAPI spec):
 *   [a-zA-Z]{3}[0-9]{10}    e.g. EAC9999103403
 *   [a-zA-Z]{3}\*[0-9]{9}   e.g. EAC*999910340
 * The second (asterisk) form is easy to miss; it is valid input.
 */
const RECEIPT_RE = /^[A-Za-z]{3}(\d{10}|\*\d{9})$/;

export type UscisEnvironment = "sandbox" | "production";

export type UscisErrorKind =
  | "unauthorized"
  | "not_found"
  | "invalid_format"
  | "rate_limited"
  | "service_unavailable"
  | "network"
  | "unknown";

export class UscisApiError extends Error {
  readonly kind: UscisErrorKind;
  readonly httpStatus: number | null;
  readonly providerCode: string | null;

  constructor(args: {
    kind: UscisErrorKind;
    message: string;
    httpStatus?: number | null;
    providerCode?: string | null;
  }) {
    super(args.message);
    this.name = "UscisApiError";
    this.kind = args.kind;
    this.httpStatus = args.httpStatus ?? null;
    this.providerCode = args.providerCode ?? null;
  }

  /** Whether retrying the same request later could plausibly succeed. */
  get retryable(): boolean {
    return (
      this.kind === "rate_limited" ||
      this.kind === "service_unavailable" ||
      this.kind === "network"
    );
  }

  /**
   * Whether this should increment tracked_cases.consecutive_errors.
   *
   * Critically false for service_unavailable: the sandbox is closed nights and
   * weekends by design, and a poller that counted scheduled downtime as case
   * failure would dead-letter every case in the system over a single weekend.
   * Rate limiting is our own fault, not the case's, so it doesn't count either.
   */
  get countsAsCaseError(): boolean {
    return !(
      this.kind === "service_unavailable" ||
      this.kind === "rate_limited" ||
      this.kind === "network"
    );
  }

  /**
   * True when USCIS says it doesn't recognise the number. Note this is NOT
   * proof of a typo: USCIS also returns 404 for individuals protected under
   * 8 U.S.C. 1367 (VAWA / T visa / U visa applicants). Callers must phrase
   * this to the user as "we can't track this here, contact the USCIS Contact
   * Center" rather than "invalid receipt number".
   */
  get mayBeProtectedCase(): boolean {
    return this.kind === "not_found";
  }
}

export interface UscisHistoryEntry {
  /** Date the event occurred, per USCIS. Date-only; no time component given. */
  observedAt: string; // ISO yyyy-mm-dd
  statusTextEn: string | null;
  statusTextEs: string | null;
}

export interface UscisCaseStatus {
  caseKey: string;
  formType: string | null;
  /** Absent for IOE-prefix receipts — USCIS omits it from that schema entirely. */
  submittedAt: string | null; // ISO 8601
  modifiedAt: string | null; // ISO 8601
  statusTextEn: string | null;
  statusDetailEn: string | null;
  statusTextEs: string | null;
  statusDetailEs: string | null;
  history: UscisHistoryEntry[];
  /** Hash over semantic content only — see computeBodyHash. */
  bodyHash: string;
  fetchedAt: string; // ISO 8601
}

export function isValidReceiptNumber(receipt: string): boolean {
  return RECEIPT_RE.test(receipt.trim());
}

/**
 * IOE-prefix receipts come back under a reduced schema with no submittedDate
 * and no modifiedDate, which is why change detection can't lean on timestamps.
 */
export function isIoeReceipt(receipt: string): boolean {
  return receipt.trim().toUpperCase().startsWith("IOE");
}

/**
 * USCIS uses two date formats in a single response:
 *   submittedDate / modifiedDate : "09-05-2023 14:28:46"  (MM-DD-YYYY HH:mm:ss)
 *   hist_case_status[].date      : "2023-09-05"           (ISO yyyy-mm-dd)
 * Mixing them up silently yields dates that are wrong but plausible, so each
 * format gets its own parser rather than being fed to `new Date()`.
 */
export function parseUscisTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const m = value.trim().match(
    /^(\d{2})-(\d{2})-(\d{4})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/,
  );
  if (!m) return null;
  const [, mm, dd, yyyy, hh = "00", mi = "00", ss = "00"] = m;
  const iso = `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function parseUscisHistoryDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
}

/**
 * Hash of the fields that actually represent case state.
 *
 * Deliberately excludes the top-level `message`, which echoes the request
 * payload and can vary between identical-state responses — including it would
 * manufacture phantom "status changed" events and notify users about nothing.
 */
export async function computeBodyHash(
  parts: {
    statusTextEn: string | null;
    statusDetailEn: string | null;
    statusTextEs: string | null;
    statusDetailEs: string | null;
    history: UscisHistoryEntry[];
  },
): Promise<string> {
  const canonical = JSON.stringify([
    parts.statusTextEn ?? "",
    parts.statusDetailEn ?? "",
    parts.statusTextEs ?? "",
    parts.statusDetailEs ?? "",
    parts.history.map((h) => [h.observedAt, h.statusTextEn ?? ""]),
  ]);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
}

/**
 * Normalises the two documented success schemas (standard and IOE-prefix) into
 * one shape. Tolerates the payload being at the root or nested under
 * `case_status`, since the live API nests it and the spec is ambiguous.
 */
export async function parseCaseStatusResponse(
  caseKey: string,
  json: unknown,
  fetchedAt: Date = new Date(),
): Promise<UscisCaseStatus> {
  const root = (json ?? {}) as Record<string, unknown>;
  const cs = (root.case_status ?? root) as Record<string, unknown>;

  const rawHistory = Array.isArray(cs.hist_case_status) ? cs.hist_case_status : [];
  const history: UscisHistoryEntry[] = rawHistory
    .map((raw) => {
      const h = (raw ?? {}) as Record<string, unknown>;
      const observedAt = parseUscisHistoryDate(h.date);
      if (!observedAt) return null;
      return {
        observedAt,
        statusTextEn: str(h.completed_text_en),
        statusTextEs: str(h.completed_text_es),
      };
    })
    .filter((h): h is UscisHistoryEntry => h !== null)
    // USCIS ordering isn't guaranteed; sort oldest-first so timeline rendering
    // and "what changed" comparisons don't depend on their ordering.
    .sort((a, b) => a.observedAt.localeCompare(b.observedAt));

  const core = {
    statusTextEn: str(cs.current_case_status_text_en),
    statusDetailEn: str(cs.current_case_status_desc_en),
    statusTextEs: str(cs.current_case_status_text_es),
    statusDetailEs: str(cs.current_case_status_desc_es),
    history,
  };

  return {
    caseKey: str(cs.receiptNumber) ?? caseKey,
    formType: str(cs.formType),
    submittedAt: parseUscisTimestamp(cs.submittedDate),
    modifiedAt: parseUscisTimestamp(cs.modifiedDate),
    ...core,
    bodyHash: await computeBodyHash(core),
    fetchedAt: fetchedAt.toISOString(),
  };
}

/**
 * Maps an error response to a typed error.
 *
 * Handles both envelope shapes. The documented one is flat with a numeric code:
 *   {"code": 401, "message": "..."}
 * The live sandbox actually returns it nested with a string code:
 *   {"error": {"code": "503", "message": "..."}}
 * Parsing only the documented shape would leave every error message empty.
 */
export function parseErrorResponse(
  httpStatus: number,
  body: unknown,
): UscisApiError {
  const root = (body ?? {}) as Record<string, unknown>;
  const nested = (root.error ?? root) as Record<string, unknown>;

  const providerCode = nested.code != null ? String(nested.code) : null;
  const message = str(nested.message) ??
    `USCIS returned HTTP ${httpStatus} with no message`;

  const kind: UscisErrorKind = httpStatus === 401
    ? "unauthorized"
    : httpStatus === 404
    ? "not_found"
    : httpStatus === 422
    ? "invalid_format"
    : httpStatus === 429
    ? "rate_limited"
    : httpStatus === 503
    ? "service_unavailable"
    : "unknown";

  return new UscisApiError({ kind, message, httpStatus, providerCode });
}

interface CachedToken {
  accessToken: string;
  expiresAtMs: number;
}

export interface UscisClientOptions {
  clientId: string;
  clientSecret: string;
  environment?: UscisEnvironment;
  /** Injectable for tests. Defaults to global fetch. */
  fetchImpl?: typeof fetch;
  /** Injectable for tests. Defaults to Date.now. */
  now?: () => number;
}

export class UscisClient {
  readonly #clientId: string;
  readonly #clientSecret: string;
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;
  readonly #now: () => number;

  #token: CachedToken | null = null;
  /** In-flight token request, so concurrent calls don't each fetch one. */
  #tokenInFlight: Promise<string> | null = null;

  constructor(opts: UscisClientOptions) {
    if (!opts.clientId || !opts.clientSecret) {
      throw new Error("UscisClient requires clientId and clientSecret");
    }
    this.#clientId = opts.clientId;
    this.#clientSecret = opts.clientSecret;
    this.#baseUrl = opts.environment === "production"
      ? PRODUCTION_BASE
      : SANDBOX_BASE;
    this.#fetch = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.#now = opts.now ?? Date.now;
  }

  /**
   * Returns a cached token when one is still valid.
   *
   * Tokens live 1800s. Fetching one per case check would double our request
   * volume against a 10 TPS production ceiling, so reuse is not an
   * optimisation here — it's a correctness requirement for staying in quota.
   */
  async getAccessToken(): Promise<string> {
    const cached = this.#token;
    if (cached && cached.expiresAtMs - TOKEN_REFRESH_MARGIN_MS > this.#now()) {
      return cached.accessToken;
    }
    if (this.#tokenInFlight) return this.#tokenInFlight;

    this.#tokenInFlight = this.#requestToken().finally(() => {
      this.#tokenInFlight = null;
    });
    return this.#tokenInFlight;
  }

  async #requestToken(): Promise<string> {
    // Credentials must go in the form body. Passing them as HTTP Basic auth
    // returns 400 "Required param : grant_type" — verified against sandbox.
    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.#clientId,
      client_secret: this.#clientSecret,
    });

    let res: Response;
    try {
      res = await this.#fetch(`${this.#baseUrl}/oauth/accesstoken`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
    } catch (cause) {
      throw new UscisApiError({
        kind: "network",
        message: `Could not reach USCIS token endpoint: ${String(cause)}`,
      });
    }

    const json = await res.json().catch(() => null);
    if (!res.ok) throw parseErrorResponse(res.status, json);

    const t = (json ?? {}) as Record<string, unknown>;
    const accessToken = str(t.access_token);
    if (!accessToken) {
      throw new UscisApiError({
        kind: "unknown",
        message: "USCIS token response contained no access_token",
        httpStatus: res.status,
      });
    }

    const expiresInSec = Number(t.expires_in);
    const ttlMs = Number.isFinite(expiresInSec) && expiresInSec > 0
      ? expiresInSec * 1000
      : 1_800_000;

    this.#token = { accessToken, expiresAtMs: this.#now() + ttlMs };
    return accessToken;
  }

  /** Drops the cached token. Used to retry once after an unexpected 401. */
  invalidateToken(): void {
    this.#token = null;
  }

  async fetchStatus(receiptNumber: string): Promise<UscisCaseStatus> {
    const caseKey = receiptNumber.trim().toUpperCase();

    // Validate before spending a request: a malformed number would consume
    // quota only to come back 422.
    if (!isValidReceiptNumber(caseKey)) {
      throw new UscisApiError({
        kind: "invalid_format",
        message:
          "Receipt numbers are 3 letters followed by 10 digits (e.g. EAC9999103403).",
      });
    }

    let res = await this.#requestCase(caseKey);

    // A 401 on a token we believed valid means it was revoked or expired early.
    // Retry exactly once with a fresh token; a second 401 is a real auth fault.
    if (res.status === 401) {
      this.invalidateToken();
      res = await this.#requestCase(caseKey);
    }

    const json = await res.json().catch(() => null);
    if (!res.ok) throw parseErrorResponse(res.status, json);
    return parseCaseStatusResponse(caseKey, json);
  }

  async #requestCase(caseKey: string): Promise<Response> {
    const token = await this.getAccessToken();
    try {
      return await this.#fetch(`${this.#baseUrl}/case-status/${caseKey}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });
    } catch (cause) {
      throw new UscisApiError({
        kind: "network",
        message: `Could not reach USCIS case-status endpoint: ${String(cause)}`,
      });
    }
  }
}
