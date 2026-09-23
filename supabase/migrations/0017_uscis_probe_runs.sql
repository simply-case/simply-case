-- uscis_probe_runs: one row per deliberate bad request the uscis-probe-4xx
-- function sends to the USCIS sandbox, and the cron job that drives it.
--
-- Why this exists: after confirming 5 clean days of sandbox traffic, USCIS's
-- reply (2026-09-22) was "we don't observe any 4xx responses on either of
-- your API keys — test that for 5 more days before applying for production
-- access." Our normal polling (check-cases) only ever asks about two valid,
-- existing sandbox receipts, so it never produced one. This table is the
-- evidence for the new streak, mirroring how poll_runs (0009) is the
-- evidence for the original one: "did this actually happen, on which days"
-- shouldn't depend on USCIS's own analytics UI (which the handoff notes
-- defaults to a misleading view).
--
-- Deliberately a separate table from poll_runs / tracked_cases: this data
-- has nothing to do with real case polling and must never be able to affect
-- it (trip the circuit breaker, appear in case history, trigger an email).
--
-- To find the day-by-day streak once ready to reapply, something like:
--   select date_trunc('day', created_at at time zone 'America/New_York') as et_day,
--          count(*) filter (where is_four_xx) as four_xx_count
--   from uscis_probe_runs
--   group by 1 order by 1;
--
-- ---------------------------------------------------------------------
-- TEARDOWN (run this, as a migration 0018, once USCIS grants production
-- access and this evidence is no longer needed — see docs/HANDOFF.md):
--
--   select cron.unschedule('uscis-probe-4xx');
--   drop table uscis_probe_runs;
--
-- Then: npx supabase functions delete uscis-probe-4xx, delete
-- supabase/functions/uscis-probe-4xx/, supabase/functions/_shared/uscis-probe.ts
-- and its test, and regenerate database.types.ts.
-- Do NOT delete this file (0017) itself — migrations are an append-only
-- history; 0018 is how you undo an applied one.
-- ---------------------------------------------------------------------

create table uscis_probe_runs (
  id uuid primary key default gen_random_uuid(),

  -- "primary" (USCIS_CLIENT_ID/SECRET) or "secondary" (USCIS_CLIENT_ID_2/
  -- SECRET_2, optional — see uscis-probe-4xx/index.ts).
  credential_label text not null,

  -- "nonexistent_receipt", "malformed_receipt", or "token_request" for a
  -- failure that happened before any case-status request went out.
  probe_label text not null,

  receipt text,
  http_status integer,
  is_four_xx boolean not null default false,
  error_kind text,
  message text,

  created_at timestamptz not null default now()
);

create index uscis_probe_runs_created_idx
  on uscis_probe_runs (created_at desc);

alter table uscis_probe_runs enable row level security;
-- Deliberately no policies: only the service_role key (used exclusively by
-- the uscis-probe-4xx Edge Function) can read or write this table. Same
-- pattern as poll_runs (0009).

-- Every hour, weekdays only, inside the sandbox's documented open hours
-- (7:00 AM - 8:00 PM ET). The sandbox returns 503 for every request —
-- valid, malformed, anything — outside those hours (verified 2026-09-22),
-- so running this outside the window would only ever collect 503s, not the
-- 4xx responses it exists to generate.
--
-- 11-23 UTC = 7:00 AM - 8:00 PM EDT. NOTE: this drifts by an hour across
-- the EDT/EST boundary (~early November / mid-March); if this job is still
-- running when clocks change, shift the range accordingly.
--
-- Same Vault cron_secret header pattern and explicit 60s pg_net timeout as
-- every other cron job here (0006/0008/0013) — the 5s default caused a real
-- outage, see docs/HANDOFF.md.
select cron.schedule(
  'uscis-probe-4xx',
  '0 11-23 * * 1-5',
  $$
  select net.http_post(
    url := 'https://ltpvagdbprwzqtasurez.supabase.co/functions/v1/uscis-probe-4xx',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'cron_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
