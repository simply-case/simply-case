-- Schedules send-notifications every 5 minutes.
--
-- Reuses the same Vault secret ('cron_secret') that check-cases' cron job
-- reads (0006_cron_schedule.sql) — it's a shared auth boundary secret, not
-- case-specific, and both functions already read it from the same
-- CRON_SECRET env var. No new secret to provision.
--
-- 5 minutes, not 15 like check-cases: check-cases only finds new work every
-- 15 min, but once a notification is queued, delivery should follow quickly
-- rather than wait for the next quarter-hour tick.
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
    body := jsonb_build_object('batch_size', 50)
  );
  $$
);
