-- Triggers and helper functions.

-- updated_at maintenance -----------------------------------------------------
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger tracked_cases_set_updated_at
  before update on tracked_cases
  for each row execute function set_updated_at();

create trigger user_cases_set_updated_at
  before update on user_cases
  for each row execute function set_updated_at();

-- auto-create profile on signup ----------------------------------------------
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- polling queue ---------------------------------------------------------------
-- Claims up to batch_size due cases and pushes them past their next check
-- window immediately, so a second concurrent poller invocation can't also
-- claim them before the first one finishes. FOR UPDATE SKIP LOCKED makes this
-- safe under concurrency without an explicit application-level lock.
--
-- Cases with 10+ consecutive errors are excluded (see tracked_cases_due_idx) —
-- they're effectively dead-lettered rather than retried forever.
create or replace function claim_due_cases(batch_size integer default 50)
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
    where next_check_at <= now()
      and consecutive_errors < 10
    order by next_check_at
    limit batch_size
    for update skip locked
  )
  returning *;
end;
$$;

-- service_role only — this is called from the check-cases Edge Function,
-- never from a client.
revoke execute on function claim_due_cases(integer) from public, authenticated, anon;
grant execute on function claim_due_cases(integer) to service_role;
