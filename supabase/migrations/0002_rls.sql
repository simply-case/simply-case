-- Row Level Security.
--
-- Design note: tracked_cases and case_status_events get NO select policy for
-- ordinary users. If they did, an authenticated user could probe arbitrary
-- receipt numbers by ID/case_key and learn whether someone else is tracking
-- them — an enumeration leak on what is effectively PII. Instead they read
-- through my_case_details, a security-definer view scoped to their own
-- user_cases rows.

alter table profiles enable row level security;
alter table tracked_cases enable row level security;
alter table case_status_events enable row level security;
alter table user_cases enable row level security;
alter table devices enable row level security;
alter table notifications enable row level security;

-- profiles: a user reads/updates only their own row. No insert policy —
-- rows are created by the handle_new_user trigger (0003), not by clients.
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- tracked_cases / case_status_events: intentionally no policies for
-- authenticated/anon roles. service_role (used only by Edge Functions)
-- bypasses RLS by default and needs none either.

-- user_cases: a user manages only their own subscriptions.
create policy "user_cases_select_own" on user_cases
  for select using (auth.uid() = user_id);

create policy "user_cases_insert_own" on user_cases
  for insert with check (auth.uid() = user_id);

create policy "user_cases_update_own" on user_cases
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "user_cases_delete_own" on user_cases
  for delete using (auth.uid() = user_id);

-- devices: a user manages only their own registered devices.
create policy "devices_select_own" on devices
  for select using (auth.uid() = user_id);

create policy "devices_insert_own" on devices
  for insert with check (auth.uid() = user_id);

create policy "devices_update_own" on devices
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "devices_delete_own" on devices
  for delete using (auth.uid() = user_id);

-- notifications: read-only for the owning user; written only by the
-- send-notifications Edge Function via service_role.
create policy "notifications_select_own" on notifications
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- my_case_details: the only way an ordinary user reads tracked_case /
-- case_status_event data — always joined through their own user_cases row,
-- so they can never see a case they haven't subscribed to, and can never
-- enumerate other users' receipt numbers.
-- ---------------------------------------------------------------------------
create view my_case_details
  with (security_invoker = false) -- security-definer: runs as the view owner,
                                   -- but the where clause still binds to auth.uid(),
                                   -- so it exposes nothing beyond the caller's own rows.
as
select
  uc.id as user_case_id,
  uc.nickname,
  uc.notify_push,
  uc.notify_email,
  uc.archived_at,
  uc.created_at as subscribed_at,
  tc.id as tracked_case_id,
  tc.provider,
  tc.case_key,
  tc.form_type,
  tc.submitted_at,
  tc.status_text_en,
  tc.status_detail_en,
  tc.status_text_es,
  tc.status_detail_es,
  tc.last_checked_at,
  tc.last_changed_at
from user_cases uc
join tracked_cases tc on tc.id = uc.tracked_case_id
where uc.user_id = auth.uid();

grant select on my_case_details to authenticated;

-- Same pattern for the event timeline of a case the caller is subscribed to.
create view my_case_events
  with (security_invoker = false)
as
select
  cse.id as event_id,
  cse.tracked_case_id,
  cse.status_text_en,
  cse.status_detail_en,
  cse.status_text_es,
  cse.status_detail_es,
  cse.source,
  cse.observed_at
from case_status_events cse
where exists (
  select 1 from user_cases uc
  where uc.tracked_case_id = cse.tracked_case_id
    and uc.user_id = auth.uid()
);

grant select on my_case_events to authenticated;
