# mycase pro — handoff

Paste this into a new chat to continue. Written 2026-09-11.

## What this is

Immigration case tracker (USCIS / EOIR / CEAC receipt numbers) with status
history and push/email notifications on change. Web (Next.js) + mobile
(Expo/React Native), one shared Supabase backend.

- **GitHub:** github.com/simply-case/simply-case (public, renamed from
  mycase-pro/mycase-pro partway through — if a remote URL anywhere still
  says mycase-pro, update it)
- **Supabase project:** "mycase pro", ref `ltpvagdbprwzqtasurez`, us-east-1
- **Local path:** `/Users/manimann/Documents/personal projects/mycasepro`
- **Full architecture/decisions:** `docs/PLAN.md` in the repo — read that
  for the *why* behind the schema, the de-duplication design, and the
  confirmed product decisions (audience, notification privacy, pricing).

## Stack

Next.js (App Router) + TypeScript · Supabase (Postgres/Auth/Edge
Functions) · Expo/React Native · Resend (email) · Vercel (web hosting,
being set up now) · npm workspaces monorepo.

## What's built and verified working (Phases 0–6)

Each of these was actually tested against the live project, not just
written — see commit messages in git log for exactly what was verified
and how.

1. **Monorepo scaffold** — `apps/web`, `apps/mobile`, `packages/shared`
   (validators + generated Supabase types shared by both apps).
2. **Database + RLS** — 8 migrations in `supabase/migrations/`. Core design:
   `tracked_cases` is one shared row per real-world case (provider +
   case_key), `user_cases` is the per-user subscription — so N users
   tracking the same receipt number costs one poll, not N.
   `tracked_cases`/`case_status_events` have **no direct select policy**;
   read only through `my_case_details`/`my_case_events` views scoped to
   the caller's own subscriptions, so receipt numbers can't be enumerated.
   Verified live: anon reads return empty even on direct-ID lookups,
   cross-user writes get rejected with 403.
3. **USCIS adapter** (`supabase/functions/_shared/uscis.ts`) — 38 tests,
   `npm test`. Handles real quirks found by testing against the live
   sandbox, not just the docs: nested error envelope with string codes
   (docs say flat/numeric), OAuth creds must go in the POST body not Basic
   auth, two response schemas (IOE-prefix receipts omit
   submittedDate/modifiedDate entirely), 503/429 must NOT count against
   `consecutive_errors` (sandbox is closed nights/weekends by design).
4. **Polling pipeline** — `check-cases` Edge Function, deployed, triggered
   every 15 min via `pg_cron` + `pg_net`. Auth is a shared secret
   (`CRON_SECRET`) stored in Supabase Vault, read at call time — never a
   literal in any committed migration.
5. **Web app auth + UI** — magic link (Resend SMTP) AND email/password
   (added later purely for fast testing — both work, magic link wasn't
   removed). Dashboard, add/archive/remove case, case detail with
   timeline. `/auth/confirm` handles Supabase's actual PKCE `code`
   redirect (not the token_hash shape admin-generated test links use —
   this was a real bug, found by clicking a real email link, not by
   testing with admin-API-generated links).
6. **Mobile app** (Expo Router, SDK 57) — same screens, same backend, same
   `add_case` RPC. Auth is genuinely different from web: no server route,
   so `app/auth/confirm.tsx` parses tokens out of the deep-link URL
   fragment and calls `setSession()` directly. Also has the password-login
   tab for fast device testing. **Known gap:** the magic-link deep-link
   flow was fixed for a `localhost`-vs-tunnel networking issue
   (`npx expo start --go --tunnel` fixes it) but hasn't been fully
   click-tested end-to-end on a real device by me — worth a real test.
7. **Email notifications** — `send-notifications` Edge Function, every 5
   min via the same cron+Vault pattern. Drains the `notifications` queue
   `check-cases` enqueues on a status change. Respects per-user quiet
   hours. Push notifications NOT built yet (needs Apple/Google dev
   accounts — see below).

## In progress right now

**Vercel deploy of apps/web.** Import screen is open in the Vercel
dashboard: project `simply-case-web`, root directory `apps/web` (correct),
Next.js preset (correct). Three env vars need adding before clicking
Deploy — none are secrets, the web app never touches the Supabase secret
key by design:

- `NEXT_PUBLIC_SUPABASE_URL` = `https://ltpvagdbprwzqtasurez.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = from `apps/web/.env.local`
- `NEXT_PUBLIC_SITE_URL` = predicted `https://simply-case-web.vercel.app`
  (confirm against the real assigned domain after first deploy — Vercel
  sometimes appends a suffix if the name collides)

**Immediately after deploy succeeds, do this before testing auth on the
live site:** Supabase dashboard → Authentication → URL Configuration →
Redirect URLs is currently **empty**. Add the real Vercel domain there
(e.g. `https://simply-case-web.vercel.app/**`), or magic-link/password
auth will fail on the deployed site the exact same way it failed locally
before `NEXT_PUBLIC_SITE_URL` was wired up correctly.

## What's NOT built yet, in likely order

1. **Finish/verify the Vercel deploy** (in progress — see above).
2. **UI design pass.** Both apps are functional but deliberately
   plain/unstyled — this was a conscious choice to prove the pipeline
   first. User has asked about this; agreed to defer it, revisit once
   comfortable with current functionality.
3. **Push notifications** (Expo Push). Needs an Apple Developer account
   ($99/yr) and Google Play Console ($25 one-time) before real device
   push can be tested — Expo Go can't receive real push. Device
   registration table (`devices`) already exists in schema; nothing reads
   from it yet.
4. **EOIR / CEAC adapters.** Only USCIS is built. EOIR has an undocumented
   JSON endpoint (ACIS portal). CEAC has no API and is CAPTCHA-gated —
   plan was a user-assisted refresh flow, not automated solving.
5. **USCIS production access.** Sandbox-only right now. Requires 5
   consecutive days of sandbox traffic (cron has been running since
   Phase 5, so this clock may already be satisfied — check) plus manually
   emailing developersupport@uscis.dhs.gov once eligible.
6. **App Store / Play Store submission** — needs the developer accounts
   from #3, plus real app icons/screenshots/listing copy (placeholder
   Expo template icons are still in place).
7. Processing-time estimates, account deletion/data export, web push,
   paid tier — all deliberately deferred, see `docs/PLAN.md` for the
   reasoning on each.

## Credentials: rotate before/soon after resuming

Several credentials were accidentally printed into **chat transcripts**
during this project (never into git — verified repeatedly via full
history scans, safe to keep public). Standing guidance agreed with the
user: keep read access to `.env.local` (needed to test/deploy directly),
rotate after heavy sessions rather than block access entirely. A history
rewrite + public repo transition just happened, which is exactly a "heavy
session" — **this is a good time to rotate:**

- Supabase secret key (Project Settings → API Keys) — then
  `supabase secrets set` won't need touching since Edge Functions read
  `SUPABASE_SERVICE_ROLE_KEY`, which is auto-injected, not this one
- USCIS client secret (developer.uscis.gov) — then
  `supabase secrets set USCIS_CLIENT_SECRET=...`
- Resend API key (resend.com dashboard) — then
  `supabase secrets set RESEND_API_KEY=...` and update Supabase's SMTP
  password (dashboard → Authentication → SMTP Settings) to match

There's also a disposable test account, safe to leave or delete:
`admin@mycasepro.test` / `admin123` (created via admin API, pre-confirmed,
zero real data risk since it's on an otherwise-empty-of-real-users
database).

## Operating notes / lessons learned worth keeping

- **Never `cat`/Read a file containing secrets.** Use
  `grep -c "^KEY=" file` (presence check) or extract via a script that
  writes to another file, never to stdout. This was violated three times
  this session (Read tool, a bad shell script, an IDE auto-notification)
  — all three leaks were chat-only, never git, but avoidable.
- **`supabase config push` applies every declared property, not just the
  one you meant to change.** Always `supabase config diff` first — the
  project's config.toml was originally 20 fields out of sync with the
  live project and a blind push would have disabled MFA and email
  confirmations. Run `supabase config pull` before ever hand-editing
  config.toml again if it drifts.
- **`UID` is a reserved bash variable** — don't use it as a shell var name
  (breaks with a cryptic "bad math expression" error). Bit twice this
  session.
- Sandbox-only USCIS testing numbers: `EAC9999103403` (has history),
  `EAC9999103400` (no history), `LIN9999106498` (has history). Sandbox is
  Mon–Fri 7AM–8PM EST only; 503 outside that window is expected, not a bug.
- `check-env.sh` in `scripts/` validates env var shape/liveness without
  ever printing values — use it after any credential rotation.
