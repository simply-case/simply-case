import { createBreakageJudge } from "@mycasepro/shared";
import { supabase } from "@/lib/supabase";

/**
 * Reports to the server when a government page appears to have changed
 * underneath us, so the owner hears about it before users do. Pairs with
 * `report_lookup_breakage` (migration 0016) — see that file for why the
 * report has to come from a device at all (ceac.state.gov returns 403 to
 * anything server-side, so no backend check could ever see these pages).
 *
 * The judgement about whether something is actually broken — rather than
 * just offline — lives in `@mycasepro/shared`'s createBreakageJudge, where
 * it's unit-tested. This wrapper is only the plumbing.
 */
export function createBreakageReporter(provider: "ceac" | "eoir") {
  const judge = createBreakageJudge();

  return function observeStep(step: string) {
    const stepToReport = judge(step);
    if (!stepToReport) return;

    void supabase
      .rpc("report_lookup_breakage", { p_provider: provider, p_step: stepToReport })
      .then(({ error }) => {
        // Best-effort and silent by design: this is telemetry for the
        // owner, not something the user asked for or is waiting on. It
        // must never interrupt a lookup that is otherwise working.
        if (error) console.log("[breakage report failed]", error.message);
        else console.log("[breakage reported]", provider, stepToReport);
      });
  };
}
