-- Atomic error increment for the polling pipeline.
--
-- Done as a function rather than a plain client-side `update ... set
-- consecutive_errors = consecutive_errors + 1` so the increment can never
-- race with a concurrent successful check resetting the same counter to 0 —
-- whichever write actually lands last wins, but the increment itself is
-- computed from the current row value inside one statement, not from a value
-- read into the Edge Function earlier in the request.
create or replace function increment_case_errors(
  p_tracked_case_id uuid,
  p_error_code text,
  p_error_message text
)
returns void
language sql
security definer set search_path = public
as $$
  update tracked_cases
  set consecutive_errors = consecutive_errors + 1,
      last_error_code = p_error_code,
      last_error_message = p_error_message,
      last_checked_at = now()
  where id = p_tracked_case_id;
$$;

revoke execute on function increment_case_errors(uuid, text, text) from public, authenticated, anon;
grant execute on function increment_case_errors(uuid, text, text) to service_role;
