-- Polling watchdog: emails the owner if USCIS polling stops working.
--
-- Motivation: the 2026-09-12/13 outage (see docs/HANDOFF.md "Polling
-- outage") went unnoticed for roughly 15 hours because nothing alerted on
-- it — pg_cron reported every tick 'succeeded' (that only means the HTTP
-- request was queued), and poll_runs required someone to actively look.
--
-- This has to run INSIDE Postgres (pg_cron + pg_net), not as an Edge
-- Function, because the outage's actual failure mode was Edge Functions
-- being unable to reach the database — a watchdog that itself depends on
-- database access from a function would have the same blind spot.

create table ops_alerts (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  sent_at timestamptz not null default now(),
  detail jsonb
);

alter table ops_alerts enable row level security;
-- No policies: nobody (not even authenticated users) can read/write this
-- via the API. Only security-definer functions and service_role touch it.

comment on table ops_alerts is
  'Internal ops alert log (e.g. polling-stale emails). No RLS policies — '
  'inaccessible via the API by design.';

-- Checks whether USCIS polling has gone stale AND whether any case has
-- been circuit-broken, emailing the owner at most once per 6 hours per
-- condition (they're tracked as separate ops_alerts kinds, so one firing
-- doesn't suppress the other).
--
-- Two conditions, not one — an earlier version only checked the first and
-- had a real blind spot found in review before this ever ran: a case that
-- hits 10 consecutive errors is excluded from claim_due_cases entirely
-- (0004_polling_infra.sql), so it stops being "due" and can never trip a
-- staleness check again — the watchdog would have stayed silent forever
-- on exactly the failure mode most worth knowing about.
--
-- "Stale" means: at least one still-active tracked_case (consecutive_errors
-- < 10) hasn't been checked within its own interval plus a 45-minute grace
-- period — generous enough to not fire on a single slow cron tick.
-- "Circuit-broken" means: at least one tracked_case has hit the 10-error
-- cutoff and stopped being polled at all.
--
-- Reads RESEND_API_KEY and an alert recipient address from Vault rather
-- than hardcoding either. If either secret is missing, this does nothing
-- silently (fails closed) rather than erroring the cron job — a missing
-- Vault secret shouldn't itself become a new incident.
create or replace function check_polling_health()
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_stale boolean;
  v_broken_count integer;
  v_resend_key text;
  v_alert_email text;
  v_last_run jsonb;
  v_kind text;
  v_subject text;
  v_body text;
begin
  select exists (
    select 1
    from tracked_cases
    where provider = 'uscis'
      and consecutive_errors < 10
      and last_checked_at < now() - make_interval(secs => check_interval_seconds) - interval '45 minutes'
  ) into v_stale;

  select count(*) into v_broken_count
  from tracked_cases
  where provider = 'uscis' and consecutive_errors >= 10;

  -- Pick whichever condition is both true AND not already alerted on
  -- within the last 6 hours. Circuit-broken takes priority when both are
  -- true, since it's the more actionable of the two (a specific case has
  -- fully stopped, vs. everything just running slow).
  if v_broken_count > 0 and not exists (
    select 1 from ops_alerts where kind = 'polling_circuit_broken' and sent_at > now() - interval '6 hours'
  ) then
    v_kind := 'polling_circuit_broken';
    v_subject := 'Simply Case: a case stopped being checked';
    v_body := v_broken_count || ' USCIS case(s) have hit 10 consecutive '
      || 'errors and are no longer being polled at all (see tracked_cases.'
      || 'consecutive_errors). ';
  elsif v_stale and not exists (
    select 1 from ops_alerts where kind = 'polling_stale' and sent_at > now() - interval '6 hours'
  ) then
    v_kind := 'polling_stale';
    v_subject := 'Simply Case: polling has stopped';
    v_body := 'USCIS case polling looks stale — no successful check within the expected interval. ';
  else
    return;
  end if;

  select decrypted_secret into v_resend_key
  from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select decrypted_secret into v_alert_email
  from vault.decrypted_secrets where name = 'alert_email' limit 1;

  if v_resend_key is null or v_alert_email is null then
    -- Not configured yet — see docs/HANDOFF.md for the one-time setup.
    return;
  end if;

  select jsonb_build_object(
    'started_at', started_at, 'finished_at', finished_at,
    'claimed', claimed, 'updated', updated, 'errored', errored,
    'crashed', crashed, 'crash_message', crash_message
  ) into v_last_run
  from poll_runs
  where provider = 'uscis'
  order by started_at desc
  limit 1;

  insert into ops_alerts (kind, detail)
  values (v_kind, jsonb_build_object('last_run', v_last_run, 'broken_count', v_broken_count));

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_resend_key
    ),
    body := jsonb_build_object(
      'from', 'onboarding@resend.dev',
      'to', v_alert_email,
      'subject', v_subject,
      'text', v_body || 'Last poll_runs row: ' || coalesce(v_last_run::text, '(none)')
        || E'\n\nCheck docs/HANDOFF.md "Polling outage" and supabase functions logs.'
    ),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function check_polling_health() from public, anon, authenticated;

select cron.schedule(
  'polling-watchdog',
  '*/30 * * * *',
  $$select check_polling_health();$$
);
