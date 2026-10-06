# Simply Case — handoff

**Paste or attach this file at the start of a new chat.** Rewritten
2026-10-06 as the single, current source of truth, replacing a
2026-09-14 version on `main` that had gone stale (missing EOIR, CEAC's
root-cause fix, and everything else below — it existed in more current
form only on a feature branch that never carried the doc update into
`main`). `docs/ROADMAP.md` is an older chronological log (some entries
later corrected); `docs/PHASE_F_PLAN.md` and `docs/PLAN.md` are earlier
build specs, now mostly historical.

> **Status at 2026-10-06.** All three providers work end-to-end on a real
> device (EOIR fully automatic, confirmed; CEAC's long-standing blank-
> screen bug was root-caused and fixed but still awaits a real-case
> re-test; USCIS polls in the background). USCIS 4xx testing is DONE — the
> production-access email went out 2026-09-29, awaiting their reply.
> A large sign-in/signup rebuild plus a real USCIS-app-review legal/privacy
> compliance pass are built and pushed to `feature/sign-in-polish`
> (6 commits, **no PR opened yet**) — migrations 0018 and 0019 are both
> live in production. A real bug (a startup race that silently skipped the
> new policy re-consent screen) was found and fixed 2026-10-06. Product
> direction decided: mobile is the real product, the web app stays frozen
> as a companion, and a separate new company-site repo (`jakarallc.com`,
> domain purchased, not yet built) will host a `/simplycase` marketing
> page. A root `AGENTS.md`/`CLAUDE.md` now exists (2026-10-06) so the
> standing rules in §1 load automatically every session instead of relying
> on this doc being pasted in. Next: test the sign-in-polish branch on a
> real device, open its PR, then re-test CEAC on a real case number.

---

## 1. How the user wants you to work (standing rules)

**These same rules now also live in `/AGENTS.md`** (root `CLAUDE.md` is
just `@AGENTS.md`, matching the existing `apps/web`/`apps/mobile`
pattern), so they load automatically every session instead of needing
this doc pasted in. Keep both in sync if either changes — AGENTS.md stays
short (just the rules); this section can carry more context/reasoning.

- **Ask before `git commit`, `git push`, and before writing summary or
  handoff docs.** Say what you intend to do and wait for a yes. The user
  sometimes pre-approves a batch explicitly, or asks for the doc update
  directly (as happened for this rewrite) — that counts as asking.
- **After every commit, explain in plain language** what went in and why.
  A few lines, not a changelog.
- **Feature branch per feature → PR → `main`.** Never commit directly to
  `main`.
- **Don't change things the user didn't ask for** (especially sign-in /
  sign-up) without asking first, even small "while I'm here" refactors.
  Propose them instead. (This rule got real teeth this session: a
  multi-week sign-in redesign happened entirely because the user asked for
  it, piece by piece — the lesson is about *unprompted* changes, not about
  sign-in being off-limits.)
- **Flag every `supabase db push` / `supabase config push` before running
  it.** There is ONE Supabase project shared by all branches, so a
  migration from any branch hits production immediately. Run `--dry-run`
  first. For `config push`, always `config diff` first.
- **Never print secret values.** Presence check: `grep -c "^KEY=" file`.
  To verify a function secret, compare the SHA-256 of the local value
  against `npx supabase secrets list` digests, using `bash -c` (not zsh,
  which lacks `${!var}`).
- **Verify against the live system, not exit codes or assumptions.** Most
  real bugs in this project were "successful" commands that didn't work —
  including this session's legal-reconsent race (see §9), which produced
  no error anywhere and had to be found by reading the actual code path,
  not by re-running the same test harder.
- **Be honest about uncertainty.** Say "unverified" rather than claiming a
  fix works before seeing it work.
- **Explain things simply.** The user is not deeply technical and prefers
  short, step-by-step instructions — including plain explanations of what
  a migration, a database column, or a race condition actually means when
  asked.
- **Model split:** Opus for planning/review/questions, Sonnet for coding.
  Remind the user to switch at transitions.
- **The repo is public.** Never put secrets or the user's real case
  numbers in committed files. Also now applies to pasted external text:
  `docs/uscis-privacy-requirements.md` (USCIS's own app-review checklist,
  pasted verbatim by the user) is `.gitignore`d rather than committed,
  since it's not ours to redistribute.
- **When asked to check/delete unused files, list them — don't delete.**
  The user wants to review and delete manually.
- **Don't assume a device test used a true cold start.** Backgrounding and
  resuming an Expo Go session doesn't remount React state the way a real
  relaunch does; several "it didn't work" reports this session turned out
  to be stale bundles or state, not code bugs. Ask, or have them force-quit
  before re-testing, before concluding the code is wrong.

---

## 2. What this is

Immigration case tracker ("Simply Case"): users add USCIS receipt numbers,
NVC/DS-160 visa cases, or EOIR immigration-court A-Numbers, and get status
history plus email notifications on change. Mobile (Expo) is the primary
platform; web (Next.js) is a frozen, lightweight companion (see §5) — new
features land on mobile and may stay mobile-only. Both share one Supabase
backend.

| Thing | Value |
|---|---|
| GitHub | github.com/simply-case/simply-case (public) |
| Live web | https://simply-case-web.vercel.app (Vercel project `simply-case-web`, root `apps/web`, auto-deploys on push to `main`) |
| Supabase | project ref `ltpvagdbprwzqtasurez`, us-east-1 |
| Local path | `/Users/manimann/Documents/personal projects/mycasepro`. **The space in "personal projects" is still there.** |
| Stack | Next.js 16 (App Router) · Expo SDK 57 + expo-router · Supabase (Postgres, Auth, Edge Functions/Deno, pg_cron, pg_net, Vault) · Resend · npm workspaces |
| Accounts | Two real accounts exist (both the owner's — a throwaway/typo second signup). |
| Company site (new, separate) | `jakarallc.com` — domain purchased, repo not started. See §5 "Product shape". |

Repo layout: `apps/web`, `apps/mobile`, `packages/shared` (Zod validators,
generated DB types, design tokens, `classifyStatus()`, the shared legal
content in `legal.ts`), `supabase/migrations` (0001–0019),
`supabase/functions`, `docs/`, `scripts/`.

**Framework warnings in the repo itself:** `apps/web/AGENTS.md` says this
Next.js version has breaking changes, so read
`node_modules/next/dist/docs/` before writing web code.
`apps/mobile/AGENTS.md` says Expo changed, so read
https://docs.expo.dev/versions/v57.0.0/ before writing mobile code, and
install native packages with `npx expo install`.

---

## 3. Current state (verified live 2026-10-06)

### Working
- **USCIS polling.** `check-cases` runs every 15 min against the two
  sandbox test cases, both at a **temporary 14-minute interval**
  (`check_interval_seconds = 840`, built to generate sandbox traffic for
  the production-access application — **revert to 21600 once production
  access is granted**, see memory). Neither test case is circuit-broken
  right now (`consecutive_errors = 0` on both).
- **USCIS 4xx testing — done.** A separate cron function
  (`uscis-probe-4xx`, merged to `main` via PR #21) deliberately sent known-
  bad requests to the sandbox for 5 business days (2026-09-23 through
  09-29), generating 124+ real 4xx responses (404s, 422s). The production-
  access email went out the evening of 2026-09-29. **Awaiting USCIS's
  reply** — check in periodically; they previously took about a week to
  respond the first time.
- **Email notifications** (`send-notifications`, every 5 min, respects
  quiet hours — and quiet hours now actually work correctly, see below).
- **A real timezone bug, found and fixed this session:** `send-notifications`
  evaluates quiet hours against `profiles.timezone`, but nothing had ever
  written that column from the mobile app — every account sat at the
  database default (`'UTC'`), silently. `apps/mobile/lib/timezone.ts` now
  syncs the device's real IANA timezone on every sign-in/app-open
  (best-effort, fails silently — must never block sign-in over this).
- **EOIR (immigration court): the most complete provider.** Fully
  automatic end-to-end — autofill, auto-accept the disclaimer, auto-submit,
  intercept the real JSON response, format a plain-English hearing
  summary, auto-save. Confirmed on a real A-Number with no visible captcha
  challenge in that one test (hCaptcha can clear itself for low-risk
  sessions — documented behavior, not something the app does; treat as
  "worked once," not "always works").
- **CEAC (NVC/visa): autofill works; the submit bug was root-caused and
  fixed, but the fix has never been re-tested on a device.** See §9 for
  the full story — short version: CEAC's submit is an ASP.NET partial
  postback, not a page load, so the app's own `onLoadEnd`-triggered checks
  were never running at the moment the answer appeared. Fixed with a
  `PageRequestManager.add_endRequest` hook. **First thing to verify on a
  real NVC/DS-160 case number.**
- **Real News tab, Resources tab, legal pages, in-app account deletion,
  password auth** — all as before, unchanged this session.
- **Terms/Privacy now render natively in-app** (not a browser sheet) on
  both platforms, from one shared content source — see §4 and §5.
- **A real USCIS app-review compliance pass** on the legal docs — see §5
  "Product shape" and the detailed commit history in §9. Two genuine
  defects were found and fixed (not style opinions): a footer line that
  failed both the minimum font size and WCAG contrast requirements, and
  two paragraphs that scored above the required grade-12 reading level.
- **Active re-consent to policy changes** — a real feature, not just
  updated wording. See §4 "Legal / consent" and §9 for the race-condition
  bug found and fixed the same day it was built.
- **Smart sign-in default** — a brand-new install opens on Create account;
  a device that's signed in before and is now signed out opens on Sign in
  instead. See §4.

### Built but NOT yet verified by the user
- **The entire `feature/sign-in-polish` branch** (pushed, 4 commits, no PR
  yet) — needs a real-device pass before opening the PR. See §6 step 1 for
  the specific checklist.
- **CEAC's postback-hook submit fix** — needs a real NVC/visa case number
  to test (the user was waiting on one as of this writing).
- **DS-160 Application ID format regex** (`^[A-Z]{2}\d{8,12}$`) is
  unverified against the real form.
- **Polling watchdog** (migration 0012, applied long ago). Still **not
  armed** — confirmed live 2026-10-06 that only `cron_secret` is set in
  Vault; `resend_api_key` and `alert_email` are not. Same two SQL lines as
  before, still need the user to run them directly in the SQL Editor (§6).

### Known problems / open items
1. **Business-transfer policy wording was strengthened 2026-10-06** after
   checking it against USCIS's literal checklist line — it previously only
   promised notification, which didn't satisfy "the new company's policies
   will align with yours, or [let users] dispose of/download their data
   first." Now states the new owner must follow the same policy, and users
   can delete their account first if they'd rather not transfer. This was
   a live product decision the user made (originally chose the weaker
   wording when asked, then asked to strengthen it once the literal gap
   was pointed out) — don't re-litigate, but know the history if it comes
   up again.
2. **No verified email domain (Phase E), still blocking.** Resend's test
   sender only delivers to the owner. `enable_confirmations = false`, so
   anyone can register an email they don't own. The user has now purchased
   `jakarallc.com` for this purpose (§5) but hasn't verified it with Resend
   or pointed DNS yet — that's the actual next step, not building anything
   new.
3. **Legal contact email is still a placeholder**
   (`LEGAL_CONTACT_EMAIL` in `packages/shared/src/legal.ts` — now the ONE
   definition both platforms import, down from two separate ones).
   **Blocker before any beta tester signs up**, and it's where someone
   would email to request account deletion, which the Privacy Policy now
   explicitly promises a 30-day turnaround on.
4. **Visa Bulletin / processing times: decided, not building.** Both link
   out to the official sites rather than being scraped — Cloudflare blocks
   every automated path (confirmed from a residential IP, from headless
   Chrome, from GitHub Actions — it's a JS challenge, not IP reputation, so
   a paid proxy wouldn't help and that earlier plan is retired). Visa
   Bulletin could be owner-ingested monthly later if personalization is
   wanted; processing times has no sanctioned API at all.
5. **`packages/shared/src/database.types.ts`** is now correctly regenerated
   from the live schema as of migration 0019 — no hand-patches outstanding.
   (A real near-miss this session: the first regeneration attempt silently
   captured the Supabase CLI's own "update available" nag into the file via
   shell redirect, corrupting it. Caught immediately by `npm run
   typecheck`, not by eye — always typecheck right after regenerating.)
6. **Dependabot:** 7 open PRs and 2 moderate vulnerabilities on `main`,
   untriaged still. Don't bulk-merge. The grouped `npm-minor-patch` PR is
   probably safe; the `typescript`, `eslint`, and `@types/node` major
   bumps need real testing.
7. **`secure_password_change` is off.** A recovery link gives a full
   session without re-authentication. Turn it on in the same config push
   as Phase E.
8. **Android never tested** (no Android SDK on this machine).
9. **Three unused asset files identified, not deleted** (user wants to
   review and delete manually): `apps/mobile/assets/icon.png` (only used
   by a curved sign-in banner component that was built, then reverted —
   see §9), `iconandwriting.PNG`, `splash-icon.png` (the splash config
   actually uses `splash-logo.png`).
10. **EOIR case-detail view**: `cases/[id].tsx`'s generic detail screen
    still shows EOIR cases with a plain USCIS-style status pill instead of
    the structured hearing fields (judge, next hearing, court address)
    that the refresh screen already has. That screen currently doubles as
    both "refresh" and "detail" — worth a real detail layout.
11. **"Refresh all" queue** — discussed, not built. The safe design is a
    single shared hidden WebView stepping through cases one at a time
    ("Refreshing 2 of 5…"), not several WebViews in parallel. No
    dependency on anything else, good candidate whenever there's spare
    capacity.
12. **No messaging that CEAC/EOIR don't auto-update.** USCIS cases poll in
    the background and email on change; CEAC/EOIR cases only update when
    manually opened. Nothing in the app currently tells the user this —
    flagged as a real risk (someone could add a visa case assuming it
    behaves like USCIS and wait indefinitely for an email that can't come)
    but not yet built.
13. **hCaptcha hostname test, not run.** Before spending anything on a
    captcha-solving subscription for EOIR server-side polling, a ~$1 single
    solve would reveal whether EOIR's server checks the token's issuing
    hostname (which would make third-party-solved tokens worthless
    regardless of volume). Cheap, decisive, not done yet.

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
- `profiles`: `email`, `full_name` (0018), `timezone`, `preferred_language`,
  `quiet_hours_start/end`, and now **`legal_accepted_at`** (0019, see
  "Legal / consent" below). `handle_new_user()` sets `full_name` and
  `legal_accepted_at` from signup metadata/time at account creation.
- `devices` (push, unused), `notifications` (queue; only `channel='email'`
  is enqueued, push is paused).
- `poll_runs`: one row per `check-cases` run. The answer to "is polling
  healthy?".
- `uscis_probe_runs` (0017): one row per deliberate bad request sent by
  `uscis-probe-4xx` — the evidence for the 5-day 4xx streak. Keep until
  USCIS confirms production access, then tear down per the comment block
  at the top of 0017's migration file.
- `news_items` (0013), read-only for authenticated users.
- `ops_alerts` + `check_polling_health()` (0012), the watchdog (not armed).
- CEAC cases use `provider = 'ceac'`, with the type encoded in `case_key`
  as `IV:<NVC case #>` or `NIV:<DS-160 id>`. `record_manual_status()`
  (0015, renamed/widened from `record_ceac_status`) is the only way a
  CEAC or EOIR status changes: checks ownership, hashes the status to
  detect a change, writes the event, enqueues email.

### Legal / consent (built 2026-10-02 through 2026-10-06)
- `packages/shared/src/legal.ts` is the single source of truth for Terms
  and Privacy Policy text — structured content (paragraphs, bullet lists,
  cross-document links), rendered natively on both platforms instead of
  the app opening a website. `LEGAL_LAST_UPDATED` must be bumped every
  time the text changes — it's not decorative, it's the literal trigger
  the reconsent mechanism below compares against. `LEGAL_CHANGELOG` holds
  hand-written, one-line plain-language summaries per change, newest
  first — each entry's `date` is a **literal string**, not a reference to
  `LEGAL_LAST_UPDATED` (a real bug found and fixed: a reference would
  silently rewrite every past entry's date each time the constant moves).
- `profiles.legal_accepted_at` (migration 0019) records when an account
  last actively agreed to the current policy. Existing accounts were
  backfilled from `created_at` (the honest proxy for "whatever version
  existed when they signed up"). `apps/mobile/lib/legal-consent.ts`
  compares it against `LEGAL_LAST_UPDATED`; fails OPEN (never blocks app
  access) on any read error.
- `apps/mobile/app/legal-update.tsx` is a real blocking screen (not a
  dismissible banner), reached via a dedicated `Stack.Protected` branch in
  `app/_layout.tsx` whenever `needsLegalReconsent` is true. Shows the
  latest changelog entry, links to the full documents, requires "I agree"
  before the real app becomes reachable. "Not now" signs the user out
  (doesn't delete anything) — a deliberate choice: declining once
  shouldn't cost someone their account.
- **A real race condition was found and fixed 2026-10-06** — see §9 for
  the full story. Lesson generalizes beyond this feature: Supabase's
  client fires `onAuthStateChange` once automatically on startup with
  event `"INITIAL_SESSION"`, separate from and in addition to an explicit
  `getSession()` call. Any code that reacts to `onAuthStateChange` without
  checking the event name risks silently double-running startup logic
  against whichever of the two writes resolves last.
- Terms' "Changes" section (and the feature above) commits to ACTIVE
  consent for future policy changes — not "continued use = agreement,"
  which is what USCIS's app-review checklist explicitly requires.

### Sign-in / auth (mobile) — rebuilt this session, branch `feature/sign-in-polish`
- `apps/mobile/lib/auth-history.ts`: an `AsyncStorage` boolean
  (`ever_authenticated`) that deliberately **survives sign-out**, unlike
  the session itself — lets the sign-in screen tell a brand-new install
  apart from a returning, now-signed-out device, and default to Create
  account vs. Sign in accordingly.
- `apps/mobile/lib/auth-context.tsx` (`AuthProvider`) now exposes
  `hasSignedInBefore`, `needsLegalReconsent`, and `acceptLegalUpdate()`
  alongside the original `session`/`isLoading`/`signOut`. Both new booleans
  are resolved as part of the same startup bootstrap `isLoading` already
  gates, so the real app is never shown — even briefly — before either is
  known.
- `apps/mobile/components/ui/Input.tsx` gained a drop shadow — app-wide,
  since `Input` is the one shared component (deliberately NOT the existing
  `cardShadow` token, which is 4% opacity and too faint to see on a white
  field; this is its own, slightly stronger value).
- `apps/mobile/components/ui/Button.tsx` gained an optional `pill` prop
  (fully rounded), off by default — every other button keeps its current
  shape.
- A curved navy banner header was designed, built, iterated on heavily
  (SVG waves, a tinted-white logo that silently failed via `Image`
  `tintColor` on-device, then a generated white PNG that *also* silently
  failed, then switched to plain styled `Text` which finally worked —
  see §9), and then **explicitly reverted** at the user's request back to
  the plain logo image. The code for it no longer exists; `icon.png` is an
  orphaned asset because of this (see §3 #9).
- The consent checkbox at signup ("I agree to the Terms of Service and
  Privacy Policy") is now **actually recorded**, not just a client-side
  gate — see "Legal / consent" above; closes a real gap that predated this
  session (the checkbox existed, but ticking it never wrote anything to
  the database).

### Background jobs (pg_cron → pg_net → Edge Function)

| Cron job | Schedule | Target |
|---|---|---|
| `check-cases-uscis` | `*/15 * * * *` | `check-cases` |
| `send-notifications-email` | `*/5 * * * *` | `send-notifications` |
| `fetch-news` | `0 */3 * * *` | `fetch-news` |
| `polling-watchdog` | `*/30 * * * *` | SQL `check_polling_health()` |
| `uscis-probe-4xx` | `0 11-23 * * 1-5` (UTC; sandbox's 7 AM–8 PM ET open hours) | `uscis-probe-4xx` |

Rules that are easy to break:
- Every cron `net.http_post` **must** pass `timeout_milliseconds := 60000`.
  The 5-second default caused an outage.
- Cron-called functions authenticate with an `x-cron-secret` header, read
  from Vault (`cron_secret`) at call time. Deploy with
  **`--no-verify-jwt --use-api`**, or every cron call gets a 401.
- **`delete-account` is the exception:** called by a signed-in user, so
  deployed WITH JWT verification.
- Functions build their database client from **`SERVICE_SECRET_KEY`**, not
  the auto-injected legacy `SUPABASE_SERVICE_ROLE_KEY`. No silent fallback,
  on purpose.
- `check-cases` wraps every post-USCIS-call database write in
  `withRetry()`. A case with `consecutive_errors >= 10` is dropped by
  `claim_due_cases` and never polled again until reset; 503/429 don't
  count as errors.
- `uscis-probe-4xx` is deliberately hard-pinned to the sandbox base URL —
  never reads `USCIS_ENVIRONMENT` — so a future flip to production for
  real polling can't turn it into deliberately-bad traffic against the
  real API.

### Deployed Edge Functions
`check-cases` (no-jwt) · `send-notifications` (no-jwt) · `fetch-news`
(no-jwt) · `delete-account` (JWT verified) · `uscis-probe-4xx` (no-jwt, new
this session). Shared code lives in `supabase/functions/_shared/`
(`uscis.ts`, `news.ts`, `uscis-probe.ts`, all with offline fixture-based
tests).

### Status classification (`packages/shared/src/status.ts`)
`classifyStatus()` maps provider text to
`pending | inProgress | actionNeeded | approved | denied | unknown`.
**Order matters** (most specific first), and **uncertain text must fall to
`unknown`, never a guess.** CEAC's and EOIR's short vocabularies are
matched **exactly** before any substring pattern runs.

### Mobile specifics
- Tabs: Cases (nested stack: list → `[id]` → `ceac-refresh/[id]` /
  `eoir-refresh/[id]`) · News · Resources · Profile.
- Deep links: listen at app start via `apps/mobile/lib/deep-link.ts`.
- CEAC WebView submit is a partial postback, not a navigation — see §9.
- EOIR's page is a React app (Gatsby); autofill POLLS for elements rather
  than assuming they exist at `onLoadEnd`.
- Scheme/bundle ID stay `mycasepro://` / `pro.mycase.app` (Supabase
  redirect allowlist).

---

## 5. Product decisions already made (don't re-litigate)

### Product shape, decided 2026-10-02
- **Mobile is the real product.** New features land there first and may
  stay mobile-only (EOIR/CEAC's WebView autofill flows already are) —
  building every feature twice is not the plan.
- **The existing web app stays frozen as a lightweight companion** — login,
  case list, case detail, account deletion, legal pages. Not being
  actively grown, but not being removed either (costs nothing to leave
  running, and a web path for account deletion may matter for app-store-
  adjacent requirements).
- **`jakarallc.com`** (domain purchased) will be a **new, separate repo** —
  NOT inside `simply-case/simply-case` — describing Jakara LLC broadly.
  **`jakarallc.com/simplycase`** is a marketing/landing page for the app
  specifically (who it's for, what it is, App Store/Play Store links) —
  just a route in that new repo, not a third repo. It should **link out**
  to the real Terms/Privacy (`simply-case-web.vercel.app/legal/*`) rather
  than duplicate the text. Neither repo exists yet; the user may build it
  themselves or ask for help scaffolding it.

### CEAC/NVC — user-assisted refresh with in-app autofill
The CAPTCHA-solving service considered early on is **not needed and not
being built**: the user solves the CAPTCHA in the app, so nothing is
bypassed and there's no per-lookup cost.
- **Sensitive data stays on the phone.** Passport number, surname, and
  consulate location go in iOS secure storage (Keychain via
  `expo-secure-store`), **never** in Supabase, logs, or backups. Privacy
  Policy covers this explicitly ("What stays only on your phone").
- **Consequence, accepted:** no background polling, no email alerts for
  CEAC cases — a human must solve a CAPTCHA every lookup. Mitigation is a
  weekly "tap to check" reminder push (needs the Apple Developer account).
- **Fragility safety net, both built:** (1) autofill only ever writes into
  a field, never submits, skips a field that's already non-empty. (2)
  status is never saved without the user confirming what's on screen.
  (3) `report_lookup_breakage` (0016) emails the owner on a markup change,
  with careful logic to never fire on a merely-offline/Cloudflare-blocked
  page (that would alert on every bad connection, training the owner to
  ignore it) — only when something expected loaded and something specific
  moved. (4) `packages/shared/src/eoir.test.ts` pins parsing against a
  real captured response.
- **If email alerts for CEAC are ever wanted**, they require automated
  CAPTCHA solving AND form data available without the user — either
  server-side (reverses the privacy decision above) or on-device
  background refresh (iOS background execution is infrequent/unreliable).
  Not planned; revisit only if users ask.
- There's still no CEAC API at any price, confirmed properly (not
  assumed) via a real device diagnostic — see §9.

### EOIR (immigration court) — built, confirmed working
Mirrors the CEAC pattern (autofill + visible WebView + real user tap +
manual recording initially), but **has a real JSON API**
(`eoir-ws.eoir.justice.gov/api/Case/GetCaseInfo`), discovered in their own
Gatsby bundle. Unlike CEAC, there's no trusted-click problem (no button to
fake-click — it's an HTTP request with a header), so full background
lookup is realistic in a way it isn't for CEAC.
- **Intercept approach, confirmed working on device**: keep their page in
  the WebView, user solves the captcha and submits as normal, hook
  `window.fetch` to capture the JSON response their own page already
  received. Nothing about their site's usage changes, no captcha service
  needed.
- **Screen rewritten to hide the automation by default**: WebView mounted
  off-screen, a plain spinner shown instead, a 25-second timeout brings it
  on-screen if the automatic flow stalls. A successful capture auto-saves
  (deliberate departure from "never auto-save a guessed status" — this is
  a confirmed structured field from the government's own API, not a
  scraped guess).
- **Nationality matching is EXACT-only** — a "contains" match once picked
  British Indian Ocean Territory when the user chose India. No match means
  "nothing selected," never a guess.
- **Calling the API directly (no WebView) is blocked** on the same
  paid-captcha-service/ToS question as CEAC, confirmed by direct curl: the
  captcha IS enforced server-side, not just UI. The hCaptcha-hostname
  question (§3 #13) is the open piece of due diligence before deciding
  whether to pursue this.
- A-Numbers are sensitive government IDs — covered explicitly in the
  Privacy Policy.

### Visa Bulletin / processing times — decided, not building
See §3 #4. The old "~$50/mo residential proxy" plan is retired — the
block is a Cloudflare JS challenge, not IP reputation, confirmed from a
residential IP and headless Chrome both failing identically.

### Data retention
Keep user data until the user deletes their account. Now stated explicitly
in the Privacy Policy, including that inactive/dormant accounts are never
auto-deleted (a real USCIS checklist requirement, previously unstated even
though it was already the true behavior).

### USCIS app-review legal compliance — decided/built 2026-10-02 through 10-06
The user obtained USCIS's actual app-review requirements for apps using
their API (readability, data retention, privacy/data practices — full text
in the gitignored `docs/uscis-privacy-requirements.md`) and asked for a
line-by-line audit, not a guess. What came out of it:
- Two real defects fixed (not style opinions) — see §3 and §9.
- New Privacy Policy sections: data breach notification, California/CCPA
  rights, business-transfer/ownership-change clause (strengthened once —
  see §3 #1), third-party-binding and no-de-identified-sharing statements,
  explicit dormant-account retention, a stated 30-day timeframe for
  email-based deletion requests.
- The real active-consent feature (§4), not just updated wording — a
  promise with nothing behind it wouldn't survive a real review.
- One honest methodology note worth keeping: Flesch-Kincaid grade-level
  scoring is unreliable on short fragments and technical compound words
  (a single 8-word list item can spike to "grade 15"). Real multi-sentence
  paragraphs were the valid signal; short list items were not treated as
  failures even when the formula suggested one.

### Other standing decisions, unchanged
- **Civics quiz: out, by decision.**
- **Range search (not built):** official USCIS API only, async job queue,
  a global rate limiter in Postgres (10 TPS account ceiling, shared with
  polling), ~5 scans per user per day. Needs USCIS production access.
- **Push notifications (not built):** needs the Apple Developer account
  ($99). Lock-screen text must not reveal status.
- **Monetization:** free, no limits, for now.
- **Naming:** "Simply Case" in all user-visible text. Internal IDs stay
  `mycasepro`.

---

## 6. What's next (suggested order)

1. **Test `feature/sign-in-polish` on a real device**, then open its PR
   and merge. Checklist: the legal-update "I agree" screen appears once on
   first open (should now actually work — see §9 for the bug that
   previously silently skipped it) and doesn't reappear after agreeing;
   Name field + consent checkbox on signup; Terms/Privacy open as a native
   sheet; headline is smaller/centered/plain-font; input shadow visible;
   sign out → relaunch → lands on Sign in, not Create account.
2. **Re-test CEAC's postback-hook fix** on a real NVC/visa case number —
   the single highest-value unverified thing in the whole project, pending
   since 2026-09-22.
3. **Check for a reply from USCIS** on production access (email sent
   2026-09-29).
4. **Arm the polling watchdog** — two `vault.create_secret(...)` calls,
   **run by the user directly in the Supabase SQL Editor** so the key
   never passes through chat:
   ```sql
   select vault.create_secret('<Resend API key>', 'resend_api_key');
   select vault.create_secret('<owner email>', 'alert_email');
   ```
5. **Verify `jakarallc.com` with Resend, point DNS.** Unlocks Phase E:
   real email confirmations, `secure_password_change`, a real contact
   email everywhere, Vercel preview URLs in the redirect allowlist — one
   `config diff` → `config push`, flagged before running.
6. **Scaffold the `jakara-site` repo** (company homepage + `/simplycase`
   marketing page) — the user may do this themselves, or ask for help.
7. **"Refresh all" queue, EOIR case-detail view, CEAC/EOIR "doesn't
   auto-update" messaging** — no external blockers on any of these.
8. **hCaptcha hostname test** (~$1, one real solve) before committing to
   anything for EOIR server-side polling.
9. **Tap-to-check reminder push** — blocked on the $99 Apple Developer
   account.
10. **Dependabot triage.**
11. **Delete the three flagged unused assets** (§3 #9) — user's call, not
    done automatically.
12. **Once USCIS grants production access:** revert the 14-minute polling
    interval back to 6 hours (`update tracked_cases set
    check_interval_seconds = 21600 where provider = 'uscis';`), and tear
    down the `uscis-probe-4xx` function/table per the comment block at the
    top of migration 0017.

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
`RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`.

**Vault (confirmed live 2026-10-06):** `cron_secret` only. `resend_api_key`
and `alert_email` are **still not set** — the watchdog is still not armed.

**Email:** Resend test sender `onboarding@resend.dev` delivers only to the
owner. Supabase Auth SMTP also uses Resend.

**Redirect allowlist:** `http://localhost:3000/**`,
`https://simply-case-web.vercel.app/**`, `mycasepro://**`, `exp://**`
(Vercel previews not included).

**USCIS sandbox client:** Client ID `JShv56neAMlpOzEUmBtc8mGzKif6AoFf`
("Case Status API - Sandbox"). USCIS's message about "either of your API
keys" was never fully resolved — only one key pair has been used; if a
second key needs testing too, `uscis-probe-4xx` already supports a second
credential pair via `USCIS_CLIENT_ID_2`/`USCIS_CLIENT_SECRET_2` env vars,
no code change needed.

## 8. Commands

```bash
npm run typecheck                 # all workspaces — ALWAYS run after regenerating database.types.ts
npm test                          # node --test on supabase/functions/_shared + packages/shared
npm run dev                       # web
cd apps/mobile && npx expo start --go --tunnel -c   # phone testing; -c clears Metro's cache
bash scripts/check-env.sh         # validates apps/web/.env.local without printing values
npx supabase@2.117.0 db push --dry-run   # ALWAYS before a real push (flag to user first)
npx supabase@2.117.0 gen types typescript --linked > packages/shared/src/database.types.ts
npx supabase functions deploy <name> --no-verify-jwt --use-api   # cron functions
npx supabase@2.117.0 db query --linked "select ..."   # read-only checks
```
**Pin the Supabase CLI version** (`@2.117.0` as of this writing) rather
than bare `npx supabase` — the cached version drifts between sessions and
an uncached version triggers an interactive install prompt that fails
non-interactively.

**A real near-miss, worth repeating:** redirecting `gen types` output with
`>` can capture the CLI's own stdout "update available" nag into the
generated file, corrupting it with trailing plain-text lines after valid
TypeScript. It won't look wrong at a glance — **always run `npm run
typecheck` immediately after regenerating**, don't just trust the command
succeeded.

**Killing a stuck dev server port:**
```bash
lsof -ti:8081 | xargs kill -9
```

**Polling health check:**
```sql
select to_char(started_at at time zone 'America/Los_Angeles','MM-DD HH24:MI') t,
       claimed, updated, errored, crash_message
from poll_runs order by started_at desc limit 12;
-- real HTTP results of cron calls (kept ~6h):
select created, status_code, left(content,150) from net._http_response order by created desc limit 10;
```

**USCIS 4xx streak check:**
```sql
select to_char(created_at at time zone 'America/New_York','MM-DD Dy') et_day,
       count(*) reqs, count(*) filter (where is_four_xx) four_xx
from uscis_probe_runs group by 1, (created_at at time zone 'America/New_York')::date
order by 2;
```

USCIS sandbox test receipts: `EAC9999103403`, `LIN9999106498`,
`EAC9999103400`.

---

## 9. History that explains the current code

**Polling outage, 2026-09-12 → 09-14.** Three causes: pg_net's 5s default
timeout (fixed with 0011's 60s), a stale `USCIS_CLIENT_ID` after a key
rotation (401s), and an intermittent "Gateway Timeout" on database calls
from inside functions — likely a pooled connection going stale during the
wait on USCIS, unproven, mitigated with `withRetry()` + switching to
`SERVICE_SECRET_KEY`.

**CEAC "Performing security verification" fix, 2026-09-16.** Two causes:
a Windows Chrome user agent set on the WebView made bot detection worse
(iOS WKWebView is Safari's engine — claiming Windows Chrome while every
other signal says iPhone is exactly the contradiction bot detection looks
for; removed). The actual bug: Cloudflare's challenge renders in an
`about:srcdoc` iframe, which failed react-native-webview's default
`originWhitelist` and got silently cancelled — visible only as "Can't open
url: about:srcdoc" in Metro logs. Fixed with
`originWhitelist={["http://*","https://*","about:*"]}`. **The Metro
warning was the whole diagnosis** — check Metro logs before blaming the
remote site.

**CEAC autofill + in-app CAPTCHA, 2026-09-16.** Built against real
inspect-element HTML from the live page. Real selectors on
`ceac.state.gov/CEACStatTracker/Status.aspx`: `#Visa_Application_Type`,
`#Visa_Case_Number`, `#Passport_Number`, `#Surname`, `#Location_Dropdown`,
CAPTCHA image `img.LBD_CaptchaImage`, answer `#Captcha`. The Submit control
is NOT `#ctl00_ContentPlaceHolder1_imgFolder` (a decorative `<img>`) — it's
the wrapping `<a id="ctl00_ContentPlaceHolder1_btnSubmit">`, discovered via
an on-device DOM diagnostic after three different programmatic-submit
approaches (`.click()`, `__doPostBack` with a guessed name, the exact real
`WebForm_DoPostBackWithOptions` call copied verbatim) all failed
identically — no error, no reload, nothing. That pattern, combined with a
real physical tap working every time, points at Cloudflare's bot
management silently discarding script-triggered submissions on this
control. **Conclusion: stop trying to submit programmatically** — the CEAC
page is shown visibly by default, autofill + an error-relay
(`#ctl00_ContentPlaceHolder1_lblError`, verbatim) run automatically, the
user reads the CAPTCHA and taps Submit for real.

**CEAC blank-screen root cause, found 2026-09-22** (reported by the user
across many sessions, never diagnosed until a runtime fetch/XHR diagnostic
ran on a real device). **Submitting CEAC is not a page load** — it's an
ASP.NET UpdatePanel **partial postback over XHR**
(`POST .../Status.aspx`, `__EVENTTARGET=...btnSubmit`, HTTP 200 with
~16KB in MS-AJAX's delimited envelope format). **The bug was ours:**
`ERROR_CHECK_SCRIPT`/`EXTRACTION_SCRIPT` only injected from `onLoadEnd`,
which **never fires for a partial postback** — the app stopped watching
the page at the exact moment CEAC put the answer on it. Nothing was ever
blank; the app just wasn't looking. Fixed with
`PARTIAL_POSTBACK_HOOK_SCRIPT`, which registers with ASP.NET AJAX's own
`Sys.WebForms.PageRequestManager.add_endRequest` to re-run the same checks
after every partial postback. **Confirmed CEAC has no JSON API** (checked
properly this time, not assumed) — the response is interceptable via XHR
though, a viable fallback if DOM reading ever proves unreliable. **This
fix has never been re-tested on a device as of 2026-10-06** — top
priority, §6 step 2.

**EOIR built 2026-09-17, confirmed working 2026-09-21.** See §5 for the
product decisions; key technical notes: ACIS is a Gatsby/React app, so
autofill POLLS for elements (250ms × 40) rather than assuming they exist
at `onLoadEnd`, and each autofill step runs concurrently rather than
chained (chaining stalled the whole flow whenever one step wasn't ready —
copying CEAC's single-shot approach here was a mistake, don't reintroduce
it). The real JSON API was found by grepping their own Gatsby bundle for
`eoir-ws`; confirmed by direct curl that the captcha is enforced
server-side, not just client UI.

**USCIS 4xx probe, built and run 2026-09-22 through 09-29.** After
confirming an earlier 5-day sandbox streak, USCIS replied that they saw no
4xx responses on the key — because normal polling only ever asks about two
valid, existing receipts. A separate cron function
(`uscis-probe-4xx`) sends two deliberately-bad receipts (a well-formed but
nonexistent one → 404; a malformed one, sent raw, bypassing the normal
client's own pre-flight validation → 422) with a genuinely valid access
token, hourly during the sandbox's published open hours (discovered: the
sandbox returns 503 to literally everything — valid or not — outside
7 AM–8 PM ET weekdays). Deliberately does NOT generate a 401 via a bad
token: that's indistinguishable from an attack on the gateway and isn't
reliably attributed to the right key. Hard-pinned to the sandbox base URL,
never reads `USCIS_ENVIRONMENT`, so a future flip to production polling
can't turn this into live bad traffic. Production-access email sent
2026-09-29 evening, after 5 real business days and 124+ 4xx responses.

**Sign-in/signup rebuild and the curved-banner saga, 2026-09-29 through
10-03.** A long iterative UI pass: placeholders removed, duplicate nav
header hidden, footer collapsed to one line, a social sign-in preview
added (Apple/Google/Facebook — layout only, real blockers are the Apple
Developer account and Supabase Auth provider config), Google's real
four-color mark drawn via `react-native-svg` (a font glyph can only be one
color), a consent checkbox that actually gates signup. A curved navy
banner header went through several complete redesigns at the user's
direction — wave depth, icon size/position relative to the curve, a second
lighter highlight curve — and the wordmark rendering failed TWICE in ways
worth remembering: first, `Image` `tintColor` silently did nothing (the
navy wordmark rendered in its own original navy on the navy banner —
invisible, not untinted); second, a genuinely white PNG generated via
`sharp` from the real logo's alpha channel *also* didn't render on-device
despite checking out fine composited locally (root cause never fully
pinned down — possibly a Metro asset-registry cache issue from the file
being added after an earlier server start). The banner was rebuilt a third
time using plain styled `Text` instead of any image, which finally worked
reliably. **The user then asked to revert the entire banner** back to the
plain logo image — done via `git checkout --` since none of the banner
work was committed yet, a clean revert with no side effects. The banner
component and its real-asset dependency (`icon.png`) no longer exist in
the app, but the asset file itself is still on disk (§3 #9).

**USCIS app-review legal/privacy compliance pass, 2026-10-02 through
10-06.** The user obtained USCIS's actual app-review checklist (desktop/
mobile readability, data retention, privacy/data practices — kept
gitignored, not redistributed) and asked for a genuine line-by-line audit.
Found and fixed two real defects: a "Last updated" footer line that failed
both the minimum font size (13px vs. required 14px) and WCAG contrast
(2.8:1 vs. required 4.5:1) — not a judgment call — and, on a later
re-check against the exact pasted text, two paragraphs that scored above
the required grade-12 reading level via Flesch-Kincaid (12.3 and 12.8;
split and simplified to 10.5 and 6.0). Built the real active-consent
mechanism described in §4 rather than only updating wording, since a
policy promise with no mechanism behind it wouldn't survive a real review.

**The legal-reconsent race, found and fixed 2026-10-06.** The new
"we've updated our policies" screen silently failed to appear on a real
device despite the account's `legal_accepted_at` genuinely predating the
policy change. Root cause: Supabase's client fires `onAuthStateChange`
once automatically on startup with event `"INITIAL_SESSION"` — separate
from, and in addition to, the app's own explicit `getSession()` call in
the startup bootstrap. The subscription handler ignored which event
fired, so **both** the bootstrap (fully awaited, gates `isLoading`) and
that automatic startup event (fire-and-forget) independently computed
`needsLegalReconsent` for the same user at nearly the same moment, with no
ordering guarantee between the two writes — whichever finished last won.
`checkNeedsLegalReconsent` fails open by design (never lock someone out
over a failed check), so if the unawaited call lost the race and hit any
hiccup, it silently overwrote a correct `true` with `false`. No error
anywhere — exactly what was observed. Fixed by having the subscription
ignore `INITIAL_SESSION` entirely and only react to genuinely later events
(a real sign-in, a token refresh) where the bootstrap isn't running
concurrently.

**Phase F build (2026-09-13)** shipped as PR #18: Resources tab, news,
legal and deletion, CEAC, watchdog, probe workflow. A review before
testing caught 4 bugs, all fixed before merge.

## 10. Lessons learned (don't re-learn these)

- `supabase config push` applies every declared property. Always
  `config diff` first.
- pg_net times out after 5 s by default. Pass `timeout_milliseconds`.
  `cron.job_run_details` "succeeded" only means the request was queued;
  read `net._http_response` for real results.
- A rotated secret isn't rotated until every copy matches (check digests).
- Check existing CHECK constraints before inserting a new enum-like value.
- Substring regexes on status text collide across providers. Exact-match
  short vocabularies first.
- ASP.NET WebForms pages post back to the same URL. A SUBMIT that triggers
  a partial postback (UpdatePanel) doesn't fire `onLoadEnd` at all —
  neither detection strategy alone is safe; this cost weeks to diagnose
  once already (CEAC), don't assume a new WebForms integration is simpler.
- Test destructive functions against data that can't collide with real
  rows.
- Don't attribute a failure to a platform incident, a "flaky device," or
  "just try again" unless the symptoms actually match. Build a diagnostic
  and read the real code path — both this session's legal-reconsent race
  and the original CEAC blank-screen bug were found this way, not by
  re-running the same test harder.
- macOS `/bin/bash` is 3.2 (no `declare -A`). zsh has no `${!var}`, so use
  `bash -c` for those.
- Node's built-in TS stripping (used by `npm test`) rejects constructor
  parameter properties.
- After switching git branches, a stale `apps/web/.next` can reference
  missing routes and fail typecheck. Delete `.next` (gitignored).
- Expo Router route types can go stale: kill Metro, delete
  `.expo/types/router.d.ts`, restart.
- A `Tabs` layout has no implicit `/` route (needs a hidden redirect).
- PostgREST can only embed across a real foreign key.
- Next.js pins its own React version; two React copies in the monorepo is
  expected.
- CLI exit code 0 ≠ success. Update packages before building, never after.
- Logo PNGs can carry hidden transparent padding; measure with
  `sharp().trim()`.
- macOS filesystem is case-insensitive (`icon.PNG` overwrote `icon.png`).
- Compare branches against `origin/main` after `git fetch --prune`.
- Expo Go can't test offline behaviour (it loads JS from the dev server).
- `uscis.gov/rss.xml` is not a newsroom feed; parse `/newsroom/all-news`.
- Don't stack new branches on an unmerged base without saying so.
- **A background shell command plus your own trailing `&` double-
  backgrounds it** — the wrapper returns immediately while the real
  process detaches orphaned, with no visible output. Let the tool's own
  backgrounding handle it; don't add a second `&`.
- **`git add -A` can sweep up stray unrelated files.** A root-level
  `tsconfig.json` nobody asked for kept getting caught by broad adds this
  session — always check `git status` after a broad `add`, before
  committing.
- **Redirecting a CLI's output with `>` can capture its own stderr/stdout
  nag messages** ("a new version is available...") into the file,
  corrupting generated code with trailing plain text that looks like
  nothing happened. Typecheck immediately after, don't just trust the
  exit code.
- **`supabase.auth.onAuthStateChange` fires once automatically on startup**
  with event `"INITIAL_SESSION"`, separate from an explicit `getSession()`
  call. Code reacting to every event without checking which one risks
  double-running startup logic in an unordered race against itself.
- **Flesch-Kincaid grade-level scoring is unreliable on short
  fragments/list items** (a single ~8-word sentence with a technical
  compound word can spike to "grade 15"). Trust it on real multi-sentence
  paragraphs, not isolated short strings.
- **A device test that "didn't work" may just be a stale bundle or a
  backgrounded-not-relaunched app**, not a code bug — ask how it was
  tested before concluding the code is wrong.
