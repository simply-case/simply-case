/**
 * check-cases — polls due tracked_cases and records status changes.
 *
 * Triggered on a schedule by pg_cron (see supabase/migrations/0005_cron_schedule.sql),
 * authenticated by a shared secret rather than a Supabase JWT: this function's
 * only legitimate caller is that cron job, and using our own header avoids
 * betting on which Supabase auth key format is injected into the request.
 *
 * Deployed with --no-verify-jwt (see docs/PLAN.md deploy notes) since the
 * CRON_SECRET check below is the actual authorization boundary.
 *
 * One request in, one JSON summary out — no streaming, this runs in well
 * under the function timeout for the batch sizes we use.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  isValidReceiptNumber,
  UscisApiError,
  UscisClient,
  type UscisCaseStatus,
} from "../_shared/uscis.ts";

// Stay under the documented TPS ceiling (5 TPS sandbox, 10 TPS production) —
// this is a shared budget across every case in the batch, not per-case.
const SANDBOX_MIN_INTERVAL_MS = 220; // ~4.5 TPS, a margin under the 5 TPS cap
const PRODUCTION_MIN_INTERVAL_MS = 110; // ~9 TPS, a margin under the 10 TPS cap

const DEFAULT_BATCH_SIZE = 20;
const RETRY_SOON_SECONDS = 15 * 60;

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface TrackedCaseRow {
  id: string;
  case_key: string;
  body_hash: string | null;
  last_checked_at: string | null;
}

interface RunSummary {
  provider: "uscis";
  claimed: number;
  updated: number;
  changed: number;
  errored: number;
  errors: Array<{ case_key: string; kind: string; message: string }>;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Authorization boundary. Timing-safe-ish via simple equality is acceptable
  // here: the secret is 256 bits of entropy and this isn't a login endpoint
  // where an attacker gets unlimited guesses against a small keyspace.
  const cronSecret = requireEnv("CRON_SECRET");
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let batchSize = DEFAULT_BATCH_SIZE;
  try {
    const body = await req.json();
    if (typeof body?.batch_size === "number" && body.batch_size > 0) {
      batchSize = Math.min(body.batch_size, 200);
    }
  } catch {
    // No body / non-JSON body is fine — batch_size just falls back to default.
  }

  // SERVICE_SECRET_KEY, not the auto-injected SUPABASE_SERVICE_ROLE_KEY
  // (the legacy JWT-format key): found 2026-09-13 that database calls from
  // this function were failing ("Gateway Timeout" on every call) starting
  // right around when the Supabase project's secret key was rotated. No
  // fallback to the legacy key on purpose — if this secret is missing, fail
  // loudly rather than silently running on a key that may be disabled. See
  // docs/HANDOFF.md "Polling outage, 2026-09-12" for the full story.
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceSecretKey = requireEnv("SERVICE_SECRET_KEY");
  const db = createClient(supabaseUrl, serviceSecretKey, {
    auth: { persistSession: false },
  });

  const uscisEnv = Deno.env.get("USCIS_ENVIRONMENT") === "production"
    ? "production"
    : "sandbox";
  const uscis = new UscisClient({
    clientId: requireEnv("USCIS_CLIENT_ID"),
    clientSecret: requireEnv("USCIS_CLIENT_SECRET"),
    environment: uscisEnv,
  });
  const minIntervalMs = uscisEnv === "production"
    ? PRODUCTION_MIN_INTERVAL_MS
    : SANDBOX_MIN_INTERVAL_MS;

  const { data: claimed, error: claimError } = await db.rpc("claim_due_cases", {
    p_provider: "uscis",
    batch_size: batchSize,
  });
  if (claimError) {
    return new Response(JSON.stringify({ error: claimError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const cases = (claimed ?? []) as TrackedCaseRow[];
  const summary: RunSummary = {
    provider: "uscis",
    claimed: cases.length,
    updated: 0,
    changed: 0,
    errored: 0,
    errors: [],
  };

  // Written before the loop so a crash mid-batch still leaves a row with
  // claimed count and started_at — finished_at stays null and crashed=false
  // until the catch/finally below, which is itself evidence something hung
  // rather than merely erred. This is the answer to "is polling healthy?"
  // that previously required cross-referencing cron.job_run_details with
  // tracked_cases.last_checked_at — see docs/ROADMAP.md Phase B1.
  const { data: runRow } = await db
    .from("poll_runs")
    .insert({ provider: "uscis", claimed: cases.length })
    .select("id")
    .single();
  const runId: string | undefined = runRow?.id;

  try {
    for (const [i, trackedCase] of cases.entries()) {
      if (i > 0) await sleep(minIntervalMs);

      if (!isValidReceiptNumber(trackedCase.case_key)) {
        // Shouldn't happen — case_key is validated on insert — but a poller
        // must never crash a whole batch over one bad row.
        summary.errored += 1;
        summary.errors.push({
          case_key: trackedCase.case_key,
          kind: "invalid_format",
          message: "case_key failed validation at poll time",
        });
        continue;
      }

      try {
        const result = await uscis.fetchStatus(trackedCase.case_key);
        await applyResult(db, trackedCase, result);
        summary.updated += 1;
        if (result.bodyHash !== trackedCase.body_hash) summary.changed += 1;
      } catch (e) {
        summary.errored += 1;
        const err = e instanceof UscisApiError
          ? e
          : new UscisApiError({ kind: "unknown", message: String(e) });
        summary.errors.push({
          case_key: trackedCase.case_key,
          kind: err.kind,
          message: err.message,
        });
        await recordError(db, trackedCase, err);
      }
    }
  } catch (e) {
    if (runId) {
      await db.from("poll_runs").update({
        finished_at: new Date().toISOString(),
        updated: summary.updated,
        changed: summary.changed,
        errored: summary.errored,
        crashed: true,
        crash_message: String(e),
      }).eq("id", runId);
    }
    throw e;
  }

  if (runId) {
    const errorKinds = summary.errors.reduce<Record<string, number>>((acc, e) => {
      acc[e.kind] = (acc[e.kind] ?? 0) + 1;
      return acc;
    }, {});
    await db.from("poll_runs").update({
      finished_at: new Date().toISOString(),
      updated: summary.updated,
      changed: summary.changed,
      errored: summary.errored,
      error_kinds: errorKinds,
    }).eq("id", runId);
  }

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

/**
 * Applies a successful fetch: backfills history on first sight of a case,
 * appends a poll event when content actually changed, updates tracked_cases,
 * and enqueues notification rows for every subscriber. Runs as a handful of
 * awaited statements rather than one giant transaction — Postgres RPC calls
 * from the client library aren't transactional across multiple statements
 * anyway, so this keeps failure modes visible instead of pretending otherwise.
 */
async function applyResult(
  // deno-lint-ignore no-explicit-any
  db: any,
  trackedCase: TrackedCaseRow,
  result: UscisCaseStatus,
): Promise<void> {
  const isFirstFetch = trackedCase.last_checked_at === null;
  const changed = result.bodyHash !== trackedCase.body_hash;

  if (isFirstFetch && result.history.length > 0) {
    const rows = result.history.map((h) => ({
      tracked_case_id: trackedCase.id,
      status_text_en: h.statusTextEn ?? "(status unavailable)",
      status_text_es: h.statusTextEs,
      source: "api_history" as const,
      observed_at: h.observedAt,
    }));
    const { error } = await db.from("case_status_events").insert(rows);
    if (error) throw new Error(`history insert failed: ${error.message}`);
  }

  // A poll event is only warranted when content actually changed AND it
  // wasn't already fully captured by the history backfill above — comparing
  // against the last history entry's text avoids inserting a duplicate
  // "current state" event that just repeats what api_history already said.
  const lastHistoryText = result.history.at(-1)?.statusTextEn ?? null;
  const alreadyCapturedByHistory = isFirstFetch &&
    lastHistoryText !== null &&
    lastHistoryText === result.statusTextEn;

  let newEventId: string | null = null;
  if (changed && !alreadyCapturedByHistory && result.statusTextEn) {
    const { data, error } = await db
      .from("case_status_events")
      .insert({
        tracked_case_id: trackedCase.id,
        status_text_en: result.statusTextEn,
        status_detail_en: result.statusDetailEn,
        status_text_es: result.statusTextEs,
        status_detail_es: result.statusDetailEs,
        source: "poll",
        observed_at: result.fetchedAt,
      })
      .select("id")
      .single();
    if (error) throw new Error(`poll event insert failed: ${error.message}`);
    newEventId = data.id;
  }

  const { error: updateError } = await db
    .from("tracked_cases")
    .update({
      form_type: result.formType,
      submitted_at: result.submittedAt,
      status_text_en: result.statusTextEn,
      status_detail_en: result.statusDetailEn,
      status_text_es: result.statusTextEs,
      status_detail_es: result.statusDetailEs,
      body_hash: result.bodyHash,
      last_checked_at: result.fetchedAt,
      ...(changed ? { last_changed_at: result.fetchedAt } : {}),
      consecutive_errors: 0,
      last_error_code: null,
      last_error_message: null,
    })
    .eq("id", trackedCase.id);
  if (updateError) {
    throw new Error(`tracked_cases update failed: ${updateError.message}`);
  }

  // Notifications are enqueued here (data layer) but sent by the separate
  // send-notifications function (Phase 6) — keeps "detect a change" and
  // "deliver a push/email" as independently retryable steps.
  if (newEventId) {
    const { data: subscribers, error: subError } = await db
      .from("user_cases")
      .select("id, notify_email")
      .eq("tracked_case_id", trackedCase.id)
      .is("archived_at", null);
    if (subError) throw new Error(`subscriber lookup failed: ${subError.message}`);

    // push omitted deliberately: send-notifications has no consumer for it
    // yet (only drains channel='email'), so enqueuing push rows here would
    // just grow a queue nothing reads — see docs/ROADMAP.md Phase B2 and
    // migration 0010_pause_push_notifications.sql, which cleaned up the
    // backlog this created between Phase 6 and now. Bring back a
    // notify_push check here (and re-select it above) when push
    // notifications actually ship.
    const rows = (subscribers ?? [])
      .filter((s: { id: string; notify_email: boolean }) => s.notify_email)
      .map((s: { id: string; notify_email: boolean }) => ({
        user_case_id: s.id,
        case_status_event_id: newEventId,
        channel: "email" as const,
      }));
    // user_id is required by the notifications table but not selected above;
    // fetch it via the user_cases -> notifications relationship is awkward
    // from here, so pull it in the same query instead.
    if (rows.length > 0) {
      const { data: subsWithUser } = await db
        .from("user_cases")
        .select("id, user_id")
        .eq("tracked_case_id", trackedCase.id)
        .is("archived_at", null);
      const userIdByUserCase = new Map(
        (subsWithUser ?? []).map((s: { id: string; user_id: string }) => [s.id, s.user_id]),
      );
      const rowsWithUser = rows
        .map((r) => ({ ...r, user_id: userIdByUserCase.get(r.user_case_id) }))
        .filter((r) => r.user_id);

      if (rowsWithUser.length > 0) {
        const { error: notifyError } = await db
          .from("notifications")
          .insert(rowsWithUser);
        if (notifyError) {
          throw new Error(`notification enqueue failed: ${notifyError.message}`);
        }
      }
    }
  }
}

/**
 * Records a failed fetch. Only increments consecutive_errors when the error
 * actually reflects something wrong with the case (see
 * UscisApiError.countsAsCaseError) — a closed sandbox or a rate limit is our
 * problem, not evidence the case is broken, and must not count toward the
 * 10-strikes dead-letter threshold in claim_due_cases.
 */
async function recordError(
  // deno-lint-ignore no-explicit-any
  db: any,
  trackedCase: TrackedCaseRow,
  err: UscisApiError,
): Promise<void> {
  const updates: Record<string, unknown> = {
    last_error_code: err.providerCode ?? err.kind,
    last_error_message: err.message,
  };
  if (err.countsAsCaseError) {
    updates.last_checked_at = new Date().toISOString();
    const { error } = await db.rpc("increment_case_errors", {
      p_tracked_case_id: trackedCase.id,
      p_error_code: updates.last_error_code,
      p_error_message: updates.last_error_message,
    });
    if (error) throw new Error(`error recording failed: ${error.message}`);
  } else {
    const { error } = await db
      .from("tracked_cases")
      .update(updates)
      .eq("id", trackedCase.id);
    if (error) throw new Error(`error recording failed: ${error.message}`);
  }

  if (err.retryable) {
    const { error } = await db.rpc("reschedule_case_soon", {
      p_tracked_case_id: trackedCase.id,
      p_delay_seconds: RETRY_SOON_SECONDS,
    });
    if (error) throw new Error(`reschedule failed: ${error.message}`);
  }
}
