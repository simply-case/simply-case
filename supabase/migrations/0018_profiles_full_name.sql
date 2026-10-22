-- profiles.full_name: the name now collected at signup.
--
-- The signup form (apps/mobile/app/sign-in.tsx) asks for a name, and
-- Supabase stores it on auth.users.raw_user_meta_data. That's enough for
-- the app to read back from the session, but it is NOT reachable from
-- SQL-side code that selects from public tables — notification emails
-- being the case that actually matters, since a greeting has to come from
-- somewhere send-notifications can select.
--
-- Nullable on purpose. Every account created before this migration has no
-- name and there is no honest value to backfill one with, so null means
-- "we don't know" — callers should fall back to a neutral greeting rather
-- than invent something.
alter table profiles add column full_name text;

-- handle_new_user() previously copied only id + email (0003_functions.sql).
-- Widened so the name travels with the account at creation time instead of
-- needing a second write from the client (which RLS would have to allow,
-- and which could fail independently of signup succeeding).
--
-- nullif(trim(...), '') so a blank or whitespace-only name lands as null
-- rather than an empty string that every reader then has to special-case.
-- ->> already yields null when the key is absent, which is the path every
-- pre-existing client takes.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  );
  return new;
end;
$$;
