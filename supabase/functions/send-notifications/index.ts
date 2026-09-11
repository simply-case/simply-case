/**
 * send-notifications — drains the notifications queue that check-cases
 * enqueues on a status change (see applyResult() in
 * supabase/functions/check-cases/index.ts).
 *
 * Deliberately a separate function/schedule from check-cases rather than
 * sending inline when a change is detected: "detect a change" and "deliver
 * it" should fail independently. A Resend outage shouldn't stop the poller
 * from recording status changes, and a slow email batch shouldn't delay the
 * next case check.
 *
 * Email only for now — channel='push' rows are left untouched (not sent,
 * not marked failed) until device registration + Expo Push exists. Marking
 * them 'failed' would misrepresent "not built yet" as "broke."
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_BATCH_SIZE = 50;

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

interface Profile {
  email: string; preferred_language: string; timezone: string;
  quiet_hours_start: number | null; quiet_hours_end: number | null;
}

interface PendingEmailNotification {
  id: string;
  user_id: string;
  user_case_id: string;
  case_status_event_id: string;
  profile: Profile | null;
  user_cases: { nickname: string | null; tracked_case_id: string } | null;
  case_status_events: {
    status_text_en: string | null; status_detail_en: string | null;
    status_text_es: string | null; status_detail_es: string | null;
  } | null;
}

/**
 * Whether "now" falls inside the user's configured quiet hours, evaluated in
 * their own timezone. Wraps correctly across midnight (e.g. 22 -> 7).
 * Rows skipped here are left 'pending' — not sent, not failed — so the next
 * run (send-notifications is scheduled every 5 min) picks them up once the
 * window has passed.
 */
function isQuietHours(
  quietStart: number | null,
  quietEnd: number | null,
  timezone: string,
): boolean {
  if (quietStart === null || quietEnd === null) return false;
  let hour: number;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: timezone })
        .format(new Date()),
    );
  } catch {
    return false; // an invalid stored timezone must never block sending entirely
  }
  if (quietStart === quietEnd) return false;
  return quietStart < quietEnd
    ? hour >= quietStart && hour < quietEnd
    : hour >= quietStart || hour < quietEnd; // overnight window
}

function renderEmail(n: PendingEmailNotification): { subject: string; text: string } | null {
  const lang = n.profile?.preferred_language === "es" ? "es" : "en";
  const statusText = lang === "es"
    ? n.case_status_events?.status_text_es ?? n.case_status_events?.status_text_en
    : n.case_status_events?.status_text_en;
  const statusDetail = lang === "es"
    ? n.case_status_events?.status_detail_es ?? n.case_status_events?.status_detail_en
    : n.case_status_events?.status_detail_en;
  if (!statusText) return null;

  // Deliberately vague where the subject line might be visible on a lock
  // screen preview; the actual status only appears in the body. See
  // docs/PLAN.md "notification content: private by default" — the nickname
  // is included because the user chose it and was told it may appear here,
  // but the specific status text is not, since that's not something the
  // user typed themselves.
  const label = n.user_cases?.nickname || "your case";
  const subject = lang === "es" ? `mycase pro: una actualización sobre ${label}` : `mycase pro: an update on ${label}`;
  const text = lang === "es"
    ? `${label}:\n\n${statusText}\n\n${statusDetail ?? ""}`.trim()
    : `${label}:\n\n${statusText}\n\n${statusDetail ?? ""}`.trim();
  return { subject, text };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

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
    // no/non-JSON body -> default batch size
  }

  const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false },
  });
  const resendApiKey = requireEnv("RESEND_API_KEY");
  const fromAddress = requireEnv("NOTIFICATION_FROM_EMAIL");

  // notifications.user_id references auth.users, not profiles — PostgREST
  // can only embed a related table via an actual FK edge between the two
  // tables in the query, so `profiles:user_id(...)` can't be embedded here
  // even though profiles.id happens to equal the same auth.users id. Fetch
  // profiles separately instead of relying on embedding. (Found by actually
  // running this against the live project, not by reading the schema —
  // PostgREST's relationship inference isn't visible from the SQL alone.)
  const { data: pending, error: fetchError } = await db
    .from("notifications")
    .select(
      `id, user_id, user_case_id, case_status_event_id,
       user_cases:user_case_id ( nickname, tracked_case_id ),
       case_status_events:case_status_event_id ( status_text_en, status_detail_en, status_text_es, status_detail_es )`,
    )
    .eq("channel", "email")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(batchSize);

  if (fetchError) {
    return new Response(JSON.stringify({ error: fetchError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const userIds = [...new Set((pending ?? []).map((n) => n.user_id))];
  const profileById = new Map<string, Profile>();
  if (userIds.length > 0) {
    const { data: profiles, error: profileError } = await db
      .from("profiles")
      .select("id, email, preferred_language, timezone, quiet_hours_start, quiet_hours_end")
      .in("id", userIds);
    if (profileError) {
      return new Response(JSON.stringify({ error: profileError.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
    for (const p of profiles ?? []) profileById.set(p.id, p);
  }

  const summary = { claimed: pending?.length ?? 0, sent: 0, skippedQuietHours: 0, failed: 0,
    errors: [] as Array<{ id: string; message: string }> };

  for (const raw of pending ?? []) {
    // supabase-js types nested single-row selects as arrays in some
    // versions; normalize defensively rather than trust the inferred shape.
    const n = { ...raw, profile: profileById.get(raw.user_id) ?? null } as unknown as PendingEmailNotification;

    if (!n.profile?.email) {
      summary.failed += 1;
      await db.from("notifications").update({ status: "failed", error: "no profile email on record" }).eq("id", n.id);
      continue;
    }

    if (isQuietHours(n.profile.quiet_hours_start, n.profile.quiet_hours_end, n.profile.timezone)) {
      summary.skippedQuietHours += 1;
      continue; // left pending — picked up on a later run outside the window
    }

    const rendered = renderEmail(n);
    if (!rendered) {
      summary.failed += 1;
      await db.from("notifications").update({ status: "failed", error: "no status text to render" }).eq("id", n.id);
      continue;
    }

    try {
      const res = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: fromAddress,
          to: [n.profile!.email],
          subject: rendered.subject,
          text: rendered.text,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Resend ${res.status}: ${body.slice(0, 300)}`);
      }
      await db.from("notifications").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", n.id);
      summary.sent += 1;
    } catch (e) {
      summary.failed += 1;
      const message = String(e).slice(0, 500);
      summary.errors.push({ id: n.id, message });
      await db.from("notifications").update({ status: "failed", error: message }).eq("id", n.id);
    }
  }

  return new Response(JSON.stringify(summary), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
