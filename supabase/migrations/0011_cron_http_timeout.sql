-- Re-schedules both cron jobs with an explicit pg_net timeout.
--
-- 0006 and 0008 called net.http_post without timeout_milliseconds, so pg_net
-- used its 5000 ms default. Found live on 2026-09-12: roughly two thirds of
-- all cron calls to BOTH functions were ending in "Timeout of 5000 ms
-- reached" (net._http_response), including send-notifications calls that
-- had no work to do. pg_cron still reported every run 'succeeded', because
-- that only means the request was queued.
--
-- The damage showed up in poll_runs: runs that claimed cases but never
-- wrote finished_at, runs missing entirely, and tracked_cases whose
-- next_check_at kept advancing while last_checked_at stood still. In other
-- words, once the caller hangs up at 5 s, a check-cases batch that needs
-- longer (cold start + USCIS OAuth + a paced sleep between cases + several
-- DB writes per case) is cut off after claiming its cases but before
-- checking them.
--
-- 60 s is far above a healthy run for current batch sizes and well under
-- the Edge Function wall-clock limit. cron.schedule() with an existing job
-- name replaces that job in place (pg_cron >= 1.5), so this is safe to
-- re-run and leaves no duplicate jobs.
select cron.schedule(
  'check-cases-uscis',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://ltpvagdbprwzqtasurez.supabase.co/functions/v1/check-cases',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'cron_secret'
        limit 1
      )
    ),
    body := jsonb_build_object('batch_size', 20),
    timeout_milliseconds := 60000
  );
  $$
);

select cron.schedule(
  'send-notifications-email',
  '*/5 * * * *',
  $$
  select net.http_post(
    url := 'https://ltpvagdbprwzqtasurez.supabase.co/functions/v1/send-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'cron_secret'
        limit 1
      )
    ),
    body := jsonb_build_object('batch_size', 50),
    timeout_milliseconds := 60000
  );
  $$
);
