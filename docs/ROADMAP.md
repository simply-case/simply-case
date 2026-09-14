# Simply Case — roadmap

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

**Status 2026-09-12 (late):** not yet eligible. Two findings change how
to count days:
- The user saw sandbox traffic succeeding on the **weekend**, so the
  documented Mon–Fri window (A4/A5's premise) looks wrong. Weekends likely
  count, but confirm with USCIS rather than assume.
- **A polling outage was found and fixed** (migration 0011): pg_net's
  5-second default timeout was cutting off most cron calls, so many
  "successful" runs never actually checked a case. See HANDOFF.md →
  "Polling outage, 2026-09-12". Count the streak from `poll_runs.updated`
  per day, starting no earlier than the fix.
- Polling was **temporarily** sped up to every 14 min for more traffic.
  Revert after production access (SQL in HANDOFF.md).

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

- [x] **B1. `poll_runs` observability table.** New migration. One row per
      `check-cases` invocation: started_at, finished_at, cases_claimed,
      cases_changed, errors, outcome. Today "is polling healthy?" can only
      be answered by forensics across `cron.job_run_details` and
      `tracked_cases.last_checked_at`. This is also the evidence to show
      USCIS. ⚠️ Migration against the shared production DB — additive only,
      but flag before pushing.
- [x] **B2. Drain the stale push queue.** `user_cases.notify_push` defaults
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
- [x] **B4. Rotate three credentials** (done 2026-09-12) — Supabase secret key, Resend API
      key, USCIS client secret. All three were printed to chat transcripts
      (never to git) and are still live. Procedure and post-rotation steps
      are in HANDOFF.md. Run `bash scripts/check-env.sh` after.
- [ ] **B5. Dependabot** — config added (`.github/dependabot.yml`), but the
      2 moderate vulnerabilities are still open on `main` and 7 Dependabot
      PRs await triage (see HANDOFF.md item 10).
- [x] **B6. Delete `admin@mycasepro.test`** (done 2026-09-12) — password `admin123`, on the
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

- [x] **C1. Design tokens first.** Color, type scale, spacing, radii, shadow
      — defined once. Put them where web can consume them later
      (`packages/shared`), even though only mobile reads them in this phase.
      Doing this before screens is what prevents Phase D from becoming a
      rewrite.
- [x] **C2. Core primitives** — Button, Input, Card, Badge/StatusPill,
      ListRow. Hand-rolled against the tokens.
- [x] **C3. Status design.** The single most important visual decision in
      the app: how a case status reads at a glance. Needs a defined visual
      treatment per status class (pending / progress / action-needed /
      approved / denied) that is legible without relying on color alone.
- [x] **C4. Screen pass**, in order: case list → case detail + timeline →
      add case → sign-in/sign-up → forgot/reset password → settings.
- [ ] **C5. States.** Empty, loading (skeletons, not spinners), error,
      offline. Empty/loading/error done; **offline handling does not exist
      in either app yet** (checked 2026-09-12).
- [x] **C6. Deep-link click-test on a real device.** Passed 2026-09-12 after fixing a missed-link bug (PR #16). Flagged in HANDOFF.md
      as never fully verified. Use `npx expo start --go --tunnel` — plain
      `--go` binds localhost, which a phone cannot reach.

---

## Phase D — web UI

Port the Phase C design language. Web is the secondary surface, but it is
the one that is publicly deployed, so it should not look abandoned.

- [x] **D1.** Consume the same tokens from `packages/shared`.
- [x] **D2.** Screen pass matching C4.
- [x] **D3.** Responsive + accessibility pass: real focus states, keyboard
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

## Phase F — feature parity scope (added 2026-09-12)

Full reasoning, rejected alternatives, and the Cloudflare evidence are in
**HANDOFF.md → "New scope, confirmed 2026-09-12"**. Product decisions are in
**PLAN.md**. This is the sequencing only.

**F0 gates F2, F3 and F4 — do it first.**

- [x] **F0. Cloudflare spike (~20 min).** **Ran 2026-09-12. Result below.** Throwaway edge function that fetches
      the *real production URLs* (a specific monthly bulletin page, the NVC
      timeframes page, the processing-times API endpoint) and returns status
      codes. No DB writes, no migration, no config push. Delete after.
      ⚠️ Deploys to the shared Supabase project — user has approved this
      specific deploy. **200 → build crons on Supabase. 403 → move the
      fetchers to a scheduled GitHub Action** (free, repo is public).
      Either way: a 403 at runtime must alert, not crash.

      **Result (from Supabase Edge, run twice, function deleted after):**

      | Source | Status |
      |---|---|
      | travel.state.gov visa bulletin (index, Sep 2026, Oct 2026) | **403** Cloudflare challenge |
      | travel.state.gov NVC timeframes | **403** Cloudflare challenge |
      | egov.uscis.gov processing-times API | **403** Cloudflare challenge |
      | uscis.gov newsroom | 200 |
      | federalregister.gov API | 200 |

      So **F4 (news) can run on Supabase as planned. F2 and F3 cannot.**
      The GitHub Actions fallback is **untested**: GitHub runners are also
      datacenter (Azure) IPs and may be blocked the same way. **F0b: repeat
      the probe from a GitHub Action before building F2/F3 on it.**

- [ ] **F1. Rename the `More` tab to `Resources`** and give it a real index
      (Visa Bulletin · Processing Times · Range Search). Cheap, unblocks
      having somewhere to put F2–F5. Tab layout stays at 4.

- [ ] **F2. Visa Bulletin.** Daily cron → resolve next month's URL → parse →
      store parsed rows *and raw HTML* → alert on parse failure. Full table
      screen first, then the optional personalized view (category + country +
      priority date → "your date is current"). "New bulletin" notification
      queues behind push (F7).

- [ ] **F3. Processing times.** USCIS JSON endpoint (no key) rendered on case
      detail with no user input, since form type and service center come from
      the receipt. NVC timeframes scraped on the same cron as F2.

- [ ] **F4. Real news.** Federal Register API + USCIS/State feeds → cron →
      `news_items` table → replace the placeholder cards in `news.tsx`.
      Server-side only; never fetch feeds from the client.

- [ ] **F5. NVC / CEAC, user-assisted refresh.** WebView with the case number
      prefilled, user solves the CAPTCHA, parse the result into
      `case_status_events`. **Both types**: immigrant (case number) and
      nonimmigrant (interview location + DS-160 application ID). CEAC's status
      vocabulary is small and maps onto the existing `classifyStatus()`.
      No background polling by design — the weekly "tap to refresh" reminder
      push queues behind F7.

- [ ] **F6. Range search.** Official USCIS API (not the egov page). Async job
      queue, **global rate limiter in Postgres** (10 TPS is the account
      ceiling, shared with `check-cases`), cache every scanned receipt, ~5
      scans/user/day. Progressive results or push on completion — never a
      synchronous spinner, 100 lookups is ≥10 seconds.

- [ ] **F7. Push notifications.** Unchanged prerequisites: folder rename (no
      space in the path) + Apple $99 + Google $25. Three queued consumers land
      here at once — status change, new bulletin, NVC refresh reminder.

- [ ] **F8. Legal pages.** `/legal/terms` + `/legal/privacy` as real web URLs
      (the App Store requires a privacy policy URL), mobile links out, plus a
      "not affiliated with any U.S. government entity / not legal advice"
      disclaimer on case screens. **User scheduled this last; standing
      objection recorded — it is ~2 hours and a hard submission blocker, so
      slot it into any gap.** Needs real answers from the user on what data is
      stored and for how long.

**Explicitly out of scope:** the Civics Quiz. A decision, not an oversight —
see PLAN.md. EOIR is also not part of Phase F.

---

## Deferred beyond this roadmap

EOIR adapter, App Store / Play Store submission, account deletion / data
export, paid tier. Reasoning in PLAN.md.

*Moved out of this list into Phase F on 2026-09-12:* push notifications,
CEAC/NVC, and processing-time estimates.

---

## Standing rules (from HANDOFF.md — they still apply)

1. **Ask before `git commit` AND `git push`.** Both are gated (corrected
   2026-09-12). Explain every commit in plain language afterwards.
2. **Feature branch per feature → PR → `main`.**
3. **Flag every `supabase db push` / `config push` before running it.** One
   shared Supabase project — git branches do not isolate the database.
4. **Never print secret values.** Not even indirectly (`${VAR:-default}`,
   `curl -v` SMTP base64).
5. **Verify against reality.** Test the running app, not just typecheck.

## Model usage

Opus for plans, ideas, and questions. Sonnet 5 for coding and execution.
Flag the switch when moving between the two.

---

## Phase B progress log (2026-09-11)

Done in `feature/backend-hardening`, not yet pushed:
- B1: `poll_runs` table (migration 0009) + check-cases writes a row per
  invocation (start row with `claimed`, filled in with counts/error_kinds on
  exit, `crashed`+`crash_message` if the batch loop throws). Hand-patched
  `database.types.ts` to match — regenerate for real via `npm run db:types`
  once this migration is actually pushed.
- B2: stale push queue drained (migration 0010 marks existing pending push
  rows `skipped`, widens the status check constraint) and `check-cases`
  stops enqueueing new `channel='push'` rows until a consumer exists.
- B5: `.github/dependabot.yml` added (weekly npm + github-actions checks,
  security patches separated from routine bumps).
- `scripts/check-poll-health.sql` added for Phase A's traffic verification.

**Not done — each needs the user directly, not just code:**
- B3 (`secure_password_change`): a `supabase config push`, needs explicit
  sign-off per the standing config-push rule.
- B4 (rotate 3 credentials): requires logging into three dashboards
  (Supabase, Resend, USCIS) — can't be done from the repo.
- B6 (delete `admin@mycasepro.test`): a live-database delete against the
  shared production project — flagging rather than doing unasked.

---

## Phase B deployment log (2026-09-12)

Deployed to production:
- `check-cases` Edge Function, with `--no-verify-jwt --use-api`. The
  **`--no-verify-jwt` flag is mandatory** — the cron authenticates with an
  `x-cron-secret` header, not a JWT, so deploying without it makes every
  cron invocation 401 and polling stops silently. (The function header
  points at "docs/PLAN.md deploy notes" for this; those notes do not
  exist. This is now the record.)
- Migrations 0009 + 0010 via `supabase db push`. Verified with
  `supabase migration list`: 0001-0010 all present locally and remotely,
  no drift.

### Correction: there was no stale push backlog

Migration 0010 and its commit message claimed every status change since
Phase 6 had left a permanently-pending `channel='push'` notification row.
Checked against the live database after deploying: **the `notifications`
table is completely empty** — zero rows, any channel, any status.

The reasoning was wrong in a specific way worth recording. A notification
row is only enqueued when a status *changes* between polls, not on first
fetch. The three tracked cases have not changed status since they were
added, so no notification of either channel has ever been created. The
backlog was theoretical.

What this means:
- 0010's `update` statement was a no-op. Harmless, and the widened status
  check constraint ('skipped') is still there for when it's needed.
- The code change in `check-cases` (stop enqueueing push) is still
  correct and still worth having — it's now genuinely *preventive* rather
  than corrective.
- The framing "drained the stale queue" in commit b1cb160 is inaccurate.
  Nothing was drained because nothing was there.

### Correction: cron.job_run_details has no `jobname` column

`scripts/check-poll-health.sql` query 1 selected
`job_run_details.jobname`, which fails with "column jobname does not
exist". The job name lives on `cron.job`; the two must be joined on
`jobid`. Fixed and verified against the live project (92 runs, all
'succeeded', most recent 2026-09-12 03:00 UTC).

Worth knowing what that 'succeeded' actually means: pg_cron ran
`net.http_post` successfully, i.e. the request was *queued*. It says
nothing about the HTTP status the function returned. A function failing
on every invocation would still read 'succeeded' here — which is
precisely the blind spot poll_runs was built to close.

---

## Session log (2026-09-12, evening)

- **Merged:** PR #14 (docs refresh), #15 ("Simply Case" in all
  user-visible strings), #16 (mobile reset-link fix, verified on device).
- **Credentials:** all three rotated; Edge Function secrets verified by
  digest. Test accounts removed — exactly one account remains.
- **F0 spike:** done; results in Phase F above.
- **Polling:** temporarily 14-min interval; **5-second pg_net timeout
  outage found and fixed** with migration 0011 (pushed).
- **Folder rename** to `personal-projects` (removes the space that broke
  local iOS builds).
- **Correction to earlier advice:** the folder rename was never a
  TestFlight blocker. TestFlight builds come from EAS cloud builds. The
  real TestFlight gates are: Apple Developer account, a privacy policy URL
  (F8), and the domain/confirmation gate (Phase E) before any tester
  creates an account.
