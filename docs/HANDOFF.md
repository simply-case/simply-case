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
Functions) · Expo/React Native · Resend (email) · Vercel (deployed at
https://simply-case-web.vercel.app) · npm workspaces monorepo.

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
8. **Deployed to Vercel** — https://simply-case-web.vercel.app, project
   `simply-case-web`, root dir `apps/web`. Only 3 env vars needed
   (all NEXT_PUBLIC_, none secret): SUPABASE_URL,
   SUPABASE_PUBLISHABLE_KEY, SITE_URL. The web app never reads the
   Supabase secret key by design.

## THE ONE BLOCKER FOR REAL USERS: verify a Resend domain

**Symptom:** password signup with any email other than the Resend account
owner's returns HTTP 500 "Error sending confirmation email". Magic link to
mannmankirat@gmail.com works fine.

**Cause (confirmed by hitting the Resend API directly):**
> "You can only send testing emails to your own email address
> (mannmankirat@gmail.com). To send emails to other recipients, please
> verify a domain at resend.com/domains, and change the `from` address."

This is NOT a code, template, Supabase, or Vercel problem — the app is
working correctly. It is purely the Resend test-sender restriction while
using `onboarding@resend.dev` with no verified domain.

An earlier diagnosis in this project wrongly concluded the hosted "Confirm
signup" email template was broken. It was not — the template was replaced
with a custom one (`supabase/templates/confirmation.html`, declared in
config.toml) and the failure persisted identically, which is what exposed
the real cause. The custom template is fine to keep, it just was not the fix.

**Fix:** buy a domain (~$12/yr) -> add at resend.com/domains -> add the DNS
records -> change sender from `onboarding@resend.dev` to
`noreply@yourdomain.com` in BOTH places:
  1. Supabase dashboard -> Authentication -> SMTP Settings (sender email)
  2. `NOTIFICATION_FROM_EMAIL` in `.env.local` + `supabase secrets set`
     (used by the send-notifications Edge Function)

Until that is done: only mannmankirat@gmail.com can receive any email from
this app. Everyone else silently fails. Hard launch blocker.

## Known state of auth (all verified live)

| Scenario | Result | Why |
|---|---|---|
| Magic link -> owner email | works | |
| Password login, `admin@mycasepro.test` / `admin123` | works | pre-confirmed via admin API |
| Password login, mannmankirat@gmail.com | fails, `invalid_credentials` | account was created via magic link, so it has NO password set. There is no password-reset UI built yet — that is a genuine missing feature. |
| Password signup, existing email | fake success, does nothing | Supabase anti-enumeration returns a decoy user with `identities: []` |
| Password signup, new email | HTTP 500 | the Resend domain restriction above |

## What's NOT built yet, in likely order

1. **Verify a Resend domain** — see the blocker section above. Nothing
   else matters for real users until this is done.
2. **Password-reset flow** — not built. Any account created via magic link
   has no password and currently cannot use password login at all, with no
   in-app way to set one. Needed before password auth is genuinely usable.
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
