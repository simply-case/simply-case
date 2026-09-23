-- Safety net: alert when CEAC's or EOIR's page changes underneath us.
--
-- The problem this solves (docs/HANDOFF.md §5, open since the CEAC
-- autofill was built): both lookups depend on element ids and selectors on
-- government pages we don't control — #Visa_Case_Number, .react-code-input,
-- #ctl00_ContentPlaceHolder1_lblError and friends. If any of those is
-- renamed, autofill quietly stops filling and the app degrades to "nothing
-- happened", which is EXACTLY the failure mode that hid the CEAC
-- partial-postback bug for weeks. Nobody would find out until a user
-- complained, and users of an immigration app mostly don't complain, they
-- just assume it's their fault.
--
-- Deliberately mirrors check_polling_health() (0012_polling_watchdog.sql):
-- same ops_alerts table, same Vault-sourced Resend credentials, same
-- fail-closed behaviour when the secrets aren't configured, same
-- once-per-window de-duplication. One alerting mechanism to understand,
-- not two.
--
-- Unlike the polling watchdog, this one is REPORTED BY THE CLIENT: only a
-- real device can see these pages at all (ceac.state.gov returns 403 to
-- any server-side request — re-confirmed 2026-09-22). That means it's
-- callable by authenticated users, so it's written to be safe to call
-- often and safe to call maliciously:
--   * It takes no free-form text that gets emailed. The step name is
--     matched against a fixed allowlist and anything else is ignored, so
--     this can't be used to send arbitrary content to the owner's inbox.
--   * De-duplication happens BEFORE the email, per provider, so a user
--     looping the endpoint produces at most one email per 6 hours.
--   * It returns void and reveals nothing, so it can't be used to probe
--     whether alerts are configured.

create or replace function report_lookup_breakage(
  p_provider case_provider,
  p_step text
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_kind text;
  v_resend_key text;
  v_alert_email text;
  v_recent_count int;
begin
  if auth.uid() is null then
    raise exception 'report_lookup_breakage requires an authenticated user';
  end if;

  -- Only the providers whose lookups depend on scraping someone else's
  -- page. A uscis breakage would show up in poll_runs instead, and is
  -- already covered by check_polling_health().
  if p_provider not in ('ceac', 'eoir') then
    return;
  end if;

  -- Allowlist, not free text: these are the exact step names the autofill
  -- scripts emit when an element they expect isn't on the page (see
  -- buildAutofillScript in both refresh screens). Anything else is
  -- silently ignored rather than raising — a client on an older build
  -- emitting a step name we've since renamed shouldn't error, it just
  -- shouldn't alert either.
  if p_step not in (
    'number_not_found', 'type_select_not_found', 'passport_not_found',
    'surname_not_found', 'location_not_found', 'postback_hook_unavailable',
    'anumber_not_found', 'nationality_control_not_found',
    'nationality_input_not_found', 'nationality_options_never_appeared',
    'nationality_no_exact_match'
  ) then
    return;
  end if;

  v_kind := 'lookup_breakage_' || p_provider;

  select count(*) into v_recent_count
  from ops_alerts
  where kind = v_kind and sent_at > now() - interval '6 hours';

  -- Always record the observation (cheap, and the pattern over time is
  -- the useful part — one report is noise, forty in an hour is a broken
  -- page), but only email on the first one in the window.
  insert into ops_alerts (kind, detail)
  values (
    v_kind,
    jsonb_build_object('provider', p_provider, 'step', p_step, 'emailed', v_recent_count = 0)
  );

  if v_recent_count > 0 then
    return;
  end if;

  select decrypted_secret into v_resend_key
  from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select decrypted_secret into v_alert_email
  from vault.decrypted_secrets where name = 'alert_email' limit 1;

  if v_resend_key is null or v_alert_email is null then
    -- Not configured yet — see docs/HANDOFF.md for the one-time setup.
    -- Fails closed, same as the polling watchdog: a missing Vault secret
    -- must not become a new incident of its own.
    return;
  end if;

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_resend_key
    ),
    body := jsonb_build_object(
      'from', 'onboarding@resend.dev',
      'to', v_alert_email,
      'subject', 'Simply Case: ' || upper(p_provider::text) || ' lookup may be broken',
      'text',
        'A device reported that an element the ' || upper(p_provider::text)
        || E' lookup depends on was missing from the page.\n\n'
        || 'Step: ' || p_step || E'\n\n'
        || E'This usually means the government site changed its markup and autofill has silently stopped working.\n'
        || E'Check the selectors in apps/mobile/app/(app)/cases/'
        || case when p_provider = 'ceac' then 'ceac-refresh' else 'eoir-refresh' end
        || E'/[id].tsx against the live page.\n\n'
        || E'Further reports are logged to ops_alerts but will not email again for 6 hours.'
    ),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke execute on function report_lookup_breakage(case_provider, text) from public, anon;
grant execute on function report_lookup_breakage(case_provider, text) to authenticated;
