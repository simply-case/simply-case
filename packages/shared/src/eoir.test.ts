import { test } from "node:test";
import assert from "node:assert/strict";
import { formatEoirAddress, formatEoirHeadline, formatEoirResult, type EoirCaseInfoResponse } from "./eoir.ts";
import { classifyStatus } from "./status.ts";

/**
 * THE fixture: a REAL ACIS GetCaseInfo response, captured on device from a
 * live lookup on 2026-09-21 (the account owner's own case), with the
 * applicant's name replaced — this repo is public.
 *
 * Kept verbatim otherwise, including EOIR's own quirks: the pipe-delimited
 * address that repeats the city, the bare letter codes ("M", "P", "RMV"),
 * and midnight-timestamped dates with the real time in a separate field.
 * Every one of those quirks broke something the first time it was seen, so
 * a synthetic fixture would defeat the point of having one.
 *
 * If EOIR changes their response shape, these tests won't catch it (nothing
 * offline can) — that's what the runtime breakage alert is for. What this
 * DOES catch is us breaking our own parsing, which is the far more likely
 * failure and the one that would silently show someone the wrong hearing
 * date.
 */
const REAL_RESPONSE: EoirCaseInfoResponse = {
  Data: {
    ValidAlienNumber: true,
    AlienName: "DOE, JANE",
    CaseID: 14738199,
    OSC_Date: "2024-12-04T00:00:00",
    ElapsedDays: "1655",
    LatestHearingDate: "2027-01-12T00:00:00",
    LatestHearingTime: "8:30 AM",
    DocketDate: "2024-12-04T00:00:00",
    CaseDecisionString: null,
    MTRDecisionString: null,
    ReopenDecisionString: null,
    AppealDecisionString: null,
    AppealFiled: false,
    ReopenExists: false,
    PendingAtBIA: false,
  },
  Proceeding: {
    CaseType: "RMV",
    HearingLocationAddress: "SEATTLE, WASHINGTON|915 2ND AVENUE, SUITE 613|SEATTLE, WA 98174",
  },
  Schedule: {
    AdjDate: "2027-01-12T00:00:00",
    AdjTime: "8:30 AM",
    IJ_Name: "Sogabe, Kenneth",
    IJ_WebExURLLink: "https://eoir.webex.com/meet/IJ.Sogabe",
    HearingLocationAddress: "SEATTLE, WASHINGTON|915 2ND AVENUE, SUITE 613|SEATTLE, WA 98174",
    CalType: "M",
    HearingMedium: "P",
  },
};

test("the real captured response produces the expected hearing sentence", () => {
  assert.equal(
    formatEoirHeadline(REAL_RESPONSE),
    "Your next Master Calendar hearing is in person on January 12, 2027 at 8:30 AM.",
  );
});

test("the real captured response classifies as a scheduled hearing", () => {
  const { statusText } = formatEoirResult(REAL_RESPONSE);
  assert.equal(statusText, "Hearing scheduled");
  // The pill the user actually sees. Confirmed with the user 2026-09-22:
  // an upcoming hearing reads as "pending", deliberately NOT
  // "actionNeeded" the way USCIS treats a scheduled interview.
  assert.equal(classifyStatus(statusText), "pending");
});

test("the saved detail carries hearing, location and judge but NOT the applicant's name", () => {
  const { statusDetail } = formatEoirResult(REAL_RESPONSE);
  assert.match(statusDetail, /January 12, 2027 at 8:30 AM/);
  assert.match(statusDetail, /915 2ND AVENUE/);
  assert.match(statusDetail, /Sogabe, Kenneth/);
  // Deliberate: status_detail_en is stored server-side, and the applicant's
  // name adds no information the user doesn't already have. Guards against
  // someone "helpfully" adding it back later.
  assert.doesNotMatch(statusDetail, /DOE, JANE/i);
});

test("an in-person hearing does not offer a WebEx link", () => {
  const { rows } = formatEoirResult(REAL_RESPONSE);
  assert.equal(rows.find((r) => r.label === "Hearing link"), undefined);
});

test("a virtual hearing does offer the WebEx link", () => {
  const virtual: EoirCaseInfoResponse = {
    ...REAL_RESPONSE,
    Schedule: { ...REAL_RESPONSE.Schedule, HearingMedium: "V" },
  };
  const { rows } = formatEoirResult(virtual);
  assert.equal(rows.find((r) => r.label === "Hearing link")?.value, "https://eoir.webex.com/meet/IJ.Sogabe");
  assert.match(formatEoirHeadline(virtual) ?? "", /is by video on/);
});

test("an unrecognized hearing-medium code is never spliced into the sentence", () => {
  const odd: EoirCaseInfoResponse = {
    ...REAL_RESPONSE,
    Schedule: { ...REAL_RESPONSE.Schedule, HearingMedium: "Z" },
  };
  // Regression: an earlier version produced "...hearing is (Z) on January
  // 12, 2027", which reads like a rendering bug.
  const headline = formatEoirHeadline(odd) ?? "";
  assert.equal(headline, "Your next Master Calendar hearing is on January 12, 2027 at 8:30 AM.");
  assert.doesNotMatch(headline, /\(Z\)/);
  // ...but the code is still surfaced rather than silently dropped.
  assert.equal(formatEoirResult(odd).rows.find((r) => r.label === "Hearing medium")?.value, "Z");
});

test("master vs individual calendar are both translated", () => {
  const individual: EoirCaseInfoResponse = {
    ...REAL_RESPONSE,
    Schedule: { ...REAL_RESPONSE.Schedule, CalType: "I" },
  };
  assert.match(formatEoirHeadline(individual) ?? "", /Individual \(Merits\) Calendar hearing/);
});

test("an unknown calendar code falls back to the raw code, not a guess", () => {
  const odd: EoirCaseInfoResponse = {
    ...REAL_RESPONSE,
    Schedule: { ...REAL_RESPONSE.Schedule, CalType: "Q" },
  };
  assert.match(formatEoirHeadline(odd) ?? "", /Your next Q hearing is/);
});

test("the repeated city in EOIR's address is collapsed", () => {
  // EOIR sends "CITY, STATE|street|CITY, ST ZIP" — rendering all three
  // gave "SEATTLE, WASHINGTON, 915 2ND AVENUE..., SEATTLE, WA 98174".
  assert.equal(
    formatEoirAddress("SEATTLE, WASHINGTON|915 2ND AVENUE, SUITE 613|SEATTLE, WA 98174"),
    "915 2ND AVENUE, SUITE 613, SEATTLE, WA 98174",
  );
});

test("an address whose first line is genuinely different is left intact", () => {
  assert.equal(
    formatEoirAddress("NEW YORK CIRCUIT|26 FEDERAL PLAZA|NEW YORK, NY 10278"),
    "NEW YORK CIRCUIT, 26 FEDERAL PLAZA, NEW YORK, NY 10278",
  );
});

test("a not-found A-Number says so instead of returning an empty result", () => {
  const { statusText, statusDetail, rows } = formatEoirResult({ Data: { ValidAlienNumber: false } });
  assert.equal(statusText, "No information found");
  assert.equal(classifyStatus(statusText), "unknown");
  // Regression: this used to render a card containing only the A-Number,
  // with nothing telling the user the lookup had come back empty.
  assert.notEqual(statusDetail.trim(), "");
  assert.deepEqual(rows, []);
});

test("an appeal or motion classifies as in progress", () => {
  for (const flag of ["AppealFiled", "PendingAtBIA", "ReopenExists"] as const) {
    const { statusText } = formatEoirResult({ Data: { ValidAlienNumber: true, [flag]: true } });
    assert.equal(statusText, "Appeal or motion pending", `${flag} should mean appeal/motion pending`);
    assert.equal(classifyStatus(statusText), "inProgress");
  }
});

test("a decision outranks a scheduled hearing and never guesses the outcome", () => {
  const decided: EoirCaseInfoResponse = {
    ...REAL_RESPONSE,
    Data: { ...REAL_RESPONSE.Data, CaseDecisionString: "Removal ordered" },
  };
  const { statusText, rows } = formatEoirResult(decided);
  assert.equal(statusText, "Decision issued");
  // Deliberately NOT approved/denied: no real decision string has ever been
  // observed, so inferring an outcome from wording we've never seen is
  // exactly the false-positive classifyStatus is built to avoid.
  assert.equal(classifyStatus(statusText), "unknown");
  assert.equal(rows.find((r) => r.label === "Case decision")?.value, "Removal ordered");
});

test("an empty or unrecognized response degrades instead of throwing", () => {
  for (const payload of [{}, { Data: null }, { Schedule: null, Proceeding: null }] as EoirCaseInfoResponse[]) {
    const result = formatEoirResult(payload);
    assert.equal(result.statusText, "No information found");
    assert.notEqual(result.statusDetail.trim(), "");
  }
  assert.equal(formatEoirHeadline({}), null);
  assert.equal(formatEoirAddress(null), null);
  assert.equal(formatEoirAddress(undefined), null);
});

test("a hearing date with no time still reads correctly", () => {
  const noTime: EoirCaseInfoResponse = {
    Data: { ValidAlienNumber: true },
    Schedule: { AdjDate: "2027-01-12T00:00:00", CalType: "M", HearingMedium: "P" },
  };
  assert.equal(formatEoirHeadline(noTime), "Your next Master Calendar hearing is in person on January 12, 2027.");
});

test("Schedule takes precedence over Data for the hearing date", () => {
  // Both carry a hearing date; Schedule is the specific upcoming one.
  const conflicting: EoirCaseInfoResponse = {
    Data: { ValidAlienNumber: true, LatestHearingDate: "2020-01-01T00:00:00", LatestHearingTime: "9:00 AM" },
    Schedule: { AdjDate: "2027-01-12T00:00:00", AdjTime: "8:30 AM" },
  };
  assert.match(formatEoirHeadline(conflicting) ?? "", /January 12, 2027 at 8:30 AM/);
});
