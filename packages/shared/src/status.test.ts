import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyStatus } from "./status.ts";

/**
 * Provenance, stated honestly: only "Case Was Received", "Case Was
 * Approved" and "Case Is Being Actively Reviewed By USCIS" appear in
 * supabase/functions/_shared/uscis.fixtures.ts. The rest are commonly-seen
 * USCIS status strings reproduced from the Case Status Online vocabulary,
 * and a couple (marked below) are constructed specifically to pin down
 * branch ordering. They have NOT been verified character-for-character
 * against a live USCIS response, so treat a single failing assertion as
 * possibly-wrong-expectation rather than definitely-broken-code.
 */

test("classifyStatus: pending", () => {
  assert.equal(classifyStatus("Case Was Received"), "pending");
  assert.equal(classifyStatus("Case Was Received and A Receipt Notice Was Sent"), "pending");
});

test("classifyStatus: inProgress", () => {
  assert.equal(classifyStatus("Case Is Being Actively Reviewed By USCIS"), "inProgress");
  assert.equal(classifyStatus("Case Was Transferred And A New Office Has Jurisdiction"), "inProgress");
  assert.equal(classifyStatus("Fingerprint Fee Was Received"), "inProgress");
  assert.equal(classifyStatus("New Card Is Being Produced"), "inProgress");
});

test("classifyStatus: actionNeeded", () => {
  assert.equal(classifyStatus("Request for Evidence Was Sent"), "actionNeeded");
  assert.equal(classifyStatus("Notice To Appear Was Sent To The National Records Center"), "actionNeeded");
  assert.equal(classifyStatus("Biometrics Appointment Was Scheduled"), "actionNeeded");
  assert.equal(classifyStatus("Interview Was Scheduled"), "actionNeeded");
});

test("classifyStatus: approved", () => {
  assert.equal(classifyStatus("Case Was Approved"), "approved");
  assert.equal(classifyStatus("Card Was Mailed To Me"), "approved");
  assert.equal(classifyStatus("Card Was Delivered To Me By The Post Office"), "approved");
  // Regression: this fell through to "unknown" before — a real, common
  // delivery status that left an approved case looking uncategorized.
  assert.equal(
    classifyStatus("Card Was Picked Up By The United States Postal Service"),
    "approved",
  );
});

test("classifyStatus: denied", () => {
  assert.equal(classifyStatus("Case Was Denied"), "denied");
  assert.equal(classifyStatus("Case Rejected Because I Sent An Incorrect Fee"), "denied");
  // Regression: previously "unknown" — the denial vocabulary uses the noun
  // "Withdrawal", not the participle "withdrawn" the pattern matched on.
  assert.equal(classifyStatus("Withdrawal Acknowledgement Notice Was Sent"), "denied");
});

test("classifyStatus: unknown / missing", () => {
  assert.equal(classifyStatus(null), "unknown");
  assert.equal(classifyStatus(undefined), "unknown");
  assert.equal(classifyStatus(""), "unknown");
  assert.equal(classifyStatus("Something USCIS has never printed before"), "unknown");
});

// --- ordering regressions ---------------------------------------------------
// Each of these was a real misclassification found by probing the classifier
// against a wider status corpus than the original tests covered. They all
// share one shape: a phrase belonging to one class appearing inside a
// sentence that means another.

test("a response already sent is progress, not a new to-do", () => {
  // Was "actionNeeded" — the worst failure mode available to this function,
  // since it tells someone to redo work they have already completed.
  assert.equal(
    classifyStatus("Response To USCIS' Request For Evidence Was Received"),
    "inProgress",
  );
});

test("a case closed over a missed RFE is an outcome, not a to-do", () => {
  // Was "actionNeeded" because the sentence contains "request for evidence".
  assert.equal(
    classifyStatus("Case Closed Because You Did Not Respond To A Request For Evidence"),
    "denied",
  );
});

test("undeliverable mail is genuinely actionable", () => {
  assert.equal(
    classifyStatus("Notice Was Returned To USCIS Because The Post Office Could Not Deliver It"),
    "actionNeeded",
  );
});

test("denial check runs before action-needed patterns", () => {
  // Constructed, not a verbatim USCIS string: pins the ordering guarantee
  // that a denial mentioning an appeal process still reads as denied.
  assert.equal(
    classifyStatus("Case Was Denied. A Response Explaining The Appeal Process Was Mailed."),
    "denied",
  );
});
