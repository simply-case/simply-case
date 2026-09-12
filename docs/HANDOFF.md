# mycase pro / Simply Case — handoff

Paste this into a new chat to continue. Rewritten 2026-09-12 — the
previous version (still visible in git history) was from 2026-09-11 and
had drifted badly: it still listed password-reset as unbuilt, described
both apps as "deliberately plain/unstyled," and predates the app being
renamed. Cross-reference `docs/ROADMAP.md` (the phased plan + progress
log this rewrite is based on) and, if it still exists, `handoff.md` at
the repo root (a denser, single-session technical snapshot from the
mobile-rebrand work — this file is the evergreen one, that one is not).

## ⚠️ How the user wants you to work — standing instructions

- **Ask before `git commit`, `git push`, or writing a summary/handoff
  doc.** Say what you intend to do, wait for a yes. This applies to
  commits too, not just pushes — corrected 2026-09-12 after an earlier
  session committed without asking.
- **After every commit, explain what went in and why, in plain
  language.** A few lines, not a changelog.
- **Feature branch per feature → PR → `main`.** Never commit directly to
  `main`.
- **Flag any `supabase db push` or `config push` BEFORE running it.** One
  shared Supabase project across all branches — a migration or config
  push from any branch hits production immediately.
- **Never print secret values.** `grep -c "^KEY=" file` for presence
  checks; never `cat`/Read a file containing secrets.
- **Verify against the live project, not exit codes or assumptions.**
  Several real bugs this project has hit were CLI/tool successes that
  were actually failures — see "lessons learned" at the bottom.
- **Model split:** Opus for plans/ideas/questions, Sonnet 5 for coding.
  Flag the switch when moving between the two.

## What this is

Immigration case tracker (USCIS / EOIR / CEAC receipt numbers) with status
history and email/push notifications on change. Web (Next.js) + mobile
(Expo/React Native), one shared Supabase backend. As of 2026-09-12 the
product scope widened to match the incumbent app (Visa Bulletin, processing
times, NVC tracking, news, range search) — see "New scope" below.

- **GitHub:** github.com/simply-case/simply-case (public)
- **Live web app:** https://simply-case-web.vercel.app
- **Supabase project:** ref `ltpvagdbprwzqtasurez`, us-east-1
- **Vercel project:** `simply-case-web`, root dir `apps/web`
- **Local path:** `/Users/manimann/Documents/personal projects/mycasepro`
  — note the **space in "personal projects"**; this breaks native iOS
  builds (see blockers below), it is not just a cosmetic detail.
- **Architecture & product decisions:** `docs/PLAN.md` — the schema
  design, de-duplication rationale, confirmed product decisions.
- **Phased plan + progress log:** `docs/ROADMAP.md` — read this for the
  *current* sequencing and a log of what was deployed when.

### ⚠️ Naming is currently split — needs a decision

The **mobile app** was rebranded to **"Simply Case"** (real logo, app
icon, splash screen — see below), but that work is on an unmerged branch
(`feature/mobile-branding`). The **web app** still says **"mycase pro"**
in three places (`apps/web/src/app/layout.tsx` title,
`apps/web/src/app/page.tsx` and `login/page.tsx` headings). Pick one name
and apply it everywhere — right now a user bouncing between web and
mobile would see two different product names.

## Stack

Next.js (App Router) + TypeScript · Supabase (Postgres/Auth/Edge
Functions) · Expo/React Native (SDK 57, expo-router) · Resend (email) ·
Vercel · npm workspaces monorepo.

## What's built and verified working

### Backend
1. **Monorepo** — `apps/web`, `apps/mobile`, `packages/shared` (Zod
   validators + generated Supabase types + design tokens + the status
   classifier, shared by both apps).
2. **Database + RLS** — 10 migrations. `tracked_cases` is one shared row
   per real-world case (provider + case_key); `user_cases` is the
   per-user subscription, so N users tracking the same receipt number
   costs one poll, not N. `tracked_cases`/`case_status_events` have no
   direct select policy — read only via `my_case_details`/`my_case_events`
   views scoped to the caller. Verified live: anon reads return empty
   even on direct-ID lookups, cross-user writes rejected with 403.
3. **USCIS adapter** (`supabase/functions/_shared/uscis.ts`) — tested
   against the live sandbox, not just docs: nested error envelope with
   string codes, OAuth creds in the POST body not Basic auth, two
   response schemas (IOE-prefix receipts omit submittedDate/
   modifiedDate), 503/429 must NOT count against `consecutive_errors`
   (sandbox is closed nights/weekends by design).
4. **Polling pipeline** — `check-cases` Edge Function, every 15 min via
   `pg_cron` + `pg_net`. Auth is a shared secret (`CRON_SECRET`) in
   Supabase Vault, read at call time, never a literal in a migration.
   **Deployed with `--no-verify-jwt --use-api`** — that flag is
   mandatory, the cron authenticates via header, not a JWT.
5. **`poll_runs` observability table** (new) — one row per `check-cases`
   invocation: claimed/updated/changed/errored counts, crash detection.
   Previously "is polling healthy?" required cross-referencing
   `cron.job_run_details` with `tracked_cases.last_checked_at`; this
   answers it directly. Verified live: a real cron tick wrote a real row.
   See `scripts/check-poll-health.sql` for the query set.
6. **Push notification queue no longer silently fills.** `check-cases`
   used to enqueue `channel='push'` rows that `send-notifications` never
   drained (it only ever read `channel='email'`). Now it doesn't enqueue
   push at all until a real consumer exists. (Turned out there was no
   actual backlog when checked live — the three tracked cases had never
   changed status — but the leak is closed either way.)
7. **Email notifications** — `send-notifications` Edge Function, every 5
   min, same cron+Vault pattern. Drains the `notifications` queue on a
   status change, respects per-user quiet hours.

### Web app
8. **Auth** — password-only (magic link removed at user request).
   **Forgot/reset password is built and merged** — verified end to end:
   recovery link → session → reset page → password changed → old
   password rejected. `/auth/confirm` handles Supabase's actual PKCE
   `code` redirect.
9. **UI redesign, merged.** Design tokens (`packages/shared/src/theme.ts`)
   in a "crisp & official" direction — cooler neutrals, sharper radii,
   navy accent. Shared primitives (Button/Input/Card/StatusPill/
   EmptyState/Skeleton). `classifyStatus()` maps ~40 USCIS status strings
   into a fixed small vocabulary (pending/inProgress/actionNeeded/
   approved/denied/unknown) so every screen renders against one
   consistent thing instead of raw provider text — this went through two
   rounds of real bug fixes (a status meaning "already responded" was
   initially misclassified as "action needed," the worst possible
   direction for an anxious user). Loading skeletons and empty states
   throughout, dark mode support, focus-visible a11y states.
10. **Deployed to Vercel** — auto-deploys on push to `main`. Only 3 env
    vars needed (all `NEXT_PUBLIC_`, none secret) — the web app never
    reads the Supabase secret key by design.

### Mobile app
11. **4-tab navigation** (on `feature/mobile-branding`, unmerged): Cases
    (own nested stack, list → detail) · News (explicitly placeholder
    sample content, no real source picked yet) · More (open slot,
    "coming soon") · Profile (email, a real quiet-hours editor wired to
    the `profiles` table, sign out).
12. **Sign-up shown first**, not sign-in — a new user's actual first
    screen is "Create account." Apple/Google sign-in noted as planned in
    a code comment, deliberately not stubbed as dead buttons.
13. **Real branding** (same branch): app renamed "Simply Case," real app
    icon and splash screen generated from the user's supplied logo files,
    a shared `AppHeader` component (wordmark, top-left) on all 4 tab
    roots. Bundle ID/scheme (`pro.mycase.app` / `mycasepro://`) left
    unchanged — those are in the Supabase redirect allowlist.
14. **Same UI redesign as web** — same tokens, same status classifier,
    matching primitives (RN StyleSheet versions).
15. **Forgot/reset password**, same as web, native deep-link flow via
    `app/auth/confirm.tsx` (parses tokens from the URL fragment, calls
    `setSession()` directly — genuinely different mechanism from web's
    server-side PKCE exchange, not two implementations of the same
    thing).

## 🚧 Real blockers right now

### 1. No verified Resend domain — still the email blocker

**Symptom:** Resend's test sender (`onboarding@resend.dev`) only delivers
to the account owner (mannmankirat@gmail.com). Confirmed directly against
the Resend API:
> "You can only send testing emails to your own email address... verify a
> domain at resend.com/domains."

Not a code/Supabase/Vercel bug — confirmed by testing, not assumed.

**Current state (still true as of this rewrite):**
`auth.email.enable_confirmations = false` in `supabase/config.toml` — so
signup/login send no email and work for any address. `secure_password_change
= false` too.

**Why this matters more than "email doesn't work":** with confirmations
off, anyone can register an email they don't control, and this app emails
immigration case status to that address. **This is a real-user blocker,
not just a launch-polish item** — it goes live the moment a second person
signs up, not at some later "launch" milestone. By agreement, buying the
domain is deliberately deferred until someone besides the account owner
needs a login (Resend's owner-only restriction means every email path is
still fully testable solo). If that need arrives, this jumps the queue.

**Fix when ready:** buy a domain (~$12/yr) → verify at resend.com/domains
→ change sender in BOTH: Supabase dashboard → Auth → SMTP Settings, AND
`NOTIFICATION_FROM_EMAIL` in `.env.local` + `supabase secrets set`. Then
re-enable `enable_confirmations` and turn on `secure_password_change` in
the same `config diff` → `config push` (flag first, per the standing rule).

### 2. Space in the local folder path breaks native iOS builds

`/Users/manimann/Documents/personal projects/mycasepro` — the space in
"personal projects" makes CocoaPods' unquoted `bash -l -c "$PATH/script"`
build phase split on the space and fail with a confusing "No such file or
directory." This blocked every `npx expo run:ios` attempt this session.
**Workaround in use:** `npx expo start --go` (Expo Go) instead of a real
dev build — fine for UI work, but **push notifications genuinely need a
real dev build** and will be blocked until the folder is renamed (to
`personal-projects`, no space) or the project moved. User's call — other
projects share that Documents folder.

### 3. `feature/mobile-branding` is pushed but not merged

Contains everything in items 11–15 above. Safe to merge whenever — full
typecheck + 48/48 tests pass. Merging *does* trigger a Vercel deploy of
the web app (a small nickname-capitalization fix touches one web file;
Vercel rebuilds on every push to `main` regardless of which files
changed) but changes nothing visible on mobile, since nothing has been
built/submitted anywhere mobile runs yet.

## Known state of auth (verified live)

| Scenario | Result |
|---|---|
| Password signup, any email | ✅ works, instant session (confirmations disabled) |
| Password login | ✅ works |
| Forgot password → reset | ✅ works end to end, both web and mobile |
| Magic link | ❌ removed at user's request |
| Password login as mannmankirat@gmail.com | Previously had no password (magic-link-only account) — forgot-password now provides a path to set one |

Existing accounts: `mannmankirat@gmail.com`, `manimsn1234@gmail.com`,
`admin@mycasepro.test` (disposable test account, password `admin123` —
**still not deleted**, delete before real users).

## What's NOT built / not done, in suggested order

1. **Merge `feature/mobile-branding`** — see blocker #3 above.
2. **Resolve the naming split** — "mycase pro" (web) vs "Simply Case"
   (mobile branch). Pick one, apply everywhere.
3. **Rotate 3 credentials** — Supabase secret key, Resend API key, USCIS
   client secret. All were printed to chat transcripts earlier in this
   project (never to git). Status since last rotation is unclear — treat
   as still outstanding unless you have a specific record of doing it.
   Run `bash scripts/check-env.sh` after.
4. **Delete `admin@mycasepro.test`** — only after confirming the owner
   account can sign in via forgot-password (it's currently the only
   account with a known-working password login).
5. **Enable `secure_password_change`** — closes a real gap: right now a
   recovery link produces a full session, and the reset-password action
   only checks that a user exists, not that they recently
   re-authenticated — an open laptop could be used to lock the owner out.
   Bundle into the same config push as the domain/confirmations change.
6. **Rename the project folder** (remove the space) — needed before any
   native dev build work, which push notifications require.
7. **Push notifications** (Expo Push) — `devices` table exists, nothing
   reads it. Needs the folder rename (#6) plus Apple Developer ($99/yr)
   and Google Play ($25) accounts to test on a real device — Expo Go
   cannot receive real push.
8. **Real News tab content** — still placeholder sample cards. **Source
   is now chosen** (Federal Register API + USCIS/State feeds, fetched
   server-side into a `news_items` table) — see the new scope section
   below.
9. **Android** — no Android SDK installed on this machine. Nothing has
   been visually verified on Android, only iOS Simulator.
10. **Review the 7 open Dependabot PRs** — do NOT bulk-merge.
    - Close the `react-native-async-storage` one — Expo SDK 57 pins that
      package to 2.x; the proposed 3.x would break the mobile app.
    - The `npm-minor-patch` grouped PR is safe to merge.
    - `typescript`, `eslint`, `@types/node` are all major-version jumps —
      test before merging, not urgent.
    - The two GitHub Actions bumps are CI-only, low risk.
11. **EOIR / CEAC adapters** — only USCIS exists. EOIR has an
    undocumented JSON endpoint (ACIS portal) and is **not** part of the
    new scope. **CEAC/NVC now is** — confirmed as a user-assisted refresh
    flow, both immigrant and nonimmigrant, see the new scope section
    below.
12. **USCIS production access** — sandbox only. Needs 5 consecutive days
    of sandbox traffic then emailing developersupport@uscis.dhs.gov.
    **User has explicitly deprioritized this for now** — don't chase it
    unprompted.
13. **App Store / Play Store submission** — needs #6, #7's dev accounts,
    plus real screenshots/listing copy (icons are done, see item 13
    above under mobile app).
14. Account deletion/data export, web push, paid tier — deliberately
    deferred; reasoning in `docs/PLAN.md`. (**Processing-time estimates
    are no longer deferred** — they moved into the new scope below, on
    2026-09-12.)

15. **Everything in the new scope section below** — NVC/CEAC, Visa
    Bulletin, processing times, real news, range search. Sequenced as
    Phase F in `docs/ROADMAP.md`; start with the Cloudflare spike.

## 📌 New scope, confirmed 2026-09-12 — competitor feature parity

Origin: the user shared the App Store listing for **Case Tracker for USCIS**
(the incumbent, "2 million users") and asked to match its feature set.
Everything on that list is in scope **except the Civics Quiz, which is
deliberately out** — a decision, not an oversight. Don't re-propose it.

Discussed and decided over a full planning session; the reasoning below is
the part worth keeping, because several of these look obvious and aren't.

### Already covered, no work needed

- **All USCIS receipt prefixes** (EAC, IOE, LIN, MCT, MGL, MSC, NBC, SRC,
  WAC, YSC, ZAR, ZCH, ZHN…). `uscisReceiptSchema` in
  `packages/shared/src/providers.ts` accepts any 3 letters + 10 digits, so
  there is no prefix allowlist to maintain and no work to do here. It also
  already handles the easily-missed `EAC*999910340` asterisk form.
- **Background status checks + change alerts** — `check-cases` every 15 min,
  email live. Push is the missing channel, not the missing logic.

### ⚠️ Blocker discovered while planning: the scrape sources are Cloudflare-gated

Probed live on 2026-09-12 from this machine:

```
travel.state.gov/.../visa-bulletin.html        → 403 Cloudflare
egov.uscis.gov/processing-times/api/...        → 403 Cloudflare "Attention Required"
www.uscis.gov/news/all-news                    → 301 (fine)
```

Retried with a full browser header set (UA + Accept + Accept-Language +
Sec-Fetch-* + Upgrade-Insecure-Requests): **still 403.** So it is **IP
reputation, not headers** — there is no clever-header fix, and the question
is purely *where the request originates from*.

This matters because the Visa Bulletin, NVC timeframes, and USCIS processing
times are all built on "a scheduled function fetches a page," and a Supabase
Edge Function runs from a datacenter IP — the same category that was just
blocked. Three features share one point of failure.

**→ Step one of this whole scope is a spike (see F0 in ROADMAP.md).** A
throwaway edge function that fetches the *real production URLs* and returns
their status codes. No DB writes, no migration, no config push; deleted after.
User has approved the deploy for this purpose.

- **200s** → build the crons on Supabase as normal, nothing changes.
- **403s** → fetchers move to a scheduled **GitHub Action** (free — the repo
  is public — runs from Microsoft IPs these sites generally accept, writes
  back to Supabase via the existing API). Fallbacks after that, in order: a
  scraping/proxy service (~$50/mo, new vendor + recurring bill), or fetching
  from the user's device (residential IP, but fragile and ties data freshness
  to app usage).

Whichever way it lands, **treat a 403 as a normal, alertable runtime outcome,
not a crash.** Same discipline as `poll_runs`: a visa bulletin that silently
stops updating is worse than one that visibly errors.

### The features, as decided

**1. NVC / CEAC tracking — "user-assisted refresh" (option A), both types**

There is **no CEAC API at any price** — the State Department has never
published one. This is not a case of dodging a bill; scraping is the only
mechanism that exists. Two distinct flows behind one name:

| | Immigrant (NVC) | Nonimmigrant (DS-160) |
|---|---|---|
| Input | Case number (`MTL2024678901`) | Interview location + Application ID (`AA00…`) |
| Gate | CAPTCHA | CAPTCHA |

Both are in scope. Same parse-and-store plumbing, two different input forms.

**Mechanism:** in-app WebView loads the CEAC page with the case number
prefilled, the user solves the CAPTCHA and submits, we parse the result and
write a `case_status_events` row like any other provider.

**What this costs:** no background polling for NVC, therefore **no push on an
NVC status change.** Accepted deliberately. The mitigation is a *reminder*
push — "It's been a week, tap to refresh your NVC case" — which needs no
scraping, no CAPTCHA service, and no ToS exposure. The user gets a nudge
instead of an alert.

**Rejected:** a server-side scrape with a CAPTCHA-solving service (2captcha
et al., ~$1–3/1000). It is almost certainly what the incumbent does and it
would give true background polling, but it is squarely against State Dept
terms, is a recurring bill, and breaks whenever they rotate CAPTCHA vendors.

**Deferred, not dead:** a hybrid where the user-solved session is stored and
reused for background polls until it expires. Ruled out *for now* only
because the session lifetime is unknown — it could be 20 minutes, making the
whole spike wasted. Option A does not block this upgrade later.

**Good news on the data:** CEAC's status vocabulary is small and clean (At
NVC, In Transit, Ready, Administrative Processing, Issued, Refused), so it
maps onto the existing `classifyStatus()` with very little new work.

**2. Visa Bulletin — daily check, full store + optional personalization**

Daily cron (bulletins drop unpredictably mid-month, and a daily check costs
nothing) → resolve next month's URL → parse → store → notify.

- Store the **complete** bulletin: Final Action Dates *and* Dates for Filing,
  family + employment categories, all country columns (All Areas / China /
  India / Mexico / Philippines).
- **Store the raw HTML next to the parsed rows, and alert on parse failure.**
  State reshuffles that markup periodically, and a silent parse failure means
  silently wrong dates on an immigration app.
- **Personalization is the part worth building.** User optionally saves
  category + country + priority date; the screen then says "your date is
  current" / "you're ~4 months out" instead of making them read a table.
  Users who skip setup just see the full table. The raw table is a commodity
  — everyone has it.
- "New bulletin released" is the one notification that fans out to every user
  at once rather than trickling.

**3. Processing times — both sources**

- **USCIS: use the JSON endpoint**, not a scrape —
  `egov.uscis.gov/processing-times/api/…`, no key, no auth. Confirmed real
  (the `rd.thecoatlessprofessor.com/uscis-processing/` R package is built on
  it; fields include `form_name`, `office_code`, `range_lower`/`range_upper`,
  `service_request_date`). Subject to the Cloudflare spike above. Because the
  form type and service center are derivable from the receipt, this can
  render on the case detail screen with **no user input at all**.
- **NVC timeframes:** no API — scrape, same cron as the bulletin. It is a
  short "we are processing documents received on [date]" block, trivial parse.

**4. Real news — server-side, into a table**

Replaces the placeholder cards in `news.tsx`. Chosen sources:

- **Federal Register API** — free, JSON, filterable to USCIS/DHS/State
  immigration documents. Highest-signal source and largely unused by apps in
  this category.
- **USCIS newsroom + travel.state.gov announcements** for plain-language items.

Fetch on a cron into a `news_items` table, dedupe, serve from our own DB.
**Never fetch feeds from the client** — otherwise a dead upstream feed breaks
the app, and there is no way to hide junk.

**5. Range search — official API, async, rate-limited, cached**

*What it is:* receipt numbers are sequential, so the receipts around yours
were filed at the same service center within hours of yours — your cohort.
Range search polls that block and reports "34 of 62 nearby cases approved,
nearest approval 11 receipts ahead, 14 approvals in the last 30 days."

*Why it matters:* it is the only feature that answers "is my case stuck, or is
everyone stuck?" A user's own page says "Case Was Received" for eight months
either way. It is also the most-praised feature in the incumbent's reviews.

*Quota is a non-issue — this corrects an earlier concern raised in planning.*
USCIS production documents **400,000 requests/day and 10 TPS**. A ±50 search
is 100 calls; a thousand searches a day is a quarter of the daily quota.

*The real constraint is 10 TPS*, and it is a UX constraint, not a risk one:
100 lookups take ≥10 seconds, so this **cannot be a synchronous request with
a spinner.**

Design:
- **Use the official API, not the public egov page.** No Cloudflare exposure,
  no IP blocks, ample quota. (An earlier plan to scrape egov for this was
  dropped once the real quota numbers came in.)
- **Async job**: user taps "Scan nearby cases" → enqueue → worker drains at
  ≤10 TPS → results fill progressively, or push on completion.
- **One global rate limiter, in Postgres, not function memory.** 10 TPS is
  the *account's* ceiling, shared with the 15-min polling cron; concurrent
  edge function invocations would each blow past an in-memory limiter
  independently. This is the easiest part to get wrong.
- **Cache every scanned result.** The next user whose receipt falls in that
  block gets an instant answer free, and coverage compounds with the user base.
- **Cap scans per user per day** (~5) — not for quota, but so one person's
  retry loop cannot monopolise the shared 10 TPS.
- Lives under Resources, seeded with the user's own receipt.

*Noted and overruled, recorded so it isn't re-litigated:* sequential
enumeration of receipt blocks is a recognisable abuse signature, and API
access is tied to your credentials — losing it would kill the core product,
not just this feature. Against that: USCIS publishes no rule prohibiting it,
and provisioning 400k/day implies bulk use is expected. **User's call, made
knowingly. Build it.**

**6. Push + legal — after the above, by user's choice**

- **Push** is unchanged and still gated on the folder rename (blocker #2) plus
  Apple ($99) / Play ($25). Nothing above is blocked by it — features get
  built, notifications light up later.
- **Legal pages** (`/legal/terms`, `/legal/privacy` on web as real URLs, the
  App Store requires a privacy policy URL; mobile links out; plus a "not
  affiliated with any U.S. government entity, not legal advice" disclaimer on
  case screens). Scheduled last by the user. **Mild standing objection: this
  is ~2 hours of work and a hard submission blocker, so it is worth slotting
  into any gap rather than saving for the end.** It also needs real answers
  from the user (what data is stored, retention) before the privacy policy is
  anything but boilerplate fiction.

### Navigation — "More" becomes "Resources"

Confirmed layout (4 tabs, no new tab):

```
[ Cases ]   [ News ]   [ Resources ]   [ Profile ]
                            │
                            ├─ Visa Bulletin      (table + "your date")
                            ├─ Processing Times   (USCIS + NVC)
                            └─ Range Search       ("cases near yours")
```

The empty "coming soon" slot becomes a real section. Two alternatives were
considered and rejected for now: promoting Visa Bulletin to a 5th tab (too
cramped at phone width), and moving range search onto the case detail screen
where the user is already standing (better product instinct, slightly more
work — worth revisiting once Resources exists).

---

## Environment variables

**Vercel** (3 vars, all `NEXT_PUBLIC_`, none secret):
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`NEXT_PUBLIC_SITE_URL`.

**`apps/web/.env.local`**: same three (with `SITE_URL=http://localhost:3000`),
plus `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `NOTIFICATION_FROM_EMAIL`,
`USCIS_CLIENT_ID/SECRET`.

**Supabase Edge Function secrets**: `CRON_SECRET`, `USCIS_CLIENT_ID`,
`USCIS_CLIENT_SECRET`, `USCIS_ENVIRONMENT`, `RESEND_API_KEY`,
`NOTIFICATION_FROM_EMAIL`. `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are
auto-injected — don't set them.

**Supabase redirect allowlist**: `http://localhost:3000/**`,
`https://simply-case-web.vercel.app/**`, `mycasepro://**`, `exp://**`.
Vercel **preview** URLs are NOT included — a config push, ask first.

## Commands

```
npm run dev              # web dev server
npm run typecheck        # all workspaces
npm run lint
npm test                 # USCIS adapter + status classifier tests
bash scripts/check-env.sh
bash scripts/check-poll-health.sql   # actually run via supabase db query --linked

cd apps/mobile && npx expo start --go       # Expo Go — daily driver, fast
cd apps/mobile && npx expo run:ios          # real dev build — currently broken, see blocker #2
```

USCIS sandbox test receipts: `EAC9999103403` (has history),
`EAC9999103400` (no history), `LIN9999106498` (has history). Sandbox is
Mon–Fri 7AM–8PM EST; a 503 outside that window is expected.

## Lessons learned (don't re-learn these)

- **`supabase config push` applies every declared property, not just the
  one you changed.** Always `config diff` first.
- **`UID` is a reserved bash variable.**
- **Expo Router route types are generated by the dev server and don't
  reliably regenerate from a running server after routes are added or
  moved.** If a route typechecks as invalid right after restructuring
  navigation, kill Metro, delete `.expo/types/router.d.ts`, and cold
  restart to force a full re-scan.
- **A `Tabs` layout has no implicit `/` route the way a `Stack`'s
  `index.tsx` does.** Converting a Stack to Tabs silently breaks any
  `router.replace("/")` call until you add a hidden redirect screen.
- **PostgREST can only embed via a real FK between the two tables
  queried.**
- **Next.js hard-pins its own React version** — a monorepo with Expo
  will legitimately have two React copies; safe, don't "fix" it.
- **CLI exit code 0 is not proof of success.** Two separate `pod install`
  / `xcodebuild` failures this session both reported success while
  actually failing (a stale `Podfile.lock` after bumping native package
  versions with `expo install --fix` — always update packages BEFORE
  building, never after). Verify the actual artifact, not the exit code.
- **A logo/icon PNG can have huge baked-in transparent padding that isn't
  obvious by eye.** Two rounds of "the logo looks tiny/has a white border"
  feedback were both this — measure with `sharp().trim()` before
  compositing onto a background, don't just resize.
- **macOS's default filesystem is case-insensitive.** Dragging in a file
  named `icon.PNG` silently overwrote an existing `icon.png` — same file,
  different case, one inode. Worth knowing before naming future assets.
- **Verify against reality, not assumption.** A live cron "succeeded"
  status only means pg_cron queued the HTTP request, not that the
  function did anything useful — this is exactly why `poll_runs` exists.
