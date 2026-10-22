-- profiles.legal_accepted_at: when this account last actively agreed to
-- the current Terms of Service / Privacy Policy.
--
-- Why this exists: USCIS's app-review requirements for apps using their API
-- require ACTIVE consent to policy changes — "kept using the app" doesn't
-- count. Detecting "has this user agreed to the CURRENT version" needs a
-- real persisted timestamp to compare against
-- packages/shared/src/legal.ts's LEGAL_LAST_UPDATED; nothing recorded this
-- before now, even though the signup screen already has a consent
-- checkbox (apps/mobile/app/sign-in.tsx) — that checkbox gated the submit
-- button client-side but never wrote anything to the database. This closes
-- that gap at the same time it adds reconsent tracking.
--
-- Nullable, then backfilled: a null here (after the backfill below, this
-- should mean "created before we started tracking this at all" — in
-- practice won't happen going forward) is treated by the app as "needs to
-- reconsent," the same as an explicitly-stale timestamp.
alter table profiles add column legal_accepted_at timestamptz;

-- Existing accounts never explicitly recorded a consent timestamp. Using
-- their account creation date as the honest proxy for "whatever version of
-- the policy existed when they signed up" — which is exactly the real
-- history. Since this migration ships alongside a genuine content change to
-- the policy (2026-10-02), every existing account's created_at predates
-- that change, so this correctly means the one current account is prompted
-- to reconsent on next open, which is the intended behavior, not a bug.
update profiles set legal_accepted_at = created_at where legal_accepted_at is null;

-- handle_new_user() previously copied id, email, and full_name
-- (0018_profiles_full_name.sql). Widened so a new signup's consent is
-- recorded at the moment of account creation — the signup screen's
-- checkbox is what already gates this, so this is recording a decision
-- that was already made, not introducing a new one.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, legal_accepted_at)
  values (
    new.id,
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    now()
  );
  return new;
end;
$$;
