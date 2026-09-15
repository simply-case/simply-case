# Simply Case — handoff

**Paste or attach this file at the start of a new chat.** Rewritten
2026-09-14 as the single, current source of truth. It supersedes older
statements in `docs/ROADMAP.md` (a chronological log — some of its earlier
entries were later corrected) and `docs/PHASE_F_PLAN.md` (a completed build
spec, now historical). `docs/PLAN.md` still holds the original architecture
and product decisions.

> **Status at end of 2026-09-14 (evening):** the user's reported app issues
> (Phase 0) were fixed as a mobile UI pass (see §3 "Mobile UI pass") and
> tested on the user's phone. **NVC refresh still does not work** (§3 known
> problems #1). Next up is §6.

---

## 1. How the user wants you to work (standing rules)

- **Ask before `git commit`, `git push`, and before writing summary or
  handoff docs.** Say what you intend to do and wait for a yes. The user
  sometimes pre-approves a batch explicitly ("do everything except
  pushing"). That approval covers only the task it was given for.
- **After every commit, explain in plain language** what went in and why.
  A few lines, not a changelog.
- **Feature branch per feature → PR → `main`.** Never commit directly to
  `main`. (Exceptions, each chosen deliberately by the user: the Phase F
  work shipped as a single combined PR, #18; the 2026-09-14 mobile UI pass
  was committed and pushed straight to `main`. Neither extends to future
  work, so ask.)
- **Don't change things the user didn't ask for** (especially sign-in /
  sign-up) without asking first, even small "while I'm here" refactors.
  Propose them instead.
- **Flag every `supabase db push` / `supabase config push` before running
  it.** There is ONE Supabase project shared by all branches, so a
  migration from any branch hits production immediately. Run `--dry-run`
  first. For `config push`, always `config diff` first.
- **Never print secret values.** Presence check: `grep -c "^KEY=" file`.
  To verify a function secret, compare the SHA-256 of the local value
  against `npx supabase secrets list` digests, using `bash -c` (not zsh,
  which lacks `${!var}`).
- **Verify against the live system, not exit codes or assumptions.** Most
  real bugs in this project were "successful" commands that didn't work.
- **Be honest about uncertainty.** Say "unverified" rather than claiming a
  fix works before seeing it work. A previous session blamed a Supabase
  platform incident whose symptoms didn't match, and that cost a day.
- **Explain things simply.** The user is not deeply technical and prefers
  short, step-by-step instructions.
- **Model split:** Opus for planning/review/questions, Sonnet for coding.
  Remind the user to switch at transitions.
- **The repo is public.** Never put secrets or the user's real case
  numbers in committed files.

---

## 2. What this is

Immigration case tracker ("Simply Case"): users add USCIS receipt numbers
(and, new, NVC/DS-160 visa cases), and get status history plus email
notifications on change. Mobile (Expo) is the primary platform; web
(Next.js) is secondary. Both share one Supabase backend.

| Thing | Value |
|---|---|
| GitHub | github.com/simply-case/simply-case (public) |
| Live web | https://simply-case-web.vercel.app (Vercel project `simply-case-web`, root `apps/web`, auto-deploys on push to `main`) |
| Supabase | project ref `ltpvagdbprwzqtasurez`, us-east-1 |
| Local path | `/Users/manimann/Documents/personal projects/mycasepro`. **The space in "personal projects" is still there.** Some older docs claim it was renamed to `personal-projects`; it was not. |
| Stack | Next.js 16 (App Router) · Expo SDK 57 + expo-router · Supabase (Postgres, Auth, Edge Functions/Deno, pg_cron, pg_net, Vault) · Resend · npm workspaces |
| Accounts | Exactly one user account exists: the owner's. |

Repo layout: `apps/web`, `apps/mobile`, `packages/shared` (Zod validators,
hand-maintained generated DB types, design tokens, `classifyStatus()`),
`supabase/migrations` (0001–0014), `supabase/functions`, `docs/`,
`scripts/`.

**Framework warnings in the repo itself:** `apps/web/AGENTS.md` says this
Next.js version has breaking changes, so read
`node_modules/next/dist/docs/` before writing web code.
`apps/mobile/AGENTS.md` says Expo changed, so read
https://docs.expo.dev/versions/v57.0.0/ before writing mobile code, and
install native packages with `npx expo install`.

---

## 3. Current state (verified live 2026-09-14)

### Working
- **USCIS polling is healthy again.** `check-cases` runs every 15 min, and
  runs since ~10:00 PT 2026-09-14 show `updated=1, errored=0`. The polling
  history below explains the outage.
- **Email notifications** (`send-notifications`, every 5 min, respects
  quiet hours).
- **Real News tab:** 38 items in `news_items` (Federal Register + USCIS
  newsroom), refreshed every 3 h by `fetch-news`.
- **Resources tab** (was "More"): 5 official links opened in the in-app
  browser.
- **Legal pages** live at `/legal/terms` and `/legal/privacy` (public),
  with signup links and case-detail disclaimers on web and mobile.
- **In-app account deletion** (`delete-account` function, verified end to
  end with a throwaway account).
- **Auth:** password signup/login, forgot/reset password on web and mobile
  (mobile deep link verified on a real iPhone).

### Mobile UI pass (2026-09-14, tested on the user's iPhone)
- **Design tokens revised** (`packages/shared/src/theme.ts`): warm cream
  background, rounder radii, new `link` color (bright blue, for tappable
  text) distinct from `accent` (navy, for buttons). Serif headlines via
  `fontFamily.serif` in `apps/mobile/lib/theme.ts` (Georgia on iOS, no font
  files). Web does not consume these tokens, so web is unchanged.
- **Sign-in** rebuilt from the user's reference design: logo lockup,
  serif headline, eye toggle on password (`Input secureToggle`), divider,
  "Create account / Sign in" link at the bottom. Still defaults to sign-up.
- **Cases tab:** hamburger (top-left) opens a dropdown with Notification
  settings and Help & feedback. Under "My Cases (N)": header refresh
  button (does NOT trigger the pull-to-refresh animation), "+ Add case",
  always-visible search, separate Sort and Filter pills (bottom sheets),
  and a collapsible "Archived (N)" section. Only Cases has a header icon;
  News/Resources/Profile don't.
- **Add-case flow** (`cases/add.tsx`, modal): pick USCIS / NVC / DS-160,
  then a per-type screen (number + optional nickname + format help).
  Replaced the old inline form. CEAC cases in the list open straight into
  the refresh screen.
- **Profile** is now a settings list: Notification settings (own screen,
  holds quiet hours) → Help & feedback (own screen, FAQ + send feedback)
  → Contact us → Terms → Privacy → Sign out (now confirms) → Delete
  account. Contact/feedback use `CONTACT_EMAIL` in `apps/mobile/lib/links.ts`,
  still a placeholder like the web one, so they show "not available yet".
- Root stack gained `notifications` and `help` screens (session-guarded).

### Built but NOT yet verified by the user
- **Delete-account button in the mobile UI.** The function itself is
  verified.
- **DS-160 Application ID format regex** (`^[A-Z]{2}\d{8,12}$`) is
  unverified against the real form.
- **Polling watchdog** (migration 0012). Applied, but **not armed**: it
  needs two Vault secrets the user hasn't set yet (see §6).

### Known problems / open items
1. **NVC/CEAC refresh does not work** (user-tested 2026-09-14): the
   in-app WebView sits forever on ceac.state.gov's "performing security
   check" page. A desktop-Chrome user agent and an "open in your regular
   browser" link were added; the user reports it still fails. **User's
   decision: fix it with a CAPTCHA-solving service** (this reverses the
   §5 rejection; see §5 for the open questions). Not started.
2. **`EAC9999103403` is circuit-broken** (`consecutive_errors = 10`, from
   the 401s during the key rotation on 09-13), so only `LIN9999106498` is
   being polled, about half the possible sandbox traffic. Resetting it is
   a production data write that needs the user's OK:
   `update tracked_cases set consecutive_errors = 0 where case_key = 'EAC9999103403';`
3. **Temporary 14-min polling interval** is set on the two USCIS test
   cases (`check_interval_seconds = 840`, vs the 21600 default) to build
   sandbox traffic for USCIS production access. **Revert after production
   access is granted:**
   `update tracked_cases set check_interval_seconds = 21600 where provider = 'uscis';`
4. **USCIS production access:** USCIS requires 5 consecutive days of
   sandbox traffic, then an email to developersupport@uscis.dhs.gov. Count
   days from `poll_runs` rows with `updated > 0`. **The sandbox only runs
   M-F 7:00 AM - 8:00 PM ET (4 AM - 5 PM PT)**; outside that it returns
   503 "Sandbox is unavailable" (verified 2026-09-14 from
   `tracked_cases.last_error_message`). Much of the 09-12/09-13 "outage"
   was just the weekend. 2026-09-14 (Mon) had 41 successful calls. If
   "5 days" means business days, Mon 09-14 to Fri 09-18 completes it, so
   the email could go out Fri 09-18 evening or Mon 09-21; confirm how
   USCIS counts before relying on that. The USCIS developer portal's
   Analytics page is in **ET** and defaults to "Average response time",
   not request count, which makes days look missing when they aren't.
5. **Legal contact email is a placeholder**
   (`apps/web/src/lib/legal.ts` → `LEGAL_CONTACT_EMAIL`). The user will
   create a real address. **Blocker before any beta tester signs up.**
6. **No verified email domain (Phase E).** Resend's test sender only
   delivers to the owner. `enable_confirmations = false`, so anyone can
   register an email they don't own. Buy a domain before any second person
   gets an account (details in §7).
7. **Cloudflare probe not run yet.** `.github/workflows/probe-gov-sources.yml`
   is on `main` but has never run. Start it from GitHub → Actions → "Probe
   government data sources" → Run workflow. It decides whether the Visa
   Bulletin and processing times can be built (§5).
8. **`packages/shared/src/database.types.ts` is hand-patched** for
   migrations 0009, 0012, 0013 and 0014. Regenerate it with
   `npm run db:types` (changes a tracked file, so use a branch).
9. **Sandbox case `EAC9999103400` was deleted** by a verification test on
   2026-09-13. It's a fixed USCIS test receipt, so it can be re-added.
10. **Dependabot:** 7 open PRs and 2 moderate vulnerabilities on `main`.
    Don't bulk-merge. The grouped `npm-minor-patch` PR is safe; the
    `typescript`, `eslint` and `@types/node` major bumps need testing.
    The async-storage 3.x PR was already closed (Expo 57 pins 2.x).
11. **`secure_password_change` is off.** A recovery link gives a full
    session without re-authentication. Turn it on in the same config push
    as Phase E.
12. **Android never tested** (no Android SDK on this machine).

---

## 4. Architecture you need to know

### Data model (Supabase)
- `tracked_cases`: one shared row per real-world case
  (`provider` + `case_key`, unique). `user_cases` is the per-user
  subscription, so N users on one case cost one poll.
- `case_status_events`: append-only history.
  `source in ('api_history','poll','ceac_refresh')`.
- Users never read `tracked_cases` / `case_status_events` directly; RLS
  exposes them only through the `my_case_details` / `my_case_events` views.
  Inserts go through the `add_case()` RPC (security definer).
- `profiles`, `devices` (push, unused), `notifications` (queue; only
  `channel='email'` is enqueued, push is paused).
- `poll_runs`: one row per `check-cases` run (claimed / updated / errored /
  crashed). This is the answer to "is polling healthy?".
- `news_items` (0013), read-only for authenticated users.
- `ops_alerts` + `check_polling_health()` (0012), the watchdog.
- CEAC cases use `provider = 'ceac'`, with the type encoded in `case_key`
  as `IV:<NVC case #>` or `NIV:<DS-160 id>` (see
  `normalizeCeacCaseKey` / `parseCeacCaseKey` / `displayCaseKey` in
  `packages/shared/src/providers.ts`). `record_ceac_status()` (0014) is the
  only way a CEAC status changes: it checks ownership, hashes the status to
  detect a change, writes the event, and enqueues email.

### Background jobs (pg_cron → pg_net → Edge Function)

| Cron job | Schedule | Target |
|---|---|---|
| `check-cases-uscis` | `*/15 * * * *` | `check-cases` |
| `send-notifications-email` | `*/5 * * * *` | `send-notifications` |
| `fetch-news` | `0 */3 * * *` | `fetch-news` |
| `polling-watchdog` | `*/30 * * * *` | SQL `check_polling_health()` (runs inside Postgres, no function) |

Rules that are easy to break:
- Every cron `net.http_post` **must** pass `timeout_milliseconds := 60000`.
  The 5-second default caused an outage.
- Cron-called functions authenticate with an `x-cron-secret` header, and
  the value is read from Vault (`cron_secret`) at call time. Deploy them
  with **`--no-verify-jwt --use-api`**, or every cron call gets a 401.
- **`delete-account` is the exception:** it's called by a signed-in user,
  so it's deployed WITH JWT verification (no `--no-verify-jwt`).
- Functions build their database client from **`SERVICE_SECRET_KEY`**, a
  function secret holding the new `sb_secret_` key, not the auto-injected
  legacy `SUPABASE_SERVICE_ROLE_KEY`. There's no silent fallback, on
  purpose.
- `check-cases` wraps every database write that follows a USCIS network
  call in `withRetry()` (one retry after 500 ms). This mitigates the
  intermittent "Gateway Timeout"; see §8.
- A case with `consecutive_errors >= 10` is dropped by `claim_due_cases`
  and never polled again until reset. 503/429 from USCIS don't count as
  errors.

### Deployed Edge Functions (as of 2026-09-14)
`check-cases` (no-jwt) · `send-notifications` (no-jwt) · `fetch-news`
(no-jwt) · `delete-account` (JWT verified). Shared code lives in
`supabase/functions/_shared/` (`uscis.ts`, `news.ts`, with offline
fixture-based tests).

### Status classification (`packages/shared/src/status.ts`)
`classifyStatus()` maps provider text to
`pending | inProgress | actionNeeded | approved | denied | unknown`.
**Order matters** (most specific first), and **uncertain text must fall to
`unknown`, never a guess.** A false `actionNeeded` or a false `approved` is
the worst possible output. CEAC's short vocabulary is matched **exactly**
before any substring pattern runs, because substring matching once turned
"Notice of Intent to Deny Was Issued" into `approved`. Add a regression
test for every change.

### Mobile specifics
- Tabs: Cases (nested stack: list → `[id]` → `ceac-refresh/[id]`) · News ·
  Resources · Profile.
- Deep links: listen at app start via `apps/mobile/lib/deep-link.ts`.
  Never use `Linking.useURL()` on a screen a link navigates to.
- CEAC WebView: CEAC's form **posts back to the same URL**, so use
  `onLoadEnd` (with a load counter that skips the first form page), not
  `onNavigationStateChange`.
- Button variants include `danger` (used for Delete account).
- Scheme/bundle ID stay `mycasepro://` / `pro.mycase.app`, because they're
  in the Supabase redirect allowlist.

---

## 5. Product decisions already made (don't re-litigate)

Scope was widened on 2026-09-12 to match the incumbent app, "Case Tracker
for USCIS".
- **Civics quiz: out, by decision.**
- **CEAC/NVC: decision REVERSED on 2026-09-14.** Originally
  user-assisted refresh only (user solves the CAPTCHA in a WebView), with
  a CAPTCHA-solving service rejected for ToS, cost and fragility. The
  WebView flow turned out not to work at all (stuck on the security
  check), and the user has decided to use a CAPTCHA-solving service
  instead. Still to decide before building: which service and its cost
  per lookup, how often to check (every lookup costs money, so not the
  USCIS cadence), whether this runs server-side (Edge Function) or on the
  device, and how to handle State Department terms of use. There's still
  no CEAC API at any price.
- **EOIR (immigration court): back IN scope as of 2026-09-14**, queued
  after the verification work (§6). Findings from a quick check of the
  official EOIR Automated Case Information System
  (https://acis.eoir.justice.gov/en/) on 2026-09-14:
  - No API. Lookup needs an **A-Number (9 digits; pad 8-digit numbers
    with a leading 0) plus nationality**.
  - **Protected by hCaptcha**, so it has the same problem as CEAC. The
    CAPTCHA-service decision above would likely cover both; design them
    together.
  - Results show the **next hearing date, time and court location**, the
    assigned immigration judge, and limited info on decisions, motions and
    appeals. Primary case only; no bond hearing info. Its own disclaimer
    says it's "for convenience only" and court documents are the official
    record.
  - Not a status string like USCIS, so it needs its own data shape (next
    hearing as a first-class field), its own case-detail layout, and its
    own classifier mapping. Wrong hearing info could make someone miss
    court, so the disclaimer must be prominent.
  - A-Numbers are sensitive government IDs, so update the Privacy Policy
    before launch. The schema already allows `provider = 'eoir'` and
    `aNumberSchema` exists in `packages/shared/src/providers.ts`.
  - Also available by phone: 1-800-898-7180.
- **Data retention:** keep user data until the user deletes their account.
  Saving a Visa Bulletin priority date is OK.
- **Visa Bulletin (not built):** daily cron storing the full bulletin plus
  the raw HTML, alerting on parse failure. Personalization ("your date is
  current") is the valuable part.
- **Processing times (not built):** USCIS JSON endpoint
  (`egov.uscis.gov/processing-times/api/…`) shown on case detail with no
  user input, plus NVC timeframes.
- **Cloudflare blocks those sources** (Visa Bulletin, NVC timeframes, USCIS
  processing times) from Supabase's servers: 403, confirmed 2026-09-12.
  USCIS newsroom and the Federal Register are fine. Plan: run the GitHub
  Actions probe (§3 item 7). **If GitHub is also blocked, skip F2/F3 for
  the beta** and keep them as Resources links. A paid proxy (~$50/mo) is
  the post-beta option.
- **Range search (not built):** official USCIS API only, async job queue,
  a **global rate limiter in Postgres** (10 TPS is the account ceiling,
  shared with polling), cache every scanned receipt, ~5 scans per user per
  day. Needs USCIS production access (the sandbox has no nearby cases).
  The abuse-signature risk was raised and knowingly accepted by the user.
- **Push notifications (not built):** need the Apple Developer account
  ($99), which the user wants to do later. Lock-screen text must not reveal
  status (private by default).
- **Monetization:** free, no limits, for now.
- **Naming:** "Simply Case" in all user-visible text. Internal IDs stay
  `mycasepro`.

## 6. What's next (suggested order)

1. ~~Fix the user-reported app issues~~ Done 2026-09-14 (mobile UI pass, §3).
2. **Verify and unblock (quick, mostly the user's actions):**
   - With the user's OK: reset `EAC9999103403`'s error count (§3 #2),
     ideally before the sandbox opens at 4 AM PT on a weekday.
   - Test the mobile Delete account button with a throwaway account.
   - Arm the watchdog; **the user runs these in the Supabase SQL Editor**,
     so the key never passes through chat:
     ```sql
     select vault.create_secret('<Resend API key>', 'resend_api_key');
     select vault.create_secret('<owner email>', 'alert_email');
     ```
     Note: the Resend key then lives in 4 places (`.env.local`, function
     secret, Supabase SMTP password, Vault), so update all 4 on rotation.
   - Run the Cloudflare probe workflow (GitHub → Actions → "Probe
     government data sources" → Run workflow).
   - Track the USCIS 5-day streak (§3 #4), then email USCIS for
     production access.
3. **CAPTCHA-service design, for CEAC and EOIR together** (§5): pick a
   service, estimate cost per lookup, decide check frequency and where it
   runs, and review terms of use. Talk it through with the user before
   building anything.
4. **Fix NVC/DS-160 refresh** using that service.
5. **Add EOIR cases** (§5 findings): A-Number + nationality input,
   next-hearing data model and case-detail layout, classifier mapping,
   an EOIR tile in `cases/add.tsx` and the case-type filter, and a Privacy
   Policy update.
6. Decide Visa Bulletin / processing times based on the probe result.
7. Regenerate DB types; triage Dependabot.
8. Real legal contact email (web `legal.ts` + mobile `lib/links.ts`) →
   Phase E (domain, Resend sender, re-enable confirmations +
   `secure_password_change`, add Vercel preview URLs to the redirect
   allowlist; all one `config diff` → `config push`, flagged).
9. TestFlight path: Apple Developer account → EAS cloud build (doesn't need
   the folder rename) → privacy URL (done) → beta. Only local native builds
   (`npx expo run:ios`) are blocked by the space in the folder path.
10. Later: range search (after USCIS production access), push, Visa
    Bulletin personalization, offline states (neither app has any offline
    handling), Android.

---

## 7. Environment

**Vercel** (3 vars, all public): `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SITE_URL`.

**`apps/web/.env.local`** (gitignored; the only local file with secrets):
the 3 above plus `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`,
`NOTIFICATION_FROM_EMAIL`, `USCIS_CLIENT_ID`, `USCIS_CLIENT_SECRET`.
**`apps/mobile/.env`**: `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (public by design).

**Edge Function secrets:** `CRON_SECRET`, `SERVICE_SECRET_KEY`,
`USCIS_CLIENT_ID`, `USCIS_CLIENT_SECRET`, `USCIS_ENVIRONMENT` (sandbox),
`RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`. The `SUPABASE_*` names are
auto-injected and reserved.

**Vault:** `cron_secret` (set). `resend_api_key`, `alert_email` (NOT set
yet).

**Credentials were rotated 2026-09-12/13** (Supabase secret key, Resend,
USCIS). When rotating USCIS, update **both** `USCIS_CLIENT_ID` and
`USCIS_CLIENT_SECRET`; a mismatched pair caused 401s.

**Email:** Resend test sender `onboarding@resend.dev` delivers only to the
owner. Supabase Auth SMTP also uses Resend.

**Redirect allowlist:** `http://localhost:3000/**`,
`https://simply-case-web.vercel.app/**`, `mycasepro://**`, `exp://**`
(Vercel previews not included).

## 8. Commands

```bash
npm run typecheck                 # all workspaces (61 tests + clean typecheck as of 2026-09-14)
npm test                          # node --test on supabase/functions/_shared + packages/shared
npm run dev                       # web
cd apps/mobile && npx expo start --go --tunnel   # phone testing (--tunnel needed for a real device)
bash scripts/check-env.sh         # validates apps/web/.env.local without printing values
npx supabase db push --dry-run    # ALWAYS before a real push (flag to user first)
npx supabase functions deploy <name> --no-verify-jwt --use-api   # cron functions
npx supabase db query --linked "select ..."   # read-only checks
```
The Supabase CLI is run via `npx --no-install supabase` (not globally
installed).

**Polling health check:**
```sql
select to_char(started_at at time zone 'America/Los_Angeles','MM-DD HH24:MI') t,
       claimed, updated, errored, crash_message
from poll_runs order by started_at desc limit 12;
-- real HTTP results of cron calls (kept ~6h):
select created, status_code, left(content,150) from net._http_response order by created desc limit 10;
```

USCIS sandbox test receipts: `EAC9999103403`, `LIN9999106498`,
`EAC9999103400`.

---

## 9. History that explains the current code

**Polling outage, 2026-09-12 → 09-14.** Three separate causes:
1. The pg_net 5-second default timeout cut off most cron calls. Fixed with
   0011 (60 s).
2. After the key rotation, `USCIS_CLIENT_ID` in function secrets was stale
   while `USCIS_CLIENT_SECRET` was new, a mismatched pair giving 401s.
   Fixed by resetting the ID.
3. An intermittent "Gateway Timeout" on database calls from inside
   functions. A diagnostic function showed isolated and concurrent calls
   always succeed fast; the one slower response appeared only after a
   multi-second gap, which matches the real pattern (claim → wait on USCIS
   → write). The likely cause is a pooled connection going stale during
   the wait. **Unproven.** Mitigated with `withRetry()` plus switching to
   `SERVICE_SECRET_KEY`. Polling has been clean since 2026-09-14 ~10:00
   PT.

**Phase F build (2026-09-13)** shipped as PR #18: Resources tab, news,
legal and deletion, CEAC, watchdog, probe workflow. A review before
testing caught 4 bugs (CEAC source check constraint, classifier substring
collision, WebView detection never re-running, watchdog blind to
circuit-broken cases). All fixed before merge.

## 10. Lessons learned (don't re-learn these)

- `supabase config push` applies every declared property. Always
  `config diff` first.
- pg_net times out after 5 s by default. Pass `timeout_milliseconds`.
  `cron.job_run_details` "succeeded" only means the request was queued;
  read `net._http_response` for real results.
- A rotated secret isn't rotated until every copy matches (check digests).
  Rotate USCIS ID and secret together.
- Check existing CHECK constraints before inserting a new enum-like value.
- Substring regexes on status text collide across providers. Exact-match
  short vocabularies first.
- ASP.NET WebForms pages post back to the same URL. WebView detection must
  use `onLoadEnd`.
- Test destructive functions against data that can't collide with real
  rows (a shared sandbox case got deleted as "orphaned").
- Don't attribute a failure to a platform incident unless the symptoms
  match. Build a diagnostic and test the actual call pattern.
- macOS `/bin/bash` is 3.2 (no `declare -A`). zsh has no `${!var}`, so use
  `bash -c` for those.
- Node's built-in TS stripping (used by `npm test`) rejects constructor
  parameter properties (`constructor(public x)`).
- After switching git branches, a stale `apps/web/.next` can reference
  missing routes and fail typecheck. Delete `.next` (gitignored).
- Expo Router route types can go stale: kill Metro, delete
  `.expo/types/router.d.ts`, restart.
- A `Tabs` layout has no implicit `/` route (needs a hidden redirect
  screen).
- PostgREST can only embed across a real foreign key.
- Next.js pins its own React version; two React copies in the monorepo is
  expected.
- CLI exit code 0 ≠ success (pod install / xcodebuild). Update packages
  before building, never after.
- Logo PNGs can carry hidden transparent padding; measure with
  `sharp().trim()`.
- macOS filesystem is case-insensitive (`icon.PNG` overwrote `icon.png`).
- Compare branches against `origin/main` after `git fetch --prune`.
- Expo Go can't test offline behaviour (it loads JS from the dev server).
- `uscis.gov/rss.xml` is not a newsroom feed (stale site content). Parse
  `/newsroom/all-news` instead.
- Don't stack new branches on an unmerged base without saying so; it
  complicates PR diffs.
