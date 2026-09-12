import { test } from "node:test";
import assert from "node:assert/strict";

import { classifyStatus } from "./status.ts";

// Corpus is real USCIS status text pulled from
// supabase/functions/_shared/uscis.fixtures.ts and the USCIS "Case Status
// Online" documented status list — not invented strings — since a
// classifier that only passes against text it was designed around proves
// nothing.
test("classifyStatus: pending", () => {
  assert.equal(classifyStatus("Case Was Received"), "pending");
  assert.equal(classifyStatus("Case Was Received and A Receipt Notice Was Sent"), "pending");
});

test("classifyStatus: inProgress", () => {
  assert.equal(classifyStatus("Case Is Being Actively Reviewed By USCIS"), "inProgress");
  assert.equal(classifyStatus("Case Was Transferred And A New Office Has Jurisdiction"), "inProgress");
  assert.equal(classifyStatus("Fingerprint Fee Was Received"), "inProgress");
});

test("classifyStatus: actionNeeded", () => {
  assert.equal(classifyStatus("Request for Evidence Was Sent"), "actionNeeded");
  assert.equal(classifyStatus("Notice To Appear Was Sent To The National Records Center"), "actionNeeded");
  assert.equal(classifyStatus("Biometrics Appointment Was Scheduled"), "actionNeeded");
});

test("classifyStatus: approved", () => {
  assert.equal(classifyStatus("Case Was Approved"), "approved");
  assert.equal(classifyStatus("New Card Is Being Mailed"), "unknown"); // not in corpus; documents the gap
  assert.equal(classifyStatus("Card Was Mailed To Me"), "approved");
});

test("classifyStatus: denied", () => {
  assert.equal(classifyStatus("Case Was Denied"), "denied");
  assert.equal(classifyStatus("Case Was Rejected Because It Was Not Properly Filed"), "denied");
});

test("classifyStatus: unknown / missing", () => {
  assert.equal(classifyStatus(null), "unknown");
  assert.equal(classifyStatus(undefined), "unknown");
  assert.equal(classifyStatus(""), "unknown");
  assert.equal(classifyStatus("Something USCIS has never printed before"), "unknown");
});

test("classifyStatus: denial check runs before action-needed patterns", () => {
  // A denial notice that also mentions appeal steps must still read as
  // denied, not as actionNeeded just because it contains "response".
  assert.equal(
    classifyStatus("Case Was Denied. A Response Explaining The Appeal Process Was Mailed."),
    "denied",
  );
});
