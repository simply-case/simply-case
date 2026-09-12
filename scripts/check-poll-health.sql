-- Run in the Supabase SQL editor (or `supabase db execute` / psql against
-- the linked project). Read-only. Answers the two questions Phase A of
-- docs/ROADMAP.md needs before counting USCIS sandbox-traffic days:
--
--   1. Is the scheduler actually firing, and succeeding (not just existing)?
--   2. Is polling producing real USCIS activity, or mostly 503s from a
--      closed sandbox that our error handling (correctly) doesn't flag?
--
-- A cron job that fires and then fails auth looks identical to a healthy
-- one if you only check that job_run_details rows exist — status is what
-- actually matters.

-- 1. Did pg_cron invoke check-cases, and did each invocation succeed at the
--    HTTP layer? (This only proves the request was made — see query 3 for
--    whether USCIS actually answered with data.)
select
  status,
  count(*) as invocations,
  min(start_time) as first_seen,
  max(start_time) as last_seen
from cron.job_run_details
where jobname = 'check-cases-uscis'
group by status
order by 2 desc;

-- 2. Since poll_runs exists (migration 0009), this is the direct answer:
--    per-run claimed/updated/errored counts and any error_kinds summary.
--    Empty result means either no runs yet, or the migration hasn't been
--    applied — run `supabase db push` (after `db diff` review) first.
select
  started_at,
  finished_at,
  claimed,
  updated,
  changed,
  errored,
  error_kinds,
  crashed
from poll_runs
where provider = 'uscis'
order by started_at desc
limit 200;

-- 3. Daily rollup — the shape to actually eyeball for "5 consecutive days".
--    A day with claimed > 0 but updated = 0 and errored = claimed is a day
--    that produced NO traffic USCIS would credit, most likely because every
--    call landed on a closed sandbox (Mon-Fri 7AM-8PM EST) and got a 503,
--    which check-cases deliberately excludes from consecutive_errors.
select
  date_trunc('day', started_at) as day,
  count(*) as runs,
  sum(claimed) as claimed,
  sum(updated) as updated,
  sum(errored) as errored
from poll_runs
where provider = 'uscis'
group by 1
order by 1;

-- 4. Before poll_runs existed, the only proxy for "did anything actually
--    happen" was this — still useful as a cross-check.
select
  date_trunc('day', last_checked_at) as day,
  count(*) as cases_touched
from tracked_cases
where provider = 'uscis'
group by 1
order by 1;
