-- CEAC/NVC user-assisted refresh (ROADMAP F5).
--
-- There is no CEAC API at any price and the status page is CAPTCHA-gated,
-- so this is deliberately NOT a background poller like check-cases. The
-- mobile app loads the real CEAC page in a WebView, the user solves the
-- CAPTCHA themselves, and the app reads the result off the page and calls
-- record_ceac_status() below — the only way a CEAC status ever changes in
-- this system. See docs/PLAN.md "CEAC: no API at any price" and
-- docs/HANDOFF.md "New scope" for the full reasoning (including why a
-- server-side scrape + CAPTCHA-solving service was rejected).
--
-- CEAC covers two genuinely different case shapes under one provider —
-- immigrant (NVC case number) and nonimmigrant (DS-160 Application ID) —
-- distinguished by an `IV:`/`NIV:` prefix baked into case_key by
-- normalizeCeacCaseKey() (packages/shared/src/providers.ts) rather than a
-- separate column, so nothing else in the schema (claim_due_cases, the
-- my_case_* views) needs to know CEAC is special-shaped.

create or replace function record_ceac_status(
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
  v_old_hash text;
  v_new_hash text;
  v_changed boolean;
  v_new_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'record_ceac_status requires an authenticated user';
  end if;

  if p_status_text is null or length(trim(p_status_text)) = 0 then
    raise exception 'p_status_text must not be empty';
  end if;
  if length(p_status_text) > 500 or length(coalesce(p_status_detail, '')) > 2000 then
    raise exception 'status text/detail too long';
  end if;

  -- Ownership check: p_user_case_id must belong to the calling user, and
  -- must actually be a ceac case — this RPC has no business touching a
  -- uscis/eoir row even if someone guessed a valid user_cases id for one.
  select uc.tracked_case_id, tc.provider
  into v_tracked_case_id, v_provider
  from user_cases uc
  join tracked_cases tc on tc.id = uc.tracked_case_id
  where uc.id = p_user_case_id and uc.user_id = auth.uid();

  if v_tracked_case_id is null then
    raise exception 'user_case not found for this user';
  end if;
  if v_provider <> 'ceac' then
    raise exception 'record_ceac_status only applies to ceac cases';
  end if;

  select body_hash into v_old_hash from tracked_cases where id = v_tracked_case_id;
  v_new_hash := encode(digest(p_status_text || '|' || coalesce(p_status_detail, ''), 'sha256'), 'hex');
  v_changed := v_old_hash is distinct from v_new_hash;

  if v_changed then
    insert into case_status_events (tracked_case_id, status_text_en, status_detail_en, source, observed_at)
    values (v_tracked_case_id, p_status_text, p_status_detail, 'ceac_refresh', now())
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

  -- Same enqueue pattern as check-cases' applyResult() — email only, no
  -- push yet (see migration 0010 / docs/ROADMAP.md Phase B2). Every current
  -- subscriber to this tracked_case gets notified, not just the caller —
  -- a shared CEAC case (e.g. two family members tracking the same NVC
  -- case) should tell both when it moves.
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

revoke execute on function record_ceac_status(uuid, text, text) from public, anon;
grant execute on function record_ceac_status(uuid, text, text) to authenticated;
