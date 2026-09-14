# Phase F build plan — execution spec

Written 2026-09-13 (Opus, planning) for an uninterrupted build run
(Sonnet, execution). Read `docs/HANDOFF.md` first for project context and
lessons learned. Product decisions behind each feature are in `PLAN.md` and
HANDOFF.md → "New scope". This file is **how**, in what order, and under
which rules.

---

## 0. Rules for this run — read before doing anything

### What you may do WITHOUT asking (user pre-approved 2026-09-13)

- Write code, tests, docs.
- Create feature branches and **commit locally**.
- **Deploy Edge Functions**, but only if the function does not depend on a
  migration that hasn't been applied to production yet.
- Copy values from `apps/web/.env.local` into Supabase function secrets
  (`npx supabase secrets set NAME="$VAR"` after sourcing the file in
  `bash -c`), **never printing the value**. Verify by SHA-256 digest vs
  `npx supabase secrets list`.
- Read-only production queries (`npx supabase db query --linked "select …"`).
- Throwaway diagnostic Edge Functions, deleted right after use.

### What you must NOT do — stop and leave it for the user

- **`git push`** of any kind (so no PRs either).
- **`supabase db push`** and **`supabase config push`**. Write migrations
  and commit them; do not apply them.
- Direct SQL that writes to production (`insert`/`update`/`delete`/DDL via
  `db query`). Put it in a migration or in the user's post-run checklist.
- Buying anything, creating third-party accounts, touching Apple/Google.

### Standing project rules that still apply

- **Never print secret values** — not in output, logs, commit messages or
  docs. `grep -c "^KEY=" file` for presence checks.
- **Verify against the live system**, not exit codes. Typecheck and tests
  are necessary, not sufficient.
- **Expo SDK 57:** `apps/mobile/AGENTS.md` says APIs have changed — read
  the versioned docs (https://docs.expo.dev/versions/v57.0.0/) before
  writing mobile code. Install native packages with `npx expo install`.
- One shared Supabase project (`ltpvagdbprwzqtasurez`) for every branch.
- Every cron `net.http_post` **must** pass `timeout_milliseconds := 60000`
  (see HANDOFF.md → polling outage). Every function called by cron is
  deployed with `--no-verify-jwt --use-api` and checks `x-cron-secret`.
- After each step: `npm run typecheck` and `npm test` must pass before
  committing.

### Branching for this run

The user merges `fix/cron-timeout` (migration 0011, docs, this plan) before
the run starts. Then **each step gets its own branch off `main`**, so the
user can review, push and merge them independently.

Migration numbers are **pre-assigned** so parallel branches never collide:

| Number | Step | Branch |
|---|---|---|
| 0012 | Step 0 — polling watchdog | `fix/polling-db-access` |
| 0013 | F4 — news | `feature/news` |
| 0014 | F5 — CEAC/NVC | `feature/ceac-refresh` |

F0b, F1 and F8 need no migrations. If a step needs a migration not listed
here, use 0015+ in the order you create them and record it in the report.

Because migrations stay unapplied, **hand-edit
`packages/shared/src/database.types.ts`** to match each migration (as was
done for 0009) and note "regenerate with `npm run db:types` after push".

### End-of-run report (required)

Finish with a plain-language report to the user, and append the same facts
to `docs/ROADMAP.md` → a new "Phase F build run" log section:

1. Per step: done / partly done / blocked, and why.
2. Every **local commit** (branch + one-line meaning).
3. Every **production action taken**: function deploys (name + version),
   secrets set (name only), diagnostic functions created and deleted.
4. **Waiting on the user**, in the order they should do it: branches to
   push, migrations to apply, functions to deploy after migrations, manual
   dashboard steps, things to test on the phone.
5. Anything you found that contradicts this plan or the docs.

---

## Step 0 — Restore polling + add a watchdog  (branch `fix/polling-db-access`)

**Why first:** polling has been down since ~17:15 PT 2026-09-12. The USCIS
5-day streak depends on it.

**Known facts (verified 2026-09-13):**
- Migration 0011 fixed the 5 s pg_net timeout. Cron calls now complete but
  return **HTTP 500 `{"error":"Gateway Timeout"}`** (`net._http_response`).
- From outside (a Mac), the same REST/RPC calls with the new `sb_secret_…`
  key return 200 in ~0.2 s. The database is idle; no stuck queries.
- Both functions build their DB client from the auto-injected
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (the **legacy** JWT key).
  The failure began close to when the user rotated the Supabase secret key.
  **Unconfirmed** whether legacy keys are disabled — the user will check
  Project Settings → API Keys. Don't block on that answer.

### 0a. Switch both functions to the new secret key

1. In `check-cases/index.ts` and `send-notifications/index.ts`, create the
   DB client with `requireEnv("SERVICE_SECRET_KEY")` instead of
   `SUPABASE_SERVICE_ROLE_KEY`. No silent fallback to the legacy key — a
   missing secret must fail loudly. Update the header comments.
   (`SUPABASE_`-prefixed names are reserved for `secrets set`, hence the name.)
2. `secrets set SERVICE_SECRET_KEY` from `.env.local`'s `SUPABASE_SECRET_KEY`;
   verify by digest.
3. Deploy both: `npx supabase functions deploy check-cases --no-verify-jwt --use-api`
   and the same for `send-notifications`. (This also ships the
   "Simply Case" email subject from PR #15.)
4. **Verify live:** start a background watcher (don't foreground-sleep)
   that waits for the next `check-cases` tick (:00/:15/:30/:45) and checks:
   - `poll_runs` newest row: `finished_at` set, `updated = 3`, `errored = 0`,
     `crash_message` null;
   - `tracked_cases.last_checked_at` advanced for all 3 uscis rows;
   - `net._http_response`: 200s for both functions.

### 0b. If still failing after 0a

1. Deploy a throwaway `diag-db` function (`--no-verify-jwt`) that times,
   separately: (i) a REST `select 1`-equivalent against `SUPABASE_URL` with
   the new key, (ii) the same against the literal public URL, (iii) the
   same with the legacy key. Return timings + status codes only.
2. Invoke once, record results, **delete the function**, confirm 404.
3. Do not keep guessing. Write the evidence into HANDOFF.md → polling
   outage section (it's what a Supabase support ticket needs), mark Step 0
   **blocked** in the report, and **continue with the rest of the plan** —
   nothing else depends on polling.

### 0c. Watchdog (migration `0012_polling_watchdog.sql`)

Goal: an email to the owner when polling stops working, so an outage can
never again go unnoticed for 15 hours.

It must run **inside Postgres** (pg_cron + pg_net), not in an Edge
Function, because today's failure mode was exactly functions being unable
to reach the database.

- Table `ops_alerts (id uuid pk default gen_random_uuid(), kind text not
  null, sent_at timestamptz not null default now(), detail jsonb)`. RLS
  enabled, no policies.
- Function `check_polling_health()` (security definer, `search_path =
  public`): if any `tracked_cases` row with `provider = 'uscis'` and
  `consecutive_errors < 10` exists, and `max(last_checked_at)` over those
  rows is older than `min(check_interval_seconds) + 45 minutes`, and no
  `ops_alerts` row of kind `'polling_stale'` in the last 6 hours → insert an
  `ops_alerts` row and `net.http_post` to `https://api.resend.com/emails`
  with `timeout_milliseconds := 60000`, bearer token read from Vault secret
  `resend_api_key`, from `onboarding@resend.dev`, to the address in Vault
  secret `alert_email`, subject "Simply Case: polling has stopped", body
  with the last check time and the newest `poll_runs` row. If either Vault
  secret is missing, do nothing (fail closed, no error).
- `cron.schedule('polling-watchdog', '*/30 * * * *', 'select check_polling_health()')`.
- Revoke execute from public/anon/authenticated.
- **Not applied in this run.** Add to the user checklist: after `db push`,
  run in the SQL editor (the user pastes the key themselves, never via chat):
  `select vault.create_secret('<new Resend key>', 'resend_api_key');`
  `select vault.create_secret('mannmankirat@gmail.com', 'alert_email');`
  and remember the Resend key now lives in **4** places for future rotations
  — add that to HANDOFF.md's rotation notes.

---

## F0b — Probe the blocked sources from GitHub Actions  (branch `spike/gov-sources-probe`)

**Why:** decides whether F2 (Visa Bulletin) and F3 (processing times) can
be built. Supabase's servers got Cloudflare 403s (ROADMAP → F0 table).

- Add `.github/workflows/probe-gov-sources.yml`: triggers `workflow_dispatch`
  and `push` to `spike/gov-sources-probe` only. One job on `ubuntu-latest`
  that curls the same 7 URLs as the F0 spike (listed in ROADMAP F0) with a
  real User-Agent, and writes a markdown table (name, HTTP status, whether
  the body contains a Cloudflare challenge marker, bytes) to
  `$GITHUB_STEP_SUMMARY`. **The job must succeed regardless of the codes.**
  No secrets used.
- Commit locally. **It can't run until the user pushes the branch**, so
  F2/F3 are **not part of this run**. Put in the checklist: push branch →
  open the Actions run → report the table → delete the branch.
- Decision already made: if these are also 403, **skip F2/F3 for the beta**
  and keep them as official links in Resources (F1).

---

## F1 — "More" becomes "Resources"  (branch `feature/resources-tab`)

- Rename the tab route `apps/mobile/app/(app)/more.tsx` → `resources.tsx`;
  update `(app)/_layout.tsx` (title "Resources", Ionicons `library` /
  `library-outline`) and its header comment. Grep for any `/more` links.
- Screen content — **real, no "coming soon" rows** (a standing decision):
  a list of official tools, each opening in the in-app browser via
  `expo-web-browser`'s `openBrowserAsync` (already a dependency), each row
  with a title, a one-line plain description, and a small "Official site"
  label:
  - USCIS Case Status Online — `https://egov.uscis.gov/`
  - USCIS Processing Times — `https://egov.uscis.gov/processing-times/`
  - Visa Bulletin — `https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html`
  - Visa status (CEAC) — `https://ceac.state.gov/CEACStatTracker/Status.aspx`
  - NVC Timeframes — `https://travel.state.gov/content/travel/en/us-visas/immigrate/nvc-timeframes.html`
  Keep the list in one typed array so native screens (F2/F3/F5) can replace
  entries later. Use `AppHeader` and the shared primitives/tokens like the
  other tab roots.
- Verify each URL returns something sensible from the Mac (a Cloudflare
  403 to curl is fine — it's opened in a real browser on the phone).
- Web: no change (mobile is the primary platform).

---

## F4 — Real news  (branch `feature/news`, migration 0013)

### Data (migration `0013_news_items.sql`)

- `news_items`: `id uuid pk`, `source text not null check (source in
  ('federal_register','uscis_newsroom'))`, `external_id text not null`,
  `title text not null`, `summary text`, `url text not null`,
  `published_at timestamptz not null`, `fetched_at timestamptz not null
  default now()`, `unique (source, external_id)`, index on
  `published_at desc`.
- RLS on; `select` policy for `authenticated` only. No write policies.
- Cron `fetch-news` every 3 hours (`'0 */3 * * *'`), same Vault
  `cron_secret` header pattern as 0006, **with `timeout_milliseconds := 60000`**.

### Fetcher (`supabase/functions/fetch-news/index.ts` + `_shared/news.ts`)

- Auth: `x-cron-secret` check, same as check-cases. DB client uses
  `SERVICE_SECRET_KEY` (Step 0 convention).
- **Federal Register API** (verified reachable from Supabase):
  `https://www.federalregister.gov/api/v1/documents.json` with
  `per_page=20`, `order=newest`, `fields[]` for `document_number, title,
  abstract, html_url, publication_date, type`, and
  `conditions[agencies][]` for `u-s-citizenship-and-immigration-services`
  and `executive-office-for-immigration-review`; a second request for
  `state-department` with `conditions[term]=visa`. `external_id =
  document_number`. Confirm the agency slugs against
  `https://www.federalregister.gov/api/v1/agencies` before relying on them.
- **USCIS newsroom** (reachable from Supabase): first look for an official
  RSS/Atom feed on uscis.gov and use it if one exists; otherwise parse
  `https://www.uscis.gov/newsroom/all-news`. `external_id` = the article URL
  path.
- Pure parsing functions live in `_shared/news.ts`, tested in
  `_shared/news.test.ts` against **saved fixtures** (fetch real responses
  once from the Mac, trim them, commit as fixtures). No network in tests.
- Upsert on `(source, external_id)`. **One source failing must not stop the
  other**, and a parse failure must be visible: return a JSON summary with
  per-source `fetched / inserted / error`, and `console.error` failures.
- **Do not deploy** — it depends on 0013. User checklist: after `db push`,
  deploy with `--no-verify-jwt --use-api`, then invoke once and confirm rows.

### Mobile (`apps/mobile/app/(app)/news.tsx`)

- Replace the placeholder sample cards with a query on `news_items`
  ordered by `published_at desc`, limit 50.
- Pull-to-refresh, skeleton while loading, a real empty state ("No news
  yet"), an error state with retry.
- Each item: source label (Federal Register / USCIS), date, title, 2-line
  summary; tap opens `url` in the in-app browser.
- Before 0013 is applied the query will fail — the error state must handle
  that gracefully; say so in the report rather than faking data.

---

## F8 — Legal pages, disclaimers, account deletion  (branch `feature/legal-and-account-deletion`)

Decisions already made (2026-09-13): data is kept **until the user deletes
their account**; saving a priority date for the Visa Bulletin is OK.
Contact email: **placeholder** — see "Open inputs" at the bottom.

### Web pages

- `apps/web/src/app/legal/terms/page.tsx` and `legal/privacy/page.tsx`,
  static server components styled with the existing tokens.
- Add `/legal` to `PUBLIC_PATHS` in `apps/web/src/lib/supabase/middleware.ts`
  (both pages must load logged out — the App Store reviewer won't log in).
  **Verify with curl against `npm run dev`** that both return 200 with no
  redirect.
- Privacy policy must be **accurate to the actual code**. Inventory what's
  really stored before writing it: account email (Supabase Auth); tracked
  case/receipt numbers, nicknames, per-case notification settings, archive
  state; profile timezone/language/quiet hours; notification history;
  device push tokens (table exists, not yet used); and, once F2/F5 ship,
  visa bulletin category/country/priority date and CEAC case identifiers.
  Service providers: Supabase (database/auth/functions, US), Vercel (web
  hosting), Resend (email), USCIS Case Status API (receipt numbers are sent
  to USCIS to fetch status). Grep for any analytics/crash SDK and state
  there is none if none is found. No selling or advertising use. Retention:
  until account deletion. Deletion: in-app "Delete account" or email the
  contact address.
- Terms: service provided as-is; **not legal advice**; **not affiliated with
  USCIS, the Department of State, or any U.S. government agency**; status
  shown may be delayed or wrong — always confirm on the official site; users
  may only track cases they're authorized to track.
- Put "Last updated: <date>" on both. Add a one-line note in the report that
  these were **not reviewed by a lawyer**.

### Disclaimers

- Case detail screens on **mobile and web**: one muted line — "Not
  affiliated with USCIS or any government agency. Not legal advice. Confirm
  status on the official site."
- Sign-up (mobile `sign-in.tsx` create-account mode, web `login`): "By
  creating an account you agree to the Terms and Privacy Policy", both
  linked (mobile opens the web URLs in the in-app browser).
- Mobile Profile tab: "Terms of Service" and "Privacy Policy" rows.

### Account deletion (Apple requires in-app deletion for apps with sign-up)

- Edge Function `delete-account` (**JWT verification ON** — the default;
  do not pass `--no-verify-jwt`):
  1. Read the caller from the `Authorization` bearer token
     (`auth.getUser(token)` on an admin client built with
     `SERVICE_SECRET_KEY`). Reject if missing/invalid.
  2. Collect the caller's `tracked_case_id`s from `user_cases`.
  3. `auth.admin.deleteUser(user.id)` — FKs cascade `profiles`,
     `user_cases`, `devices`, `notifications` (verified in 0001).
  4. Delete any of those `tracked_cases` that now have **no** remaining
     `user_cases` (their `case_status_events` cascade). Shared cases other
     users still track must survive.
  5. Return 200 `{ deleted: true }`.
- It needs no migration → **deploy it** in this run. Verify with a
  throwaway account: sign up a disposable test account through the real
  sign-up API, add a sandbox case, call the function with that session,
  confirm the auth user, `user_cases` row and orphaned `tracked_cases` row
  are gone while the owner's three cases are untouched. **Delete nothing
  else.** (Signups currently need no email confirmation, so this works
  without an inbox.)
- Mobile Profile: "Delete account" at the bottom, destructive style. Two
  steps: an explanation screen/alert that says exactly what is deleted and
  that it can't be undone → confirm → call the function via
  `supabase.functions.invoke('delete-account')` → sign out → sign-in screen.
  Handle and show errors.
- Web: not required for Apple; skip unless trivial, and say which in the report.

---

## F5 — NVC / CEAC user-assisted refresh  (branch `feature/ceac-refresh`, migration 0014)

Decisions (HANDOFF.md → New scope #1): no server-side scraping, no CAPTCHA
service; the user solves the CAPTCHA in an in-app WebView; both immigrant
(NVC case number) and nonimmigrant (DS-160 application ID) cases.

### Data (migration `0014_ceac_refresh.sql`)

- Read `0007_add_case_rpc.sql` first. `case_provider` already includes
  `'ceac'`. Encode the type in `case_key`: `IV:<CASE NUMBER>` for immigrant,
  `NIV:<APPLICATION ID>` for nonimmigrant. Make sure `add_case` accepts
  these (normalization currently upper-cases and trims — fine) and that
  `claim_due_cases('uscis', …)` never claims ceac rows (it's provider-scoped
  — confirm).
- RPC `record_ceac_status(p_user_case_id uuid, p_status text, p_detail
  text)`, security definer: verify `user_cases.user_id = auth.uid()` for that
  id and that its tracked case is provider `ceac`; compute a body hash of
  status+detail; if it differs from `tracked_cases.body_hash`, insert
  `case_status_events` and update `tracked_cases` (current status/detail,
  `last_checked_at`, `last_changed_at`); otherwise only bump
  `last_checked_at`. Enforce sane lengths on inputs. Grant to
  `authenticated` only. Mirror the event/update logic of `applyResult` in
  check-cases so history looks the same for every provider.

### Shared (`packages/shared`)

- Validators: extend `providers.ts` with `ceacImmigrantSchema`
  (existing `ceacCaseSchema` pattern) and `ceacNonimmigrantSchema`
  (application IDs look like `AA` + 8 alphanumerics — **verify the format**
  on the public CEAC form before hard-coding it). `normalizeCaseKey`
  produces the `IV:` / `NIV:` keys.
- `classifyStatus()`: add CEAC vocabulary with tests — e.g. "At NVC" /
  "In Transit" / "Application Received" / "Ready" → pending or inProgress;
  "Administrative Processing" → inProgress (**not** actionNeeded — it's a
  wait state, and alarming wording hurts anxious users); "Issued" →
  approved; "Refused" → denied. Anything unrecognized → unknown. Look up the
  real CEAC status list rather than relying only on this.

### Mobile

- `npx expo install react-native-webview` (check SDK 57 docs; it's included
  in Expo Go).
- Add case: a type choice — USCIS receipt · NVC immigrant case · Visa
  application (DS-160). Validate with the shared schemas.
- CEAC case detail: "Refresh from State Department" button → a WebView
  screen on `https://ceac.state.gov/CEACStatTracker/Status.aspx`.
  - Pre-select the visa type and prefill the case/application number with
    injected JS **if** the form fields can be found; otherwise the user types
    it (show it on screen with a copy button). The user picks the interview
    location (nonimmigrant) and solves the CAPTCHA themselves.
  - After submission, extract the result with injected JS that looks for the
    status heading/text in the result panel — prefer robust text matching
    against known status words over brittle CSS paths — and `postMessage`
    `{ status, detail }` back. Call `record_ceac_status`, show a success
    state, return to case detail.
  - If extraction fails, don't guess: tell the user it couldn't be read and
    let them go back. Never write a made-up status.
- Show "Last refreshed <time> · updates only when you refresh" on CEAC case
  detail, since there is no background polling for these.

### Verification limits — say this in the report

There's no public CEAC test case. The user has a real one and will test
after the run, so result-page extraction **can't be verified end to end
during** the run.
Build it, verify what can be verified (form loads in WebView, prefill,
message bridge, RPC with a fake status against a throwaway account's CEAC
case — after 0014 is applied, which is the user's step), and list the rest
as "needs a real case to test".

---

## Not in this run

- **F2 Visa Bulletin, F3 processing times** — wait for the F0b result
  (needs the user to push the probe branch). If blocked → skip for beta.
- **F6 range search** — needs USCIS production access (the sandbox only
  knows a few fixed test receipts, so there's nothing "nearby" to scan).
- **F7 push notifications** — needs the Apple Developer account.
- **Phase E** (domain, email confirmations) — before any beta tester signs up.

---

## Open inputs (fill before the run)

- **Privacy/terms contact email:** the user will create a dedicated address
  later. Use the literal placeholder `contact@REPLACE-BEFORE-LAUNCH.invalid`,
  defined **once** (e.g. `apps/web/src/lib/legal.ts` exporting
  `LEGAL_CONTACT_EMAIL`) and imported by both pages, so it's a one-line
  change. List it in the report as a launch blocker.
- **Real CEAC case for F5 testing:** the user has one and will test on
  their phone **after** the run. Build F5 fully; mark result extraction
  "awaiting user test". The user must never paste the case number into
  chat — they type it into the app.
