import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeBodyHash,
  isIoeReceipt,
  isValidReceiptNumber,
  parseCaseStatusResponse,
  parseErrorResponse,
  parseUscisHistoryDate,
  parseUscisTimestamp,
  UscisApiError,
  UscisClient,
} from "./uscis.ts";

import {
  CASE_IOE_PREFIX,
  CASE_UNORDERED_HISTORY,
  CASE_WITH_HISTORY,
  CASE_WITHOUT_HISTORY,
  ERROR_401_DOCUMENTED,
  ERROR_404_DOCUMENTED,
  ERROR_422_DOCUMENTED,
  ERROR_429_DOCUMENTED,
  ERROR_503_LIVE,
  TOKEN_RESPONSE,
} from "./uscis.fixtures.ts";

// --- receipt validation -----------------------------------------------------

test("accepts the standard 3-letter + 10-digit receipt format", () => {
  assert.ok(isValidReceiptNumber("EAC9999103403"));
  assert.ok(isValidReceiptNumber("IOE0912345678"));
  assert.ok(isValidReceiptNumber("  lin9999106498  "), "trims and is case-insensitive");
});

test("accepts the asterisk receipt format from the USCIS spec", () => {
  // [a-zA-Z]{3}\*[0-9]{9} — easy to overlook, but documented as valid.
  assert.ok(isValidReceiptNumber("EAC*999910340"));
});

test("rejects malformed receipt numbers", () => {
  for (const bad of ["", "BADNUMBER", "EAC999910340", "EAC99991034031", "1239999103403", "EAC*99991034"]) {
    assert.equal(isValidReceiptNumber(bad), false, `should reject ${JSON.stringify(bad)}`);
  }
});

test("detects IOE-prefix receipts", () => {
  assert.ok(isIoeReceipt("IOE0912345678"));
  assert.ok(isIoeReceipt("ioe0912345678"));
  assert.equal(isIoeReceipt("EAC9999103403"), false);
});

// --- date parsing -----------------------------------------------------------

test("parses the MM-DD-YYYY HH:mm:ss timestamp format", () => {
  // 09-05-2023 is 5 September, not 9 May. Getting this backwards produces a
  // wrong-but-plausible date, which is exactly why it has its own parser.
  assert.equal(parseUscisTimestamp("09-05-2023 14:28:46"), "2023-09-05T14:28:46.000Z");
  assert.equal(parseUscisTimestamp("01-15-2024 09:02:11"), "2024-01-15T09:02:11.000Z");
});

test("parses a date-only timestamp and rejects junk", () => {
  assert.equal(parseUscisTimestamp("12-25-2024"), "2024-12-25T00:00:00.000Z");
  for (const bad of [null, undefined, "", "2023-09-05", "not a date", 12345]) {
    assert.equal(parseUscisTimestamp(bad), null);
  }
});

test("parses ISO history dates and rejects the other format", () => {
  assert.equal(parseUscisHistoryDate("2023-09-05"), "2023-09-05");
  // The timestamp format must NOT be accepted here — that mixup is the bug
  // this separation exists to prevent.
  assert.equal(parseUscisHistoryDate("09-05-2023 14:28:46"), null);
  assert.equal(parseUscisHistoryDate(null), null);
});

// --- response parsing -------------------------------------------------------

test("parses a standard response with history, both languages", async () => {
  const r = await parseCaseStatusResponse("EAC9999103403", CASE_WITH_HISTORY);
  assert.equal(r.caseKey, "EAC9999103403");
  assert.equal(r.formType, "I-130");
  assert.equal(r.submittedAt, "2023-09-05T14:28:46.000Z");
  assert.equal(r.statusTextEn, "Case Was Approved");
  assert.equal(r.statusTextEs, "Caso Fue Aprobado");
  assert.ok(r.statusDetailEn?.includes("we approved your Form I-130"));
  assert.ok(r.statusDetailEs?.includes("aprobamos su Formulario I-130"));
  assert.equal(r.history.length, 1);
  assert.equal(r.history[0]?.observedAt, "2023-09-05");
  assert.equal(r.history[0]?.statusTextEs, "Aprobamos su Formulario I-130, Petición de Familiar Extranjero.");
});

test("parses a response with no history array", async () => {
  const r = await parseCaseStatusResponse("EAC9999103400", CASE_WITHOUT_HISTORY);
  assert.deepEqual(r.history, []);
  assert.equal(r.statusTextEn, "Case Was Received");
  assert.equal(r.modifiedAt, "2024-03-02T11:45:00.000Z");
  assert.ok(r.bodyHash.length === 64, "still produces a hash without history");
});

test("parses the IOE-prefix schema with no submitted/modified dates", async () => {
  const r = await parseCaseStatusResponse("IOE0912345678", CASE_IOE_PREFIX);
  assert.equal(r.submittedAt, null);
  assert.equal(r.modifiedAt, null);
  assert.equal(r.statusTextEn, "Case Is Being Actively Reviewed By USCIS");
  assert.equal(r.history.length, 2);
  // With no modifiedDate, bodyHash is the only available change signal.
  assert.equal(r.bodyHash.length, 64);
});

test("sorts history oldest-first regardless of API ordering", async () => {
  const r = await parseCaseStatusResponse("SRC9999102777", CASE_UNORDERED_HISTORY);
  assert.deepEqual(
    r.history.map((h) => h.observedAt),
    ["2024-01-05", "2024-03-22", "2024-06-10"],
  );
});

test("tolerates a payload at the root instead of under case_status", async () => {
  const r = await parseCaseStatusResponse("EAC9999103403", CASE_WITH_HISTORY.case_status);
  assert.equal(r.statusTextEn, "Case Was Approved");
});

test("survives a malformed payload without throwing", async () => {
  const r = await parseCaseStatusResponse("EAC9999103403", { case_status: { hist_case_status: "nonsense" } });
  assert.equal(r.statusTextEn, null);
  assert.deepEqual(r.history, []);
  assert.equal(r.caseKey, "EAC9999103403", "falls back to the requested receipt number");
});

test("drops history entries with unparseable dates rather than inventing them", async () => {
  const r = await parseCaseStatusResponse("EAC9999103403", {
    case_status: {
      hist_case_status: [
        { date: "2024-01-05", completed_text_en: "good" },
        { date: "garbage", completed_text_en: "bad" },
        { completed_text_en: "no date at all" },
      ],
    },
  });
  assert.equal(r.history.length, 1);
  assert.equal(r.history[0]?.statusTextEn, "good");
});

// --- change detection -------------------------------------------------------

test("bodyHash is stable for identical content", async () => {
  const a = await parseCaseStatusResponse("EAC9999103403", CASE_WITH_HISTORY);
  const b = await parseCaseStatusResponse("EAC9999103403", CASE_WITH_HISTORY);
  assert.equal(a.bodyHash, b.bodyHash);
});

test("bodyHash changes when the status changes", async () => {
  const before = await parseCaseStatusResponse("EAC9999103403", CASE_WITH_HISTORY);
  const mutated = structuredClone(CASE_WITH_HISTORY);
  mutated.case_status.current_case_status_text_en = "Case Was Denied";
  const after = await parseCaseStatusResponse("EAC9999103403", mutated);
  assert.notEqual(before.bodyHash, after.bodyHash);
});

test("bodyHash changes when a new history entry appears", async () => {
  const before = await parseCaseStatusResponse("IOE0912345678", CASE_IOE_PREFIX);
  const mutated = structuredClone(CASE_IOE_PREFIX);
  mutated.case_status.hist_case_status.push({
    date: "2024-05-01",
    completed_text_en: "We approved your Form I-485.",
    completed_text_es: "Aprobamos su Formulario I-485.",
  });
  const after = await parseCaseStatusResponse("IOE0912345678", mutated);
  assert.notEqual(before.bodyHash, after.bodyHash);
});

test("bodyHash ignores the echoed `message` field", async () => {
  // `message` echoes the request payload and can differ between responses that
  // represent identical case state. Hashing it would fire phantom "your case
  // changed" notifications.
  const a = await parseCaseStatusResponse("EAC9999103403", CASE_WITH_HISTORY);
  const mutated = structuredClone(CASE_WITH_HISTORY);
  mutated.message = "Query was successful for payload {'receipt_number': 'SOMETHING ELSE'}";
  const b = await parseCaseStatusResponse("EAC9999103403", mutated);
  assert.equal(a.bodyHash, b.bodyHash);
});

test("computeBodyHash is order-sensitive across history entries", async () => {
  const base = { statusTextEn: "x", statusDetailEn: null, statusTextEs: null, statusDetailEs: null };
  const h1 = await computeBodyHash({
    ...base,
    history: [
      { observedAt: "2024-01-01", statusTextEn: "a", statusTextEs: null },
      { observedAt: "2024-02-01", statusTextEn: "b", statusTextEs: null },
    ],
  });
  const h2 = await computeBodyHash({
    ...base,
    history: [{ observedAt: "2024-01-01", statusTextEn: "a", statusTextEs: null }],
  });
  assert.notEqual(h1, h2);
});

// --- error mapping ----------------------------------------------------------

test("parses the live nested error envelope with a string code", () => {
  const e = parseErrorResponse(503, ERROR_503_LIVE);
  assert.equal(e.kind, "service_unavailable");
  assert.equal(e.providerCode, "503");
  assert.ok(e.message.includes("unavailable"), "message must survive the nested shape");
});

test("parses the documented flat error envelope with a numeric code", () => {
  const e = parseErrorResponse(404, ERROR_404_DOCUMENTED);
  assert.equal(e.kind, "not_found");
  assert.equal(e.providerCode, "404");
  assert.ok(e.message.includes("does not recognize"));
});

test("503 is retryable and must NOT count against the case", () => {
  // The sandbox closes nights and weekends. Counting that as case failure
  // would dead-letter every tracked case over a single weekend.
  const e = parseErrorResponse(503, ERROR_503_LIVE);
  assert.equal(e.retryable, true);
  assert.equal(e.countsAsCaseError, false);
});

test("429 is retryable and must NOT count against the case", () => {
  const e = parseErrorResponse(429, ERROR_429_DOCUMENTED);
  assert.equal(e.kind, "rate_limited");
  assert.equal(e.retryable, true);
  assert.equal(e.countsAsCaseError, false, "our throttling problem, not the case's");
});

test("404 counts against the case and is flagged as possibly protected", () => {
  const e = parseErrorResponse(404, ERROR_404_DOCUMENTED);
  assert.equal(e.retryable, false);
  assert.equal(e.countsAsCaseError, true);
  // USCIS returns 404 for 8 U.S.C. 1367-protected individuals (VAWA/T/U), so
  // callers must not phrase this as "invalid receipt number".
  assert.equal(e.mayBeProtectedCase, true);
});

test("422 and 401 are terminal, not retryable", () => {
  const e422 = parseErrorResponse(422, ERROR_422_DOCUMENTED);
  assert.equal(e422.kind, "invalid_format");
  assert.equal(e422.retryable, false);

  const e401 = parseErrorResponse(401, ERROR_401_DOCUMENTED);
  assert.equal(e401.kind, "unauthorized");
  assert.equal(e401.retryable, false);
});

test("unknown status codes degrade gracefully", () => {
  const e = parseErrorResponse(500, {});
  assert.equal(e.kind, "unknown");
  assert.ok(e.message.includes("500"));
});

// --- client: token handling -------------------------------------------------

function stubFetch(handler: (url: string, init?: RequestInit) => { status: number; body: unknown }) {
  const calls: string[] = [];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    const { status, body } = handler(url, init);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

test("fetches a token once and reuses it across calls", async () => {
  const { impl, calls } = stubFetch((url) =>
    url.includes("/oauth/accesstoken")
      ? { status: 200, body: TOKEN_RESPONSE }
      : { status: 200, body: CASE_WITH_HISTORY }
  );
  const client = new UscisClient({ clientId: "id", clientSecret: "secret", fetchImpl: impl });

  await client.fetchStatus("EAC9999103403");
  await client.fetchStatus("EAC9999103403");
  await client.fetchStatus("EAC9999103403");

  const tokenCalls = calls.filter((u) => u.includes("/oauth/accesstoken"));
  // Three case lookups must not mean three token requests — that would double
  // request volume against a 10 TPS ceiling.
  assert.equal(tokenCalls.length, 1);
});

test("refreshes the token once it has expired", async () => {
  let now = 1_000_000;
  const { impl, calls } = stubFetch((url) =>
    url.includes("/oauth/accesstoken")
      ? { status: 200, body: TOKEN_RESPONSE }
      : { status: 200, body: CASE_WITH_HISTORY }
  );
  const client = new UscisClient({
    clientId: "id",
    clientSecret: "secret",
    fetchImpl: impl,
    now: () => now,
  });

  await client.fetchStatus("EAC9999103403");
  now += 1_800_000; // past the 1800s lifetime
  await client.fetchStatus("EAC9999103403");

  assert.equal(calls.filter((u) => u.includes("/oauth/accesstoken")).length, 2);
});

test("concurrent calls share a single in-flight token request", async () => {
  const { impl, calls } = stubFetch((url) =>
    url.includes("/oauth/accesstoken")
      ? { status: 200, body: TOKEN_RESPONSE }
      : { status: 200, body: CASE_WITH_HISTORY }
  );
  const client = new UscisClient({ clientId: "id", clientSecret: "secret", fetchImpl: impl });

  await Promise.all([
    client.fetchStatus("EAC9999103403"),
    client.fetchStatus("EAC9999103400"),
    client.fetchStatus("LIN9999106498"),
  ]);

  assert.equal(calls.filter((u) => u.includes("/oauth/accesstoken")).length, 1);
});

test("retries once with a fresh token after an unexpected 401", async () => {
  let caseCalls = 0;
  const { impl, calls } = stubFetch((url) => {
    if (url.includes("/oauth/accesstoken")) return { status: 200, body: TOKEN_RESPONSE };
    caseCalls += 1;
    return caseCalls === 1
      ? { status: 401, body: ERROR_401_DOCUMENTED }
      : { status: 200, body: CASE_WITH_HISTORY };
  });
  const client = new UscisClient({ clientId: "id", clientSecret: "secret", fetchImpl: impl });

  const r = await client.fetchStatus("EAC9999103403");
  assert.equal(r.statusTextEn, "Case Was Approved");
  assert.equal(calls.filter((u) => u.includes("/oauth/accesstoken")).length, 2, "token refetched");
});

test("gives up after a second consecutive 401", async () => {
  const { impl } = stubFetch((url) =>
    url.includes("/oauth/accesstoken")
      ? { status: 200, body: TOKEN_RESPONSE }
      : { status: 401, body: ERROR_401_DOCUMENTED }
  );
  const client = new UscisClient({ clientId: "id", clientSecret: "secret", fetchImpl: impl });

  await assert.rejects(
    () => client.fetchStatus("EAC9999103403"),
    (e: unknown) => e instanceof UscisApiError && e.kind === "unauthorized",
  );
});

// --- client: request behaviour ----------------------------------------------

test("rejects a malformed receipt without spending a request", async () => {
  const { impl, calls } = stubFetch(() => ({ status: 200, body: TOKEN_RESPONSE }));
  const client = new UscisClient({ clientId: "id", clientSecret: "secret", fetchImpl: impl });

  await assert.rejects(
    () => client.fetchStatus("BADNUMBER"),
    (e: unknown) => e instanceof UscisApiError && e.kind === "invalid_format",
  );
  assert.equal(calls.length, 0, "no quota consumed on client-side-invalid input");
});

test("sends credentials in the form body, not as Basic auth", async () => {
  // Basic auth returns 400 "Required param : grant_type" — verified live.
  let body: string | null = null;
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/oauth/accesstoken")) {
      body = init?.body ? String(init.body) : null;
      assert.equal((init?.headers as Record<string, string>)?.Authorization, undefined);
      return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
    }
    return new Response(JSON.stringify(CASE_WITH_HISTORY), { status: 200 });
  }) as unknown as typeof fetch;

  const client = new UscisClient({ clientId: "myid", clientSecret: "mysecret", fetchImpl: impl });
  await client.fetchStatus("EAC9999103403");

  assert.ok(body?.includes("grant_type=client_credentials"));
  assert.ok(body?.includes("client_id=myid"));
  assert.ok(body?.includes("client_secret=mysecret"));
});

test("sends the bearer token on the case request and uppercases the receipt", async () => {
  let auth: string | undefined;
  let caseUrl = "";
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/oauth/accesstoken")) {
      return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
    }
    caseUrl = url;
    auth = (init?.headers as Record<string, string>)?.Authorization;
    return new Response(JSON.stringify(CASE_WITH_HISTORY), { status: 200 });
  }) as unknown as typeof fetch;

  const client = new UscisClient({ clientId: "id", clientSecret: "secret", fetchImpl: impl });
  await client.fetchStatus("  eac9999103403  ");

  assert.equal(auth, `Bearer ${TOKEN_RESPONSE.access_token}`);
  assert.ok(caseUrl.endsWith("/case-status/EAC9999103403"));
});

test("targets sandbox by default and production when asked", async () => {
  for (const [env, host] of [["sandbox", "api-int.uscis.gov"], ["production", "api.uscis.gov"]] as const) {
    let seen = "";
    const impl = (async (input: string | URL | Request) => {
      seen = typeof input === "string" ? input : input.toString();
      return new Response(JSON.stringify(TOKEN_RESPONSE), { status: 200 });
    }) as unknown as typeof fetch;
    const client = new UscisClient({
      clientId: "id",
      clientSecret: "secret",
      environment: env,
      fetchImpl: impl,
    });
    await client.getAccessToken();
    assert.ok(seen.includes(host), `${env} should target ${host}`);
  }
});

test("surfaces a 503 from the case endpoint as a non-counting error", async () => {
  const { impl } = stubFetch((url) =>
    url.includes("/oauth/accesstoken")
      ? { status: 200, body: TOKEN_RESPONSE }
      : { status: 503, body: ERROR_503_LIVE }
  );
  const client = new UscisClient({ clientId: "id", clientSecret: "secret", fetchImpl: impl });

  await assert.rejects(
    () => client.fetchStatus("EAC9999103403"),
    (e: unknown) =>
      e instanceof UscisApiError &&
      e.kind === "service_unavailable" &&
      e.countsAsCaseError === false,
  );
});

test("wraps network failures instead of leaking raw fetch errors", async () => {
  const impl = (async () => {
    throw new TypeError("connection refused");
  }) as unknown as typeof fetch;
  const client = new UscisClient({ clientId: "id", clientSecret: "secret", fetchImpl: impl });

  await assert.rejects(
    () => client.fetchStatus("EAC9999103403"),
    (e: unknown) =>
      e instanceof UscisApiError && e.kind === "network" && e.countsAsCaseError === false,
  );
});

test("constructor requires credentials", () => {
  assert.throws(() => new UscisClient({ clientId: "", clientSecret: "x" }));
  assert.throws(() => new UscisClient({ clientId: "x", clientSecret: "" }));
});
