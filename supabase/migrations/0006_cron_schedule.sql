-- Schedules check-cases to run every 15 minutes.
--
-- The cron job authenticates to the Edge Function with a shared secret, read
-- at call time from Vault (`select decrypted_secret from
-- vault.decrypted_secrets where name = 'cron_secret'`) rather than embedded
-- as a literal here — this migration is committed to git, so the secret
-- itself must never appear in this file. It's provisioned into Vault
-- out-of-band (see docs/PLAN.md deploy notes), matching the same random
-- value set as the Edge Function's CRON_SECRET env var via
-- `supabase secrets set`. If the vault secret is ever missing, the job body
-- below fails closed (net.http_post gets a null header value) rather than
-- silently calling the function unauthenticated.
--
-- 15 minutes, not the 6h default check_interval_seconds: this cadence is how
-- often we LOOK for due cases, not how often each case is actually checked —
-- claim_due_cases only returns cases whose own next_check_at has arrived. It
-- also determines how quickly a retryable failure's 15-minute reschedule
-- (see check-cases/index.ts recordError) actually gets picked back up.
--
-- The project ref is not secret (it's part of the project's public URL), so
-- it's fine as a literal here.
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
    body := jsonb_build_object('batch_size', 20)
  );
  $$
);
