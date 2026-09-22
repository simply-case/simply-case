-- EOIR (immigration court) user-assisted refresh — same pattern as CEAC
-- (migration 0014): no API, protected by a captcha (hCaptcha here, not yet
-- solved automatically — see docs/HANDOFF.md §5), so the mobile app loads
-- the real ACIS page in a WebView, the user submits it themselves, and the
-- app reads whatever the page says back and calls record_manual_status()
-- below. Unlike CEAC, EOIR results aren't a short status word (they're a
-- free-text "next hearing" description), so the mobile screen collects
-- free text from the user rather than offering preset buttons — the RPC
-- itself doesn't care, p_status_text is just text either way.
--
-- record_ceac_status() was CEAC-only (`v_provider <> 'ceac'` raised for
-- anything else). Renamed to record_manual_status() and widened to accept
-- 'eoir' too, rather than duplicating the whole function for a second
-- provider — the logic (ownership check, hash/change detection, event
-- insert, notification enqueue) is identical regardless of which provider
-- the case is. Existing callers (apps/mobile's ceac-refresh screen) are
-- updated to call the new name in the same commit as this migration.

alter table case_status_events drop constraint case_status_events_source_check;
alter table case_status_events add constraint case_status_events_source_check
  check (source in ('api_history', 'poll', 'ceac_refresh', 'eoir_refresh'));

drop function if exists record_ceac_status(uuid, text, text);

create or replace function record_manual_status(
  p_user_case_id uuid,
  p_status_text text,
  p_status_detail text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_tracked_case_id uuid;
  v_provider case_provider;
  v_source text;
  v_old_hash text;
  v_new_hash text;
  v_changed boolean;
  v_new_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'record_manual_status requires an authenticated user';
  end if;

  if p_status_text is null or length(trim(p_status_text)) = 0 then
    raise exception 'p_status_text must not be empty';
  end if;
  if length(p_status_text) > 500 or length(coalesce(p_status_detail, '')) > 2000 then
    raise exception 'status text/detail too long';
  end if;

  -- Ownership check: p_user_case_id must belong to the calling user, and
  -- must actually be a ceac or eoir case — this RPC has no business
  -- touching a uscis row (that's the automated poller's job) even if
  -- someone guessed a valid user_cases id for one.
  select uc.tracked_case_id, tc.provider
  into v_tracked_case_id, v_provider
  from user_cases uc
  join tracked_cases tc on tc.id = uc.tracked_case_id
  where uc.id = p_user_case_id and uc.user_id = auth.uid();

  if v_tracked_case_id is null then
    raise exception 'user_case not found for this user';
  end if;
  if v_provider not in ('ceac', 'eoir') then
    raise exception 'record_manual_status only applies to ceac or eoir cases';
  end if;
  v_source := v_provider || '_refresh';

  select body_hash into v_old_hash from tracked_cases where id = v_tracked_case_id;
  v_new_hash := encode(digest(p_status_text || '|' || coalesce(p_status_detail, ''), 'sha256'), 'hex');
  v_changed := v_old_hash is distinct from v_new_hash;

  if v_changed then
    insert into case_status_events (tracked_case_id, status_text_en, status_detail_en, source, observed_at)
    values (v_tracked_case_id, p_status_text, p_status_detail, v_source, now())
    returning id into v_new_event_id;
  end if;

  update tracked_cases
  set status_text_en = p_status_text,
      status_detail_en = p_status_detail,
      body_hash = v_new_hash,
      last_checked_at = now(),
      last_changed_at = case when v_changed then now() else last_changed_at end,
      consecutive_errors = 0,
      last_error_code = null,
      last_error_message = null
  where id = v_tracked_case_id;

  -- Same enqueue pattern as check-cases' applyResult() and the old
  -- record_ceac_status() — email only, no push yet (migration 0010 /
  -- docs/ROADMAP.md Phase B2). Every current subscriber to this
  -- tracked_case gets notified, not just the caller.
  if v_changed then
    insert into notifications (user_id, user_case_id, case_status_event_id, channel)
    select uc.user_id, uc.id, v_new_event_id, 'email'
    from user_cases uc
    where uc.tracked_case_id = v_tracked_case_id
      and uc.archived_at is null
      and uc.notify_email
    on conflict (user_case_id, case_status_event_id, channel) do nothing;
  end if;
end;
$$;

revoke execute on function record_manual_status(uuid, text, text) from public, anon;
grant execute on function record_manual_status(uuid, text, text) to authenticated;
