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
1. **NVC/CEAC refresh: the CEAC page now loads** (fixed 2026-09-16, see
   §9). What's left is UX, not access: the user still types the case
   number, passport and surname into the CEAC form by hand every time.
   The agreed fix is in-app autofill with phone-only storage (§5), built
   in two steps (§6).
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
7. **Cloudflare probe: RUN 2026-09-16, and GitHub is blocked too.** Run #1
   of `probe-gov-sources.yml` returned 403 + a Cloudflare challenge page
   for `bulletin_index`, `bulletin_sep_2026`, `nvc_timeframes` and
   `uscis_processing_forms`. Per `docs/PHASE_F_PLAN.md`, that means
   **skip F2/F3 (Visa Bulletin, processing times) for the beta** — they
   stay as Resources links. A paid proxy (~$50/mo) is the post-beta
   option. (`uscis_news` 403 / `federal_register` curl_error in that same
   run are probe-side quirks, not real outages: `fetch-news` has been
   populating `news_items` from both sources in production throughout.)
   **New option worth considering before paying for a proxy:** the CEAC
   fix on 2026-09-16 proved the *phone's* WebView passes Cloudflare
   challenges that servers can't. A Visa Bulletin feature could load the
   page on-device, parse it there, and send only the parsed numbers to
   Supabase — no proxy, no per-request cost. Untested.
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
- **CEAC/NVC: user-assisted refresh, now with in-app autofill** (decided
  2026-09-16, after the WebView was fixed — see §9). The CAPTCHA-solving
  service considered on 09-14 is **not needed and not being built**: the
  user solves the CAPTCHA in the app, so nothing is bypassed and there's
  no per-lookup cost. Agreed design:
  - **Sensitive data stays on the phone.** Passport number, surname and
    consulate location go in iOS secure storage (Keychain, via
    expo-secure-store), **never** in Supabase, logs or backups. The user's
    reasoning: if the server never holds it, no server bug can leak it.
    Still needs a Privacy Policy update and an App Store data disclosure —
    collecting it is our responsibility wherever it lives.
  - **Consequence, accepted:** no background polling and no email alerts
    for CEAC cases, because a human must solve a CAPTCHA every lookup.
    Mitigation is a weekly "tap to check" reminder push (needs the Apple
    Developer account).
  - **Fragility safety net.** CEAC is ASP.NET WebForms; a renamed field
    must never produce a wrong status. Done: (1) autofill only ever
    writes into a field, never submits, and skips a field that's already
    non-empty rather than overwriting it. (2) status is never saved
    without the user confirming what's on screen (the "We noticed the
    page mentions: X" → tap to record flow, unchanged since Phase F).
    (4) and (5) — an ops_alerts-style breakage alert, and an HTML
    snapshot test fixture — are NOT built yet; revisit once the CAPTCHA
    flow is confirmed working end to end.
  - Degrading gracefully means: the "Show the CEAC page" toggle (see §9)
    reveals the real form so the user can finish it by hand — autofilled
    fields carry over since it's the same underlying page, just made
    visible.
  - **If email alerts for CEAC are ever wanted**, they require automated
    CAPTCHA solving (~$1.20/1000 via 2Captcha-class services) AND the form
    data being available without the user. Two routes: server-side (needs
    passport data on the server — reverses the privacy decision above) or
    on-device background refresh (keeps data on the phone, but iOS
    background execution is infrequent and unreliable). Both re-open the
    terms-of-use question. Not planned; revisit only if users ask.
  - There's still no CEAC API at any price.
- **EOIR (immigration court): built 2026-09-17**, mirroring the CEAC
  pattern above (autofill + visible WebView + real user tap + manual
  recording), at the user's explicit request to do "the same thing" while
  the captcha question is worked out separately. What shipped:
  - `cases/add.tsx` has a fourth tile ("Immigration court"); collects
    A-Number (the case_key, sent to Supabase like a USCIS receipt number)
    and an optional nationality (device-only, `lib/eoir-details.ts`, same
    reasoning as CEAC's passport/surname).
  - `cases/eoir-refresh/[id].tsx` loads acis.eoir.justice.gov/en/ visibly,
    autofills the A-Number into its 9-box `react-code-input` control
    (**confirmed working on device**) and the nationality into its
    react-select dropdown, then leaves the captcha and the Submit tap to
    the user, exactly like CEAC.
  - **ACIS is a React app, unlike CEAC's server-rendered ASP.NET**, so
    elements often don't exist yet when `onLoadEnd` fires. The autofill
    script therefore POLLS for each element (250ms × 40 ≈ 10s) instead of
    looking once, and each step runs concurrently rather than chained —
    chaining stalled autofill for the full timeout whenever the disclaimer
    wasn't shown. Copying CEAC's single-shot approach here was a mistake;
    don't reintroduce it.
  - **An "I Accept" disclaimer gates the page on every visit; the app
    clicks it automatically** (user's explicit decision 2026-09-17: people
    use the app precisely so they don't do these steps by hand). Matched
    by exact button text — `class="btn"` is shared with other buttons
    including Submit, so it is NOT safe to target by class. The substance
    of that disclaimer ("for convenience only", court documents are the
    official record) is shown in our own UI on the refresh screen instead,
    so auto-clicking doesn't cost the user the warning itself.
  - **Nationality matching must be EXACT.** First version matched "option
    text contains the country name" and picked BRITISH INDIAN OCEAN
    TERRITORY (`IO`) when the user chose INDIA (`IN`) — it contains
    "INDIA" and sorts first. Now it matches ACIS's full label
    (`NAME (CODE)`) by string equality and, if there's no exact match,
    picks **nothing** and says so. Never add a "close enough" fallback: a
    silently wrong nationality returns "no information found", which is
    indistinguishable from "this case doesn't exist".
  - **ACIS HAS A REAL JSON API — the most important finding of 2026-09-17.**
    Read out of their own Gatsby bundle
    (`/component---src-pages-index-*.js`, grep `eoir-ws`):
    ```
    GET https://eoir-ws.eoir.justice.gov/api/Case/GetCaseInfo
          ?alienNumber=<9 digits>&languageCode=EN&natCode=<EOIR code>
    Header: Captcha-Token: <hCaptcha token>
    ```
    Their hCaptcha sitekey is in the same bundle (grep `sitekey:`); it's
    public by design, embedded client-side.
    **Confirmed by direct curl, 2026-09-21** (real A-Number, placeholder
    natCode, no Captcha-Token header):
    `{"message":"Invalid Captcha Provided."}` (HTTP 400) — also confirmed
    `natCode` is required server-side (`{"message":"Nationality Code must
    be provided"}` when omitted). So the captcha IS enforced server-side,
    not just client-side UI, and there is no way to call this successfully
    without a real captcha solve — direct calling (route 2 below) is
    therefore blocked on the same paid-service/ToS decision as CEAC, not
    simpler. **The shape of a SUCCESSFUL response is still unknown** — that
    needs a real device to solve the real captcha, which only the user can
    do.
    Three consequences, all of which make EOIR *easier* than CEAC:
    1. Results come back as **structured JSON**, so the "we need real
       post-submission HTML to scrape" problem can be skipped entirely.
    2. **No trusted-click problem.** What killed CEAC's automation was
       needing a genuine finger-tap on a button (script-dispatched clicks
       are `isTrusted: false` and Cloudflare discards them). Here there is
       no button — it's an HTTP request with a header. That barrier simply
       does not exist for EOIR.
    3. Fully-background lookup is therefore realistic for EOIR in a way it
       is not for CEAC: get a token, call the API, done.
    Two routes, in increasing order of commitment:
    - **Intercept — built 2026-09-21** (`FETCH_INTERCEPT_SCRIPT`,
      `cases/eoir-refresh/[id].tsx`): keep their page in the WebView, user
      solves the captcha and submits as normal, but hook `window.fetch` to
      capture the `GetCaseInfo` JSON response their own page already
      received (matched on the URL containing `/api/Case/GetCaseInfo`; the
      original fetch always still runs and its result is returned
      untouched). Nothing about their site's usage changes and no captcha
      service is needed.
      **CONFIRMED WORKING on device, 2026-09-21** — the user's own real
      case (A-Number `208492302`) returned a full successful payload,
      captured cleanly by the interceptor. Real shape (see
      `EoirCaseInfoResponse` in `eoir-refresh/[id].tsx`): `Data` (AlienName,
      CaseID, OSC_Date, ElapsedDays, LatestHearingDate/Time, decision
      strings, AppealFiled/ReopenExists/PendingAtBIA flags),
      `Proceeding` (CaseType, HearingLocationAddress),
      `Schedule` (AdjDate/AdjTime, IJ_Name, IJ_WebExURLLink,
      HearingLocationAddress). `formatEoirResult()` turns this into labeled
      rows (Next hearing, Location, Judge, Hearing link, Case type, Docket
      date) shown in a card, plus a pre-filled editable summary — still
      never auto-saved. Deliberately excludes `AlienName` from what gets
      shown/saved: it's the user's own name, already known to them,
      putting it in stored status text would be PII with no benefit.
      Field meanings NOT confirmed by documentation (CaseType "RMV",
      ClockStatus "R") are shown as raw codes, not translated — same
      "never guess" principle as CEAC's error relay. Only one real sample
      exists so far; the interface may not cover every response shape
      (e.g. a case with an actual decision, or `ValidAlienNumber: false`).
    - **Call it directly:** mint an hCaptcha token via a solving service
      and call the API ourselves, no WebView. **Unverified:** whether a
      token minted off their page passes their server-side check
      (hCaptcha verification returns the hostname, which they may check).
      Also crosses hCaptcha's own ToS against automated solving — a
      decision with a terms dimension, not just a technical one.
  - **Deliberately NOT built yet:** automatic result/error scraping. CEAC's
    `ERROR_CHECK_SCRIPT` only exists because the user pasted the real
    `#ctl00_ContentPlaceHolder1_lblError` element from a live submission —
    nothing equivalent has been inspected for ACIS. Instead the EOIR
    screen has the user type what the page says into a free-text box and
    save it via `record_manual_status`. Once real post-submission HTML
    (success and "not found" cases) is available, build the same kind of
    verbatim-element relay CEAC has.
  - `record_ceac_status` was **renamed to `record_manual_status`** and
    widened to accept `eoir` as well as `ceac` (migration
    `0015_eoir_refresh.sql`, not yet applied/pushed — ask before running
    `supabase db push`). `database.types.ts` was hand-patched again,
    same as migration 0014 was; regenerate with `npm run db:types` once
    pushed.
  - Original 2026-09-14 findings, still accurate: no API; **protected by
    hCaptcha** (harder/pricier to solve than CEAC's plain BotDetect image
    text — see the captcha-service pricing note below); results are a
    **next hearing date/time/court**, assigned judge, and limited
    decision/motion/appeal info, primary case only, no bond hearing info;
    its own "for convenience only" disclaimer. A-Numbers are sensitive
    government IDs — Privacy Policy still needs updating before launch.
    Also available by phone: 1-800-898-7180.
  - **Captcha-solving services, if/when automated submission is revisited**
    (researched 2026-09-17): CEAC's BotDetect captcha is a plain
    distorted-text image — the cheapest category ("ImageToText"/"normal
    captcha"), ~$0.40-1.00 per 1,000 solves, <1-15s. EOIR's hCaptcha is a
    pricier, slower category (~$1.20-2/1,000, a few seconds) since it's an
    interactive challenge, not just image-to-text. Whatever solving
    approach gets picked for CEAC should extend to EOIR rather than being
    designed twice.
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
3. ~~CEAC autofill + in-app CAPTCHA~~ Built 2026-09-16 (§9) against the
   real page's element ids. **Not yet confirmed:** what happens after a
   correct CAPTCHA is submitted — reading the real result page hasn't
   been tested. Once it is, build the two still-open safety-net items
   (§5): alert-on-breakage, and an HTML snapshot test fixture.
4. ~~Add EOIR cases~~ Built 2026-09-17. `window.fetch` interceptor added
   2026-09-21 and **confirmed working end-to-end on device** — real
   A-Number, real captcha solve, real successful `GetCaseInfo` capture,
   formatted into readable rows (§5 for the full field list). Same day:
   auto-navigate straight to the refresh screen after adding an EOIR case
   (`cases/add.tsx`); hides the A-Number/nationality fields once filled so
   the visible page is mostly just the captcha and Submit; and an
   auto-submit attempt (`watchForSubmit` in `buildAutofillScript`) that
   polls for ACIS's Submit button to become enabled (i.e. captcha solved)
   and clicks it — **UNVERIFIED whether the click itself is honored**;
   ACIS sits behind Cloudflare same as CEAC, and Cloudflare silently
   discarded every scripted click CEAC tried. Test this specifically: does
   `submit_auto_clicked` appear in the log AND get followed by a real
   `eoir_api_response`? If the click logs but nothing follows, that's the
   same silent-discard pattern as CEAC — the case-detail summary hearing
   below is where to confirm this on the next real device test.
   **Next, in order:**
   - **Confirm the auto-submit and field-hiding changes on device** —
     untested as of this write-up (only the interceptor + formatter were
     confirmed, before these were added).
   - **Migration `0015_eoir_refresh.sql` is written but BLOCKED, not
     pushed.** The push itself is denied by an automated policy in this
     environment (touches the shared database) — needs the user to run
     `npx supabase db push --linked` directly (the plain `supabase` binary
     isn't actually installed — only cached under npx — so the `db:push`
     npm script as originally written doesn't work either; needs `npx`
     prefixed or the CLI added as a real devDependency). Until pushed,
     `record_manual_status` doesn't exist server-side and **both CEAC and
     EOIR status-saving are broken** (the app already calls the new name).
     Once pushed: `npx supabase gen types typescript --linked > packages/shared/src/database.types.ts`.
   - Real case-detail layout/classifier for EOIR's structured fields
     (currently a free-text status built from a template, like CEAC's),
     and a Privacy Policy update for A-Numbers.
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

**CEAC "Performing security verification" fix, 2026-09-16.** The refresh
WebView sat forever on Cloudflare's bot check. Two causes, in order:
1. A desktop **Windows Chrome user agent** had been set on the WebView to
   look "more like a real browser". That made it worse — iOS WKWebView is
   Safari's engine, so claiming Windows Chrome while every other signal
   says iPhone is exactly the contradiction bot detection looks for.
   Removed; the WebView now reports itself honestly.
2. The actual bug: Cloudflare's challenge renders in an **iframe whose URL
   is `about:srcdoc`**. react-native-webview's default `originWhitelist`
   is `['http://*','https://*']` plus an implicit `about:blank`, so
   `about:srcdoc` failed the whitelist — the load was cancelled and handed
   to `Linking`, which logged `Can't open url: about:srcdoc` (visible in
   Metro) and left the challenge stuck on "Verifying…". Fixed by passing
   `originWhitelist={["http://*","https://*","about:*"]}`. Both CEAC forms
   (IV and NIV) then load with their CAPTCHAs. **That Metro warning was
   the whole diagnosis — check Metro logs before blaming the remote site.**

**CEAC autofill + in-app CAPTCHA, 2026-09-16.** Built in two rounds
against real inspect-element HTML the user provided from the live page —
the first round guessed at field locations by visible label text and
mostly failed; the second uses CEAC's real ids and works. The actual
elements on `https://ceac.state.gov/CEACStatTracker/Status.aspx`:

| Field | Real id/selector | Notes |
|---|---|---|
| Visa type | `#Visa_Application_Type` | `<select>`, value `"IV"` \| `"NIV"`. `onchange` calls `__doPostBack` — changing it ALWAYS reloads the page. |
| Case number / DS-160 ID | `#Visa_Case_Number` | Same field for both IV and NIV. |
| Passport | `#Passport_Number` | max 20 chars |
| Surname | `#Surname` | max 5 chars |
| Location (NIV only) | `#Location_Dropdown` | `<select>`, ~230 options, value = a 3-letter consulate code (e.g. `"MTL"`), bundled in `lib/ceac-locations.ts` |
| CAPTCHA image | `img.LBD_CaptchaImage` | BotDetect control |
| CAPTCHA answer | `#Captcha` | max 10 chars |
| Submit | `#ctl00_ContentPlaceHolder1_imgFolder` | An `<img alt="submit">`, NOT `input[type=submit]`/`<button>` — a guessed generic search for those failed with `submit_button_not_found`. A synthetic `.click()` on it still bubbles to whatever handler (on it or a wrapping element) actually submits the form. |

What the first (guessed) attempt got wrong, as a lesson: searching "the
text around this input" to identify passport/surname found the CASE
NUMBER box instead, because case number, passport and surname all sit
inside ONE shared container — that container's text mentions every label,
so every hint matched the first input in it. Anchoring to the real id
fixes this outright; a future guess-based fallback (if CEAC ever changes
these ids) should anchor to `<label for="...">`/document-order-after-the-
label-text, never "nearest input in the same container".

Current flow (`cases/ceac-refresh/[id].tsx`): the CEAC page loads
invisibly (clipped into a zero-size wrapper, not `display:none`, so it
keeps rendering/executing JS) with a "Show the CEAC page" toggle as an
escape hatch. Autofill and CAPTCHA extraction inject on every load.
CAPTCHA image is pulled out via `canvas.toDataURL()` (safe: same-origin,
so no tainted-canvas error) and shown as a native `<Image>` + text field;
submitting fills `#Captcha` and clicks the Submit `<img>` via script. An
auto-reveal safety net shows the real page automatically 1.5s after a load
if neither a CAPTCHA nor a recognized status turned up — most likely
because CEAC returned something the scripts don't know how to read yet.

Also this round: the add-case flow (`cases/add.tsx`) collects optional
passport/surname (and location, via a searchable picker over
`lib/ceac-locations.ts`) once at add time — not on a separate card on the
refresh screen (tried first, removed at the user's request in favor of
this). **The type picker itself went through two versions:** briefly
merged into one "Visa case" tile with an in-form Immigrant/Nonimmigrant
toggle (mirroring CEAC's own question order), then **reverted 2026-09-17**
back to three separate tiles (USCIS / NVC case / Visa application) at the
user's request — picking the tile IS the type question again, no toggle.
The passport/surname/location collection was kept either way.

**Error detection tightened, same day:** rather than guessing at CEAC's
wording, the app now reads `#ctl00_ContentPlaceHolder1_lblError` directly
— the ONE element CEAC uses for every error on this page (confirmed from
two real submissions: "The code entered does not match the code displayed
on the page." for a wrong CAPTCHA, "Your search did not return any data."
for a right CAPTCHA but no matching case). Whatever text is in it gets
shown to the user verbatim, so a third wording neither of us has seen yet
still surfaces instead of failing silently.

**Submit button problem, found same day, NOT YET CONFIRMED FIXED:**
clicking the Submit `<img>` (`#ctl00_ContentPlaceHolder1_imgFolder`) via
script produced no error and no effect — no reload, no postback, nothing.
Repro was clean: autofill + CAPTCHA image extraction work every time,
`[ceac captcha] submitted` logs, then nothing further ever happens.
Likely cause: a script-fired `.click()` isn't always treated as a trusted
gesture, and whatever handles that image's click (probably a wrapping
`<a href="javascript:__doPostBack(...)">` — its outer HTML was never
captured, only the `<img>` inside it) may depend on that trust.

**First fix (calling `__doPostBack("...$imgFolder","")` directly) also
failed silently** — same symptom, `submitted doPostBack` logged, then
nothing. Rather than guess a third time, an automatic diagnostic was
added to `CAPTCHA_EXTRACT_SCRIPT` (runs on every load, no user action
needed) that reads the real DOM directly: does `__doPostBack` exist, how
many `<form>`s, and — the key one — the Submit `<img>`'s actual PARENT
element's tag/onclick/href. Logged as `[ceac diag]` in the terminal.

**Root cause, found from that diagnostic (2026-09-16):** the `<img
id="...imgFolder">` is purely decorative. The real control is its
wrapping `<a>`, id `ctl00_ContentPlaceHolder1_btnSubmit`, whose href is:
```
javascript:WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions(
  "ctl00$ContentPlaceHolder1$btnSubmit", "", true, "", "", false, true))
```
Two compounding mistakes in the first fix: (1) the event target name was
`imgFolder`, not `btnSubmit` — the img's id was never the control's real
name; (2) this page doesn't use plain `__doPostBack` for Submit at all,
it uses `WebForm_DoPostBackWithOptions` (which also runs client-side
validation first, per the `true` flag) — even the right name via bare
`__doPostBack` would have skipped that.

**Third attempt: ran the EXACT real expression** —
`WebForm_DoPostBackWithOptions(new WebForm_PostBackOptions("ctl00$ContentPlaceHolder1$btnSubmit",
"", true, "", "", false, true))`, copied verbatim from the link's href,
not a guessed equivalent — confirmed by the diagnostic to be 100% correct.
**Also produced no effect. Same silent nothing as the other two.**

**Conclusion, decided 2026-09-16: stop trying to submit programmatically.**
Three genuinely different mechanisms (a plain `.click()`, `__doPostBack`
with a guessed name, and the exact real `WebForm_DoPostBackWithOptions`
call) all failed identically — no reload, no error, no console exception,
nothing. That pattern, combined with a real physical tap on this same
button working every time in earlier testing (back when the page was
simply shown to the user), points at CEAC/Cloudflare's bot-management
layer silently discarding script-triggered submissions on this specific
control. There was no fourth mechanism worth trying — the evidence says
the category of approach is what's blocked, not the specific call.

**Current design (rebuilt same day):** the CEAC page is shown, visible,
by default — no more hiding it or trying to fake the tap. Autofill
(case number, passport, surname, location) and the error-relay
(`#ctl00_ContentPlaceHolder1_lblError`, verbatim, covers "wrong CAPTCHA"
and "no matching case" and anything else CEAC ever puts there) still run
automatically on every load and are what's actually valuable here — the
user only has to read the CAPTCHA and tap Submit for real; everything
else is done for them and any result is surfaced as a clean in-app
message instead of the user having to read the raw page. The native
CAPTCHA-image card, its own Submit button, and all the submit-script
machinery were removed — dead code once auto-submit was abandoned.

**Untested as of this rewrite:** whether a real result (a correct CAPTCHA
+ matching case) gets picked up by `EXTRACTION_SCRIPT`'s status-word scan
and shows the "We noticed the page mentions: X" confirm card. Verified
so far: autofill, and the error-relay for both known CEAC error messages.

**Nothing from this entire CEAC rebuild is committed yet** — ask the user
before committing (standing rule) and before touching anything outside
what's being tested (e.g. sign-in/sign-up — also a standing rule, a prior
session was corrected for changing it unprompted).

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
