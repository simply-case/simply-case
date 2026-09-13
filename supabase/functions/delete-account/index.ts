/**
 * delete-account — permanently deletes the calling user's account
 * (ROADMAP F8). Apple requires an in-app account-deletion path for any
 * app that supports account creation.
 *
 * Unlike check-cases/send-notifications/fetch-news, this is deployed WITH
 * JWT verification (the Supabase default — no --no-verify-jwt flag), since
 * its caller is a real signed-in user's own session, not a cron job. The
 * bearer token IS the authorization boundary here.
 *
 * What gets deleted:
 *   - auth.users row for the caller (cascades to profiles, user_cases,
 *     devices, notifications — see supabase/migrations/0001_core_schema.sql
 *     `on delete cascade` foreign keys).
 *   - Any tracked_cases the caller was subscribed to that NO other user is
 *     still subscribed to (their case_status_events cascade too). A case
 *     other users still track is left alone — it's shared data, not the
 *     deleted user's.
 *
 * What this does NOT do: touch any other user's data, or partially delete
 * (either the whole operation is attempted, or it fails with a clear
 * error — there's nothing here for the caller to retry piecemeal).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "missing bearer token" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const accessToken = authHeader.slice("Bearer ".length);

  // SERVICE_SECRET_KEY (not the legacy SUPABASE_SERVICE_ROLE_KEY — see
  // check-cases/index.ts and docs/HANDOFF.md "Polling outage") for the
  // admin client that does the actual deletion. A SEPARATE call below
  // resolves which user the caller's token belongs to, so an admin key
  // alone is never enough to delete anyone's account without a valid
  // token proving who's asking.
  const supabaseUrl = requireEnv("SUPABASE_URL");
  const adminDb = createClient(supabaseUrl, requireEnv("SERVICE_SECRET_KEY"), {
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await adminDb.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return new Response(JSON.stringify({ error: "invalid or expired session" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = userData.user.id;

  // Collect this user's tracked_case_ids BEFORE deleting the user — once
  // the auth.users row is gone, user_cases cascades away too and there's
  // nothing left to look up.
  const { data: userCases, error: casesError } = await adminDb
    .from("user_cases")
    .select("tracked_case_id")
    .eq("user_id", userId);
  if (casesError) {
    return new Response(JSON.stringify({ error: `could not read user_cases: ${casesError.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  const trackedCaseIds = [...new Set((userCases ?? []).map((r) => r.tracked_case_id))];

  const { error: deleteUserError } = await adminDb.auth.admin.deleteUser(userId);
  if (deleteUserError) {
    return new Response(JSON.stringify({ error: `account deletion failed: ${deleteUserError.message}` }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Now delete any of those tracked_cases that have become orphaned — no
  // remaining user_cases row references them (another user's subscription,
  // if any, keeps the case alive). One at a time with a targeted
  // not-exists check rather than a single broad query, so this can never
  // touch a case another user is still tracking.
  let orphansDeleted = 0;
  const orphanErrors: string[] = [];
  for (const trackedCaseId of trackedCaseIds) {
    const { count } = await adminDb
      .from("user_cases")
      .select("id", { count: "exact", head: true })
      .eq("tracked_case_id", trackedCaseId);
    if (count && count > 0) continue; // still subscribed by someone else

    const { error: deleteCaseError } = await adminDb
      .from("tracked_cases")
      .delete()
      .eq("id", trackedCaseId);
    if (deleteCaseError) {
      orphanErrors.push(`${trackedCaseId}: ${deleteCaseError.message}`);
    } else {
      orphansDeleted += 1;
    }
  }

  return new Response(
    JSON.stringify({
      deleted: true,
      orphaned_cases_deleted: orphansDeleted,
      orphan_cleanup_errors: orphanErrors.length > 0 ? orphanErrors : undefined,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
