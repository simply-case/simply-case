-- news_items: real news content for the News tab, replacing the
-- placeholder sample cards (ROADMAP Phase F4).
--
-- Populated by a scheduled `fetch-news` Edge Function pulling two
-- independent sources — the Federal Register API and the USCIS newsroom
-- listing — into one table so the client never fetches an external feed
-- directly (a dead upstream feed must not break the app, and there's no
-- way to hide junk from a client-side fetch). See
-- supabase/functions/_shared/news.ts for the parsers.

create table news_items (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('federal_register', 'uscis_newsroom')),

  -- Federal Register's document_number, or the USCIS newsroom article's
  -- URL path — whatever each source treats as its own stable identifier.
  -- Paired with `source` (not globally unique alone) since the two
  -- sources' ID spaces are unrelated.
  external_id text not null,

  title text not null,
  summary text,
  url text not null,
  published_at timestamptz not null,
  fetched_at timestamptz not null default now(),

  unique (source, external_id)
);

create index news_items_published_at_idx on news_items (published_at desc);

alter table news_items enable row level security;

-- Read-only for signed-in users; no write policy at all — only the
-- fetch-news function (via its own service-role-equivalent key) writes
-- here, same pattern as poll_runs/tracked_cases being service-role-only.
create policy "authenticated users can read news_items"
  on news_items for select
  to authenticated
  using (true);

-- Every 3 hours: news doesn't need 15-minute freshness, and this keeps
-- both external sources from being hit constantly. Same Vault cron_secret
-- header pattern as 0006/0008, and — per the 2026-09-12/13 outage lesson —
-- an explicit 60s pg_net timeout from the start rather than the 5s default.
select cron.schedule(
  'fetch-news',
  '0 */3 * * *',
  $$
  select net.http_post(
    url := 'https://ltpvagdbprwzqtasurez.supabase.co/functions/v1/fetch-news',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'cron_secret'
        limit 1
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
