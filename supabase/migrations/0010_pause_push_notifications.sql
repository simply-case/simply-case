-- Pauses the push notification channel until a consumer exists.
--
-- user_cases.notify_push defaults true and check-cases has been enqueueing
-- channel='push' notification rows since Phase 6, but send-notifications
-- only ever drains channel='email' (it filters .eq("channel", "email")).
-- Every status change since then left a permanently-pending push row. Left
-- alone, all of them would fire at once the day push notifications ship,
-- which is not what a fresh feature launch should look like.
--
-- This migration (a) marks every existing pending push row as skipped, with
-- an error note explaining why, rather than deleting them — the
-- notifications table doubles as a send log, and silently deleting rows
-- would erase real history; (b) widens the status check constraint to allow
-- 'skipped' as a distinct outcome from 'failed' (a failed send is worth
-- retrying; a skipped one is not — there's nothing to retry it into yet).
--
-- The accompanying code change (check-cases/index.ts) stops enqueueing new
-- push rows entirely until Phase (push notifications) ships a consumer, so
-- this table won't silently refill in the meantime.
alter table notifications drop constraint notifications_status_check;
alter table notifications add constraint notifications_status_check
  check (status in ('pending', 'sent', 'failed', 'skipped'));

update notifications
set status = 'skipped',
    error = 'push channel has no consumer yet (send-notifications only drains email) — see docs/ROADMAP.md Phase B2'
where channel = 'push' and status = 'pending';
