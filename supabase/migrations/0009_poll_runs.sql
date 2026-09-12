-- poll_runs: one row per check-cases invocation, written by the function
-- itself (start row on entry, filled in on exit).
--
-- Before this migration, "is polling healthy?" could only be answered by
-- forensics across cron.job_run_details (did the scheduler fire?) and
-- tracked_cases.last_checked_at (did anything get updated?) — neither says
-- how many cases were claimed, how many errored, or how long a run took.
-- This is also the evidence a production-access application would point to.
--
-- No direct select policy for authenticated/anon, same pattern as
-- tracked_cases/case_status_events (0002_rls.sql) — this is operational
-- data about our own polling, not something a client needs, and the
-- service_role key already bypasses RLS entirely for the Edge Function
-- that writes it.
create table poll_runs (
  id uuid primary key default gen_random_uuid(),
  provider case_provider not null,

  started_at timestamptz not null default now(),
  finished_at timestamptz,

  claimed integer,
  updated integer,
  changed integer,
  errored integer,

  -- Small structured summary, not the full per-case error array — this is
  -- meant to be skimmed for "is anything wrong", not a full error log.
  -- {"kind": count} e.g. {"service_unavailable": 12, "rate_limited": 1}.
  error_kinds jsonb,

  -- Distinguishes a run that crashed before finishing (finished_at stays
  -- null) from one that legitimately claimed and processed zero cases.
  crashed boolean not null default false,
  crash_message text,

  created_at timestamptz not null default now()
);

create index poll_runs_provider_started_idx
  on poll_runs (provider, started_at desc);

alter table poll_runs enable row level security;
-- Deliberately no policies: only the service_role key (used exclusively by
-- the check-cases Edge Function) can read or write this table.
