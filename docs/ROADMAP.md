# mycase pro — roadmap

Working plan agreed 2026-09-11. Sequenced deliberately; read "Why this
order" before reordering anything.

Companion docs: `PLAN.md` (architecture + product decisions, the *why*),
`HANDOFF.md` (current state + standing working rules).

---

## Why this order

**Domain purchase is LAST, by decision.** Resend's test sender delivers only
to the account owner (mannmankirat@gmail.com), so every email path —
password reset, case notifications, quiet hours — is fully testable solo
today. The domain buys *other people*, not *verification*. Build and prove
the product first.

**The one constraint that comes with that:** `enable_confirmations` stays
`false` until the domain exists, which means anyone can register an address
they don't control, and this app emails immigration status to that address.
So **no one but the owner creates an account until Phase E.** The trigger to
buy the domain is not a date — it is the first moment someone else needs a
login. At that point it becomes blocking the same day.

**USCIS goes first** because it is the only multi-week external dependency:
5 consecutive days of sandbox traffic plus a human approval loop at a
federal agency. It runs in the background across everything else.

---

## Phase A — start the USCIS production clock (do first, ~1 hour)

External clock. Nothing else depends on it, so it must not wait.

- [ ] **A1.** Verify the current production-access requirements on the USCIS
      developer portal. The "5 consecutive days of sandbox traffic" rule is
      what this project recorded earlier — confirm it is still accurate
      before relying on it. This project has twice been burned by trusting a
      written description over checking.
- [ ] **A2.** Confirm what USCIS actually COUNTS as traffic. The portal
      dashboard defaults to **"Average response time," which is not a volume
      metric** — it cannot evidence call count. Switch the metric selector to
      a request/call-count view before drawing any conclusion, and widen the
      date range beyond the default 1 day.
- [ ] **A3.** Corroborate from our own side, in the Supabase SQL editor:

      ```sql
      -- Did the scheduler fire, and did it SUCCEED? (status matters)
      select status, count(*), min(start_time), max(start_time)
      from cron.job_run_details
      where jobname = 'check-cases-uscis'
      group by status order by 3;

      -- Corroborate with real API activity
      select date_trunc('day', last_checked_at) as day, count(*)
      from tracked_cases group by 1 order by 1;
      ```

      A cron that fires and then fails auth looks identical to a healthy one
      if you only check that rows exist.
- [ ] **A4. Investigate the activity gaps.** The 2026-09-11 dashboard shows
      traffic roughly 19:00-05:00 and 09:00-11:00, with flat-zero stretches
      05:00-09:00 and 11:00-16:00 (America/New_York). That is close to the
      INVERSE of the sandbox's documented Mon-Fri 7AM-8PM EST window, which
      suggests a meaningful share of our calls may be hitting a closed
      sandbox and returning 503.

      This matters more than it looks: `check-cases` deliberately does not
      count 503 against `consecutive_errors` (correct behaviour), so a cron
      that is producing almost nothing but 503s looks perfectly healthy on
      our side while generating **no traffic USCIS would credit.** Resolve
      this BEFORE counting days.
- [ ] **A5. Date math — the clock started 2026-09-10, not earlier.** Phase 5
      deployed on 2026-09-10 (commit bb079d9); HANDOFF.md's suggestion that
      the requirement "may already be satisfied" is optimistic — as of
      2026-09-11 there is roughly **one day** of traffic, which matches the
      dashboard.

      2026-09-11 is a **Friday**, and the sandbox is documented Mon-Fri. If
      USCIS requires 5 *consecutive* days and weekend traffic does not
      count, the earliest realistic completion is **Fri 2026-09-18** (using
      Mon 09-14 through Fri 09-18), not Tue 09-15. Confirm whether weekends
      break the streak — it is a 3-day swing.

---

## Phase B — backend hardening (~half a day)

Six items. Only B1 and B2 are new code; the rest is recorded cleanup.

- [ ] **B1. `poll_runs` observability table.** New migration. One row per
      `check-cases` invocation: started_at, finished_at, cases_claimed,
      cases_changed, errors, outcome. Today "is polling healthy?" can only
      be answered by forensics across `cron.job_run_details` and
      `tracked_cases.last_checked_at`. This is also the evidence to show
      USCIS. ⚠️ Migration against the shared production DB — additive only,
      but flag before pushing.
- [ ] **B2. Drain the stale push queue.** `user_cases.notify_push` defaults
      `true` and `check-cases` enqueues `channel='push'` rows, but
      `send-notifications` filters `.eq("channel","email")`. Every status
      change since Phase 6 left a permanently-pending push row — they would
      all fire at once the day push ships. Decide: mark existing rows
      `status='skipped'`, or stop enqueuing push until a consumer exists.
      Prefer the latter plus a one-time cleanup.
- [ ] **B3. Enable `secure_password_change`.** A recovery link produces a
      full session, and `reset-password/actions.ts` only checks that a user
      exists — so anyone with an active session (open laptop) can set a new
      password without knowing the old one and lock the owner out. Config
      flag, not code. ⚠️ `supabase config diff` FIRST — config.toml has
      previously drifted 20 fields from production.
- [ ] **B4. Rotate three credentials** — Supabase secret key, Resend API
      key, USCIS client secret. All three were printed to chat transcripts
      (never to git) and are still live. Procedure and post-rotation steps
      are in HANDOFF.md. Run `bash scripts/check-env.sh` after.
- [ ] **B5. Dependabot** — 2 moderate vulnerabilities open on `main`.
- [ ] **B6. Delete `admin@mycasepro.test`** — password `admin123`, on the
      production database. Note: this is currently the only account with a
      working password login, so do this only after confirming the owner
      account can sign in via forgot-password.

---

## Phase C — mobile UI (the bulk of the work)

**Mobile is the primary platform** (PLAN.md). Design here first, then port
the visual language to web in Phase D.

**Design intent: calm and trustworthy.** People open this app anxious about
an immigration case. That is the brief. It argues for generous spacing,
quiet color, no alarm-red for ordinary states, honest empty and loading
states, and never making a pending status *look* like bad news.

- [ ] **C1. Design tokens first.** Color, type scale, spacing, radii, shadow
      — defined once. Put them where web can consume them later
      (`packages/shared`), even though only mobile reads them in this phase.
      Doing this before screens is what prevents Phase D from becoming a
      rewrite.
- [ ] **C2. Core primitives** — Button, Input, Card, Badge/StatusPill,
      ListRow. Hand-rolled against the tokens.
- [ ] **C3. Status design.** The single most important visual decision in
      the app: how a case status reads at a glance. Needs a defined visual
      treatment per status class (pending / progress / action-needed /
      approved / denied) that is legible without relying on color alone.
- [ ] **C4. Screen pass**, in order: case list → case detail + timeline →
      add case → sign-in/sign-up → forgot/reset password → settings.
- [ ] **C5. States.** Empty, loading (skeletons, not spinners), error,
      offline. Currently the weakest part of both apps.
- [ ] **C6. Deep-link click-test on a real device.** Flagged in HANDOFF.md
      as never fully verified. Use `npx expo start --go --tunnel` — plain
      `--go` binds localhost, which a phone cannot reach.

---

## Phase D — web UI

Port the Phase C design language. Web is the secondary surface, but it is
the one that is publicly deployed, so it should not look abandoned.

- [ ] **D1.** Consume the same tokens from `packages/shared`.
- [ ] **D2.** Screen pass matching C4.
- [ ] **D3.** Responsive + accessibility pass: real focus states, keyboard
      navigation, contrast, `prefers-reduced-motion`.

---

## Phase E — domain + launch gates

Only now, or sooner if anyone else needs an account.

- [ ] **E1.** Buy domain (~$12/yr), verify at resend.com/domains.
- [ ] **E2.** Update the sender in BOTH places: Supabase Auth SMTP settings,
      and `NOTIFICATION_FROM_EMAIL` in `.env.local` + `supabase secrets set`.
- [ ] **E3.** Re-enable `auth.email.enable_confirmations`. ⚠️ Config push —
      `config diff` first. **This is the real-user gate**, not merely a
      launch gate: it is live the moment a second person signs up.
- [ ] **E4.** Add `https://*.vercel.app/**` to the Supabase redirect
      allowlist so preview deploys authenticate correctly. ⚠️ Production
      config change.

---

## Deferred beyond this roadmap

Push notifications (needs Apple $99 + Google $25; `devices` table exists but
nothing reads it), EOIR and CEAC adapters, App Store / Play Store
submission, processing-time estimates, account deletion / data export, paid
tier. Reasoning in PLAN.md.

---

## Standing rules (from HANDOFF.md — they still apply)

1. **Never `git push` without asking.** Local commits are free; pushing is
   the gated step.
2. **Feature branch per feature → PR → `main`.** Suggested branches here:
   `feature/poll-observability`, `feature/mobile-ui`, `feature/web-ui`.
3. **Flag every `supabase db push` / `config push` before running it.** One
   shared Supabase project — git branches do not isolate the database.
4. **Never print secret values.** Not even indirectly (`${VAR:-default}`,
   `curl -v` SMTP base64).
5. **Verify against reality.** Test the running app, not just typecheck.

## Model usage

Opus for plans, ideas, and questions. Sonnet 5 for coding and execution.
Flag the switch when moving between the two.
