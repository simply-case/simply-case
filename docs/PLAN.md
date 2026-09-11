# mycase pro — build plan

Immigration case tracker (USCIS / CEAC / EOIR) with status history and change notifications.

## Stack (locked)

| Layer | Choice |
|---|---|
| Web | Next.js (App Router) + TypeScript + Tailwind |
| Backend / DB / Auth | Supabase — Postgres, Auth w/ RLS, Edge Functions (Deno) |
| Mobile | React Native + Expo (`create-expo-app`, expo-router) |
| Push | Expo Push Notification Service (APNs + FCM) |
| Email | **Resend** (decision below) |
| Hosting | Vercel (web), Supabase cloud (backend), EAS (mobile builds) |

### Email: Resend (decided)

Supabase's built-in email is a shared SMTP relay intended only for auth emails
(confirm signup, password reset) and is rate-limited to a handful of messages per
hour — unusable as a notification channel. Resend for product notifications;
Supabase Auth stays on its own sender, pointed at Resend SMTP later so the domain
and deliverability match. Cost is $0 up to 3k emails/mo.

## Repo layout

npm workspaces monorepo — the win is sharing generated DB types and Zod
validators between web and mobile so a schema change breaks both at compile time.

```
mycasepro/
  apps/
    web/            # Next.js — Vercel
    mobile/         # Expo — EAS
  packages/
    shared/         # generated supabase types, zod schemas, status parsing, formatters
  supabase/
    migrations/     # SQL, source of truth for schema
    functions/      # edge functions (check-cases, send-notifications, register-device)
  docs/
```

Note: Expo's Metro needs `watchFolders` + `disableHierarchicalLookup` pointed at
the workspace root; there's a documented config for this, we'll add it in Phase 4.

## Data model (sketch)

The one non-obvious design decision: **de-duplicate case polling globally.**
If 500 users track the same receipt number we must fetch it once, not 500 times.

```
tracked_cases        (id, provider, case_key, current_status, current_status_detail,
                      last_checked_at, last_changed_at, check_interval_s, consecutive_errors)
                      UNIQUE (provider, case_key)      -- global, one row per real case

case_status_events   (id, tracked_case_id, status, detail, body_hash, observed_at)
                      -- append-only history; insert only when body_hash changes

user_cases           (id, user_id, tracked_case_id, nickname, notify_push, notify_email,
                      archived, created_at)
                      UNIQUE (user_id, tracked_case_id)   -- the user's subscription

profiles             (id -> auth.users, email, timezone, created_at)
devices              (id, user_id, expo_push_token UNIQUE, platform, last_seen_at)
notifications        (id, user_id, user_case_id, channel, event_id, status, sent_at, error)
```

RLS: `user_cases`, `devices`, `notifications`, `profiles` filtered by
`auth.uid()`. `tracked_cases` / `case_status_events` are **not** directly
readable — exposed through a security-definer view joined on the caller's
`user_cases`, so nobody can enumerate receipt numbers.

## Polling pipeline

`pg_cron` (every 5 min) → selects due `tracked_cases` → `pg_net` POST to the
`check-cases` Edge Function in batches → function fetches each provider →
on body_hash change: insert `case_status_events`, update `tracked_cases`,
enqueue notification rows → `send-notifications` function drains the queue to
Expo Push + Resend. Exponential backoff per case on `consecutive_errors`.

## Data sources — reality check

- **USCIS**: an official developer API exists (OAuth2 client-credentials, sandbox
  + prod tiers). Verify current availability and approval time *first*, in
  Phase 0 — it gates the whole product. Public egov status page is the fallback.
- **EOIR**: the ACIS portal is backed by a JSON endpoint its own UI calls; usable
  without an official API but undocumented and can change.
- **CEAC**: no API and the status page is CAPTCHA-gated. Hardest of the three —
  push it to Phase 7 and consider a "user-assisted refresh" flow (user solves the
  challenge in an embedded webview) rather than automated solving, which would
  breach their terms.

Rate-limit politely, set a real User-Agent, cache aggressively, and honor the
terms of each source. Treat receipt numbers as PII: encrypt at rest or store a
hash + last-4 for display where practical.

## Phases

**Phase 0 — foundations (½ day)**
Supabase project created, CLI linked, monorepo scaffolded, env plumbing, CI lint/typecheck.
Register for USCIS API access in parallel — it has lead time.

**Phase 1 — schema + auth**
Migrations for the tables above, RLS policies, `supabase gen types` wired into
`packages/shared`. Email-magic-link auth working on web.

**Phase 2 — provider adapters**
A `Provider` interface (`fetchStatus(caseKey) -> {status, detail, bodyHash}`) with
a USCIS implementation + fixtures-based tests. No network in tests.

**Phase 3 — web MVP**
Add case, list cases, case detail with status timeline, remove/archive. Server
Components + Supabase SSR client. Deploy to Vercel.

**Phase 4 — mobile MVP**
Expo app, shared auth session, same three screens, Metro monorepo config.

**Phase 5 — the polling engine**
`check-cases` Edge Function, pg_cron schedule, backoff, run observability.

**Phase 6 — notifications**
Device registration + Expo push, Resend email, per-case preferences, quiet hours,
dedupe so one status change sends exactly one notification per channel.

**Phase 7 — the rest**
EOIR adapter, CEAC assisted-refresh, timeline export, paid tier if wanted.

## Open items

- USCIS API approval status → blocks Phase 2
- Apple Developer + Google Play accounts ($99/yr + $25) → needed before Phase 4 ships
- Domain name for Resend sender verification

---

# Product decisions (confirmed 2026-09-11)

## Audience: individuals first, firms later

v1 targets a person tracking 1-5 of their own cases. Firm/attorney support is a
later phase, not a never.

**This costs us nothing now.** `user_cases` is already a join table between a
user and a shared `tracked_case`, so an attorney and their client can each
subscribe to the same case today and each get their own notifications. What a
firm tier adds later is a roster, team accounts, billing, and permissions —
all additive. No migration of existing data required.

## Processing-time estimates: deferred, not designed out

Not in v1. But `tracked_cases.form_type` and `tracked_cases.submitted_at` are
already captured, and those are exactly the join keys a processing-time feature
needs. So we accumulate the inputs from day one and can light the feature up
later against historical data we already have, rather than starting cold.

## Notification content: private by default

Lock-screen text must not reveal immigration status. The push payload carries a
generic title/body; the real status is only visible after opening the app.

**Open subtlety:** the user-chosen nickname could itself be revealing
("Mom's asylum case") if we put it on the lock screen. Decision: include the
nickname, but the nickname field in the UI carries a short note that it may
appear in notifications — the user controls it, but should know that.

## Monetization: free, no limits, for now

No plan/quota columns in the schema. Natural future levers, in order of least
disruption: number of active cases, check frequency, history depth. Adding a
tier later means a `plan` column on `profiles` plus enforcement — easy. The
hard part is social (existing free users), not technical.
