import { test } from "node:test";
import assert from "node:assert/strict";
import { createBreakageJudge, isPageWorkingStep } from "./breakage.ts";

/**
 * The whole value of this logic is what it REFUSES to report. A breakage
 * alert that fires on every bad connection gets ignored, and an ignored
 * alert is worse than none — so most of these tests are about silence.
 */

test("a fully successful run reports nothing", () => {
  const judge = createBreakageJudge();
  for (const step of ["accept_clicked", "anumber_filled", "nationality_filled"]) {
    assert.equal(judge(step), null);
  }
});

test("a page that never loaded reports nothing, however many things are missing", () => {
  // The offline / Cloudflare-challenge case: every poller times out, but
  // nothing proves the markup changed. This is the false positive the
  // whole design exists to avoid.
  const judge = createBreakageJudge();
  for (const step of ["anumber_not_found", "nationality_control_not_found", "nationality_input_not_found"]) {
    assert.equal(judge(step), null);
  }
});

test("a hit plus a miss is reported — the page loaded but something moved", () => {
  const judge = createBreakageJudge();
  assert.equal(judge("anumber_filled"), null);
  assert.equal(judge("nationality_control_not_found"), "nationality_control_not_found");
});

test("a miss arriving BEFORE the hit is still reported", () => {
  // Pollers resolve concurrently and in arbitrary order — judging a miss
  // only on arrival would silently lose this very common ordering.
  const judge = createBreakageJudge();
  assert.equal(judge("anumber_not_found"), null);
  assert.equal(judge("nationality_filled"), "anumber_not_found");
});

test("only the first miss is reported, once per attempt", () => {
  const judge = createBreakageJudge();
  assert.equal(judge("number_filled"), null);
  assert.equal(judge("passport_not_found"), "passport_not_found");
  // Everything after stays quiet: one attempt, one report.
  assert.equal(judge("surname_not_found"), null);
  assert.equal(judge("location_not_found"), null);
  assert.equal(judge("number_filled"), null);
});

test("unrecognized steps neither report nor count as evidence", () => {
  const judge = createBreakageJudge();
  assert.equal(judge("type_changed"), null);
  assert.equal(judge("some_future_step_we_dont_know"), null);
  assert.equal(judge("error"), null);
  // Still nothing proven working, so a real miss stays buffered.
  assert.equal(judge("number_not_found"), null);
});

test("already_filled counts as the element being present", () => {
  // Re-opening a case finds fields already populated; that still proves
  // the page parsed, which is the only thing being asked.
  assert.equal(isPageWorkingStep("anumber_already_filled"), true);
  assert.equal(isPageWorkingStep("nationality_already_filled"), true);
  const judge = createBreakageJudge();
  assert.equal(judge("anumber_already_filled"), null);
  assert.equal(judge("nationality_no_exact_match"), "nationality_no_exact_match");
});

test("CEAC's postback hook is treated as both a success and a failure signal", () => {
  // postback_hook_unavailable means ASP.NET's PageRequestManager wasn't
  // there — the exact shape of breakage that hid the blank-screen bug for
  // weeks, so it must be reportable.
  assert.equal(isPageWorkingStep("postback_hook_attached"), true);
  const judge = createBreakageJudge();
  assert.equal(judge("number_filled"), null);
  assert.equal(judge("postback_hook_unavailable"), "postback_hook_unavailable");
});

test("each attempt judges independently", () => {
  const first = createBreakageJudge();
  assert.equal(first("number_filled"), null);
  assert.equal(first("surname_not_found"), "surname_not_found");

  // A fresh judge (the screen makes one per refresh) is not muted by what
  // the previous attempt concluded.
  const second = createBreakageJudge();
  assert.equal(second("number_filled"), null);
  assert.equal(second("surname_not_found"), "surname_not_found");
});
