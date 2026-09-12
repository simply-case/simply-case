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
  **Confirmed 2026-09-12:** user-assisted refresh is the decision, for both
  immigrant (NVC case number) and nonimmigrant (location + DS-160 application
  ID) cases. The cost — no background polling, therefore no push on an NVC
  status change — is accepted, mitigated by a weekly "tap to refresh" reminder
  push. A CAPTCHA-solving service was explicitly rejected; a session-reuse
  hybrid is deferred pending an unknown session lifetime. See HANDOFF.md.

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

## Processing-time estimates: ~~deferred~~ **in scope as of 2026-09-12**

*Original decision (2026-09-11), kept for context:* not in v1, but
`tracked_cases.form_type` and `tracked_cases.submitted_at` are already
captured — exactly the join keys a processing-time feature needs — so we
accumulate the inputs from day one rather than starting cold.

**Reversed 2026-09-12.** Two things changed the calculus:

1. USCIS publishes a **free, keyless JSON endpoint** for official processing
   times (`egov.uscis.gov/processing-times/api/…`). We do not have to derive
   estimates from our own historical data at all — the authoritative numbers
   are available directly.
2. Because form type and service center are derivable from the receipt, this
   renders on the case detail screen with **zero user input**.

NVC timeframes have no API and are scraped from travel.state.gov alongside the
Visa Bulletin. Both are subject to the Cloudflare finding in HANDOFF.md.

The *original* idea — estimates derived from our own observed data — is still
a real differentiator later, since we will have real transition timings the
official numbers don't capture. It is now an enhancement, not the v1 mechanism.

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

## Visa Bulletin: store everything, personalize optionally (2026-09-12)

Daily cron; store the **complete** bulletin (Final Action Dates and Dates for
Filing, family + employment, all country columns) plus the **raw HTML
alongside the parsed rows**. State Dept reshuffles that markup periodically,
and a silent parse failure means silently wrong dates on an immigration app —
parse failure must alert, not degrade quietly.

The feature worth building is the personalization on top: user optionally
saves category + country + priority date, and the screen answers "your date is
current" / "you're ~4 months out." The raw table is a commodity; every
competitor has one. Users who skip setup still see the full table.

## Range search: official API, cached, globally rate-limited (2026-09-12)

Receipt numbers are sequential, so the block around a user's receipt is their
filing cohort. Reporting "34 of 62 nearby cases approved" is the only way to
answer "is my case stuck, or is everyone stuck?" — the question the product
otherwise cannot address, and the incumbent's most-praised feature.

Uses the **official USCIS API**, not the public egov page: production allows
400,000 requests/day at 10 TPS, so quota is ample and we avoid the Cloudflare
exposure that affects the scrape-based features.

Three design consequences, in order of how easy they are to get wrong:

1. **The 10 TPS ceiling is per account, shared with the polling cron**, so the
   rate limiter must live in Postgres. Concurrent edge function invocations
   with in-memory limiters would each independently exceed it.
2. **It cannot be synchronous** — 100 lookups is ≥10 seconds. Async job,
   progressive results or a push on completion.
3. **Cache every scanned receipt.** Coverage compounds across users; the next
   person in that block gets an instant, free answer.

Per-user daily cap (~5) exists to protect the shared TPS budget from one
user's retry loop, not to conserve quota.

**Recorded tradeoff:** bulk sequential enumeration is a recognisable abuse
signature, and API credentials are tied to the account — losing API access
would kill the core product, not just this feature. USCIS publishes no rule
against it and provisions 400k/day. Raised, considered, and approved by the
user. Not to be re-litigated.

## News: official structured sources, server-side only (2026-09-12)

Federal Register API (free, JSON, filterable to USCIS/DHS/State immigration
documents — high signal, rarely used by apps in this category) plus USCIS
newsroom and travel.state.gov announcements for plain-language items.

Fetched on a cron into a `news_items` table and served from our own DB.
Never fetched from the client: otherwise a dead upstream feed breaks the app,
and there is no way to suppress junk.

## Civics quiz: out of scope, by decision (2026-09-12)

The incumbent bundles a USCIS citizenship civics quiz. Deliberately excluded —
it is a study-app feature attached to a tracking product, and it shares no
data model, no backend, and no notification surface with anything else here.
Recorded so it is not re-proposed as an oversight.
