-- mycase pro — core schema
-- Design note: tracked_cases / case_status_events are keyed by the real-world
-- case (provider + case_key), shared across every user who tracks it. user_cases
-- is the per-user subscription. This lets N users tracking the same receipt
-- number cost one poll, not N. See docs/PLAN.md for the full rationale.

create extension if not exists "pgcrypto";

create type case_provider as enum ('uscis', 'eoir', 'ceac');

-- ---------------------------------------------------------------------------
-- profiles: 1:1 with auth.users, created automatically on signup (see 0003).
-- ---------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  preferred_language text not null default 'en' check (preferred_language in ('en', 'es')),
  timezone text not null default 'UTC',
  quiet_hours_start smallint check (quiet_hours_start between 0 and 23),
  quiet_hours_end smallint check (quiet_hours_end between 0 and 23),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- tracked_cases: one row per real-world case. Never exposed directly to
-- clients — see the security-definer view in 0002_rls.sql.
-- ---------------------------------------------------------------------------
create table tracked_cases (
  id uuid primary key default gen_random_uuid(),
  provider case_provider not null,
  case_key text not null,                 -- normalized receipt / A-number / case number

  form_type text,
  submitted_at timestamptz,

  status_text_en text,
  status_detail_en text,
  status_text_es text,
  status_detail_es text,

  body_hash text,                          -- drives change detection (esp. for IOE-prefix
                                            -- receipts, which carry no modifiedDate at all)

  -- polling scheduler state
  next_check_at timestamptz not null default now(),
  check_interval_seconds integer not null default 21600, -- 6h default cadence
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  consecutive_errors integer not null default 0,
  last_error_code text,
  last_error_message text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (provider, case_key)
);

create index tracked_cases_due_idx
  on tracked_cases (next_check_at)
  where consecutive_errors < 10; -- past that, a case is dead-lettered; see claim_due_cases

-- ---------------------------------------------------------------------------
-- case_status_events: append-only timeline for a tracked_case. Populated both
-- from USCIS's own hist_case_status (source='api_history', backfilled once)
-- and from status changes we detect ourselves while polling (source='poll').
-- ---------------------------------------------------------------------------
create table case_status_events (
  id uuid primary key default gen_random_uuid(),
  tracked_case_id uuid not null references tracked_cases (id) on delete cascade,

  status_text_en text not null,
  status_detail_en text,
  status_text_es text,
  status_detail_es text,

  source text not null default 'poll' check (source in ('api_history', 'poll')),
  observed_at timestamptz not null, -- event date reported by the provider, not our fetch time
  created_at timestamptz not null default now()
);

create index case_status_events_case_idx
  on case_status_events (tracked_case_id, observed_at desc);

-- ---------------------------------------------------------------------------
-- user_cases: a user's subscription to a tracked_case.
-- ---------------------------------------------------------------------------
create table user_cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tracked_case_id uuid not null references tracked_cases (id) on delete cascade,

  nickname text,
  notify_push boolean not null default true,
  notify_email boolean not null default true,
  archived_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, tracked_case_id)
);

create index user_cases_user_idx on user_cases (user_id) where archived_at is null;
create index user_cases_tracked_case_idx on user_cases (tracked_case_id);

-- ---------------------------------------------------------------------------
-- devices: Expo push tokens.
-- ---------------------------------------------------------------------------
create table devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index devices_user_idx on devices (user_id);

-- ---------------------------------------------------------------------------
-- notifications: send log. Also the dedupe guard — one row per
-- (user_case, event, channel), so a status change can't double-fire.
-- ---------------------------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  user_case_id uuid not null references user_cases (id) on delete cascade,
  case_status_event_id uuid not null references case_status_events (id) on delete cascade,
  channel text not null check (channel in ('push', 'email')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),

  unique (user_case_id, case_status_event_id, channel)
);

create index notifications_pending_idx
  on notifications (created_at)
  where status = 'pending';
