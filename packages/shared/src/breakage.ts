/**
 * Decides whether an autofill run looks like the government page CHANGED,
 * as opposed to simply not having loaded.
 *
 * Pure and dependency-free so it can be tested (see breakage.test.ts) —
 * the mobile wrapper in apps/mobile/lib/lookup-breakage.ts supplies the
 * actual reporting call. The judgement is the part worth testing; the RPC
 * around it isn't.
 *
 * Why the judgement needs care: the autofill scripts emit the same
 * `*_not_found` steps whether CEAC renamed a field or the phone was simply
 * offline. Alerting on both would mean alerting constantly on bad
 * connections, which trains the owner to ignore the alert — strictly worse
 * than no alert. So the rule is: only report when we found SOME expected
 * element and missed ANOTHER. A page that loaded and largely parsed, with
 * one specific thing missing, is a markup change. Nothing found at all is
 * almost always the network.
 */

/** Steps the autofill scripts emit when an element they expect is absent. */
export const BREAKAGE_STEPS: ReadonlySet<string> = new Set([
  // CEAC — cases/ceac-refresh/[id].tsx
  "number_not_found",
  "type_select_not_found",
  "passport_not_found",
  "surname_not_found",
  "location_not_found",
  "postback_hook_unavailable",
  // EOIR — cases/eoir-refresh/[id].tsx
  "anumber_not_found",
  "nationality_control_not_found",
  "nationality_input_not_found",
  "nationality_options_never_appeared",
  "nationality_no_exact_match",
]);

/**
 * Steps proving the page rendered and we could read it. `_filled` covers
 * both `x_filled` and `x_already_filled` — either way the element was
 * there, which is all this needs to know.
 */
export function isPageWorkingStep(step: string): boolean {
  return step.endsWith("_filled") || step === "accept_clicked" || step === "postback_hook_attached";
}

/**
 * Accumulates steps from one lookup attempt and returns the step to report
 * the moment the evidence justifies it, or null. Returns a step at most
 * once per instance — a single attempt should produce at most one report,
 * however many pollers fail within it.
 *
 * Order-independent on purpose: successes and misses arrive from several
 * concurrent pollers in whatever order they resolve, so a miss seen before
 * any success is buffered rather than discarded.
 */
export function createBreakageJudge(): (step: string) => string | null {
  let sawWorkingPage = false;
  let alreadyReported = false;
  const misses: string[] = [];

  return function observe(step: string): string | null {
    if (alreadyReported) return null;

    if (isPageWorkingStep(step)) {
      sawWorkingPage = true;
    } else if (BREAKAGE_STEPS.has(step)) {
      misses.push(step);
    }

    if (!sawWorkingPage || misses.length === 0) return null;
    alreadyReported = true;
    return misses[0] ?? null;
  };
}
