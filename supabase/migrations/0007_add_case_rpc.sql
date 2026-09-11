-- add_case: the only way an authenticated client creates or subscribes to a
-- tracked_case. Runs security definer (bypassing the tracked_cases RLS that
-- deliberately has no policy for authenticated/anon) but the user_id on the
-- resulting user_cases row is always auth.uid() — never client-supplied — so
-- this can't be used to subscribe another user to a case.
--
-- Upserts tracked_cases by (provider, case_key): if 500 users add the same
-- receipt number, this reuses the one shared row rather than creating 500.
-- A fresh tracked_case is left with its default next_check_at = now(), so
-- the next check-cases cron tick (within 15 min) picks it up — there's no
-- separate "fetch now" path; the poller is the only thing that calls USCIS.
create or replace function add_case(
  p_provider case_provider,
  p_case_key text,
  p_nickname text default null
)
returns user_cases
language plpgsql
security definer set search_path = public
as $$
declare
  v_tracked_case_id uuid;
  v_user_case user_cases;
begin
  if auth.uid() is null then
    raise exception 'add_case requires an authenticated user';
  end if;

  if p_case_key is null or length(trim(p_case_key)) = 0 then
    raise exception 'case_key must not be empty';
  end if;

  insert into tracked_cases (provider, case_key)
  values (p_provider, trim(upper(p_case_key)))
  on conflict (provider, case_key) do update
    set updated_at = tracked_cases.updated_at -- no-op write so RETURNING still fires on conflict
  returning id into v_tracked_case_id;

  insert into user_cases (user_id, tracked_case_id, nickname)
  values (auth.uid(), v_tracked_case_id, nullif(trim(p_nickname), ''))
  on conflict (user_id, tracked_case_id) do update
    set archived_at = null -- re-adding a previously archived case un-archives it
  returning * into v_user_case;

  return v_user_case;
end;
$$;

revoke execute on function add_case(case_provider, text, text) from public, anon;
grant execute on function add_case(case_provider, text, text) to authenticated;
