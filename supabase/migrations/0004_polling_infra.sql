-- Infrastructure for the polling pipeline: pg_cron to trigger checks on a
-- schedule, pg_net to call the Edge Function over HTTP, Vault to hold the
-- shared secret the cron job authenticates with (never committed in plaintext
-- — see docs/PLAN.md "polling pipeline" and the check-cases Edge Function).

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault cascade;

-- Replaces the 0003 version of claim_due_cases with a provider-scoped one.
-- Without this, a future EOIR/CEAC case (Phase 7) claimed by a batch call that
-- only knows how to fetch USCIS would have its next_check_at pushed forward
-- as if it had been checked, then sit unprocessed until the next window —
-- silently starved rather than erroring, which is the kind of bug that's
-- invisible until someone notices their case never updates.
drop function if exists claim_due_cases(integer);

create or replace function claim_due_cases(
  p_provider case_provider,
  batch_size integer default 50
)
returns setof tracked_cases
language plpgsql
security definer set search_path = public
as $$
begin
  return query
  update tracked_cases
  set next_check_at = now() + make_interval(secs => check_interval_seconds)
  where id in (
    select id from tracked_cases
    where provider = p_provider
      and next_check_at <= now()
      and consecutive_errors < 10
    order by next_check_at
    limit batch_size
    for update skip locked
  )
  returning *;
end;
$$;

revoke execute on function claim_due_cases(case_provider, integer) from public, authenticated, anon;
grant execute on function claim_due_cases(case_provider, integer) to service_role;

-- Lets a retryable failure (503/429/network — see UscisApiError.retryable in
-- supabase/functions/_shared/uscis.ts) retry soon, rather than waiting out the
-- full check_interval_seconds that claim_due_cases already advanced it by.
-- Deliberately does NOT touch consecutive_errors — that's the caller's job,
-- based on whether the specific failure counts as a real case error.
create or replace function reschedule_case_soon(
  p_tracked_case_id uuid,
  p_delay_seconds integer default 900
)
returns void
language sql
security definer set search_path = public
as $$
  update tracked_cases
  set next_check_at = now() + make_interval(secs => p_delay_seconds)
  where id = p_tracked_case_id;
$$;

revoke execute on function reschedule_case_soon(uuid, integer) from public, authenticated, anon;
grant execute on function reschedule_case_soon(uuid, integer) to service_role;
