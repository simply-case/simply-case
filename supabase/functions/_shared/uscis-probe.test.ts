import { test } from "node:test";
import assert from "node:assert/strict";

import { isFourXx, PROBE_CASES, probeOnce } from "./uscis-probe.ts";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

// --- isFourXx ------------------------------------------------------------

test("isFourXx is true for the whole 400-499 range", () => {
  assert.equal(isFourXx(400), true);
  assert.equal(isFourXx(404), true);
  assert.equal(isFourXx(422), true);
  assert.equal(isFourXx(429), true);
  assert.equal(isFourXx(499), true);
});

test("isFourXx is false outside 400-499", () => {
  assert.equal(isFourXx(200), false);
  assert.equal(isFourXx(399), false);
  assert.equal(isFourXx(500), false);
  assert.equal(isFourXx(503), false);
});

// --- PROBE_CASES -----------------------------------------------------

test("PROBE_CASES has a nonexistent-receipt case and a malformed-receipt case", () => {
  const labels = PROBE_CASES.map((c) => c.label);
  assert.ok(labels.includes("nonexistent_receipt"));
  assert.ok(labels.includes("malformed_receipt"));
});

test("the malformed_receipt case is genuinely malformed (would be rejected by isValidReceiptNumber)", () => {
  const malformed = PROBE_CASES.find((c) => c.label === "malformed_receipt")!;
  // 3 letters + 10 digits is the valid shape; this must NOT match it, or the
  // probe would stop generating the 422/400 it exists to generate.
  assert.doesNotMatch(malformed.receipt, /^[A-Za-z]{3}(\d{10}|\*\d{9})$/);
});

// --- probeOnce -------------------------------------------------------

test("a 404 response is reported as a 4xx with kind not_found", async () => {
  const result = await probeOnce(
    { label: "nonexistent_receipt", receipt: "EAC9999000001" },
    "fake-token",
    fakeFetch(404, { error: { code: "404", message: "No case found." } }),
  );
  assert.equal(result.httpStatus, 404);
  assert.equal(result.isFourXx, true);
  assert.equal(result.errorKind, "not_found");
  assert.equal(result.message, "No case found.");
});

test("a 422 response is reported as a 4xx with kind invalid_format", async () => {
  const result = await probeOnce(
    { label: "malformed_receipt", receipt: "ABC123" },
    "fake-token",
    fakeFetch(422, { error: { code: "422", message: "Invalid receipt number format." } }),
  );
  assert.equal(result.httpStatus, 422);
  assert.equal(result.isFourXx, true);
  assert.equal(result.errorKind, "invalid_format");
});

test("a 503 response is reported but NOT counted as a 4xx (sandbox closed)", async () => {
  const result = await probeOnce(
    { label: "nonexistent_receipt", receipt: "EAC9999000001" },
    "fake-token",
    fakeFetch(503, { error: { code: "503", message: "Sandbox is unavailable." } }),
  );
  assert.equal(result.httpStatus, 503);
  assert.equal(result.isFourXx, false);
  assert.equal(result.errorKind, "service_unavailable");
});

test("an unexpected 200 is reported explicitly rather than mislabeled as an error", async () => {
  const result = await probeOnce(
    { label: "nonexistent_receipt", receipt: "EAC9999000001" },
    "fake-token",
    fakeFetch(200, { case_status: {} }),
  );
  assert.equal(result.httpStatus, 200);
  assert.equal(result.isFourXx, false);
  assert.equal(result.errorKind, null);
  assert.match(result.message ?? "", /Unexpectedly succeeded/);
});

test("a network failure is reported with kind network and a null http status", async () => {
  const throwingFetch = (async () => {
    throw new Error("boom");
  }) as unknown as typeof fetch;

  const result = await probeOnce(
    { label: "nonexistent_receipt", receipt: "EAC9999000001" },
    "fake-token",
    throwingFetch,
  );
  assert.equal(result.httpStatus, null);
  assert.equal(result.isFourXx, false);
  assert.equal(result.errorKind, "network");
  assert.match(result.message ?? "", /Could not reach USCIS/);
});
