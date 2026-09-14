/**
 * fetch-news — pulls real news into news_items (ROADMAP Phase F4).
 *
 * Triggered every 3 hours by pg_cron (migration 0013), same shared-secret
 * pattern as check-cases/send-notifications. Two independent sources —
 * Federal Register API and the USCIS newsroom listing — each wrapped in
 * its own try/catch, so one source failing (a Cloudflare block, a markup
 * change, a network blip) never stops the other from updating. Every
 * fetch failure is returned in the JSON summary and logged with
 * console.error, so a broken source is visible rather than silently stale
 * — the same "alert, don't degrade quietly" discipline as the Visa
 * Bulletin's raw-HTML-plus-parsed-rows approach (docs/PLAN.md).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  federalRegisterStateUrl,
  federalRegisterUrl,
  type NewsItem,
  parseFederalRegisterResponse,
  parseUscisNewsroomHtml,
} from "../_shared/news.ts";

const USCIS_NEWSROOM_URL = "https://www.uscis.gov/newsroom/all-news";
const USER_AGENT = "SimplyCase/1.0 (+https://simply-case-web.vercel.app)";

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

interface SourceResult {
  source: string;
  fetched: number;
  inserted: number;
  error: string | null;
}

async function fetchFederalRegister(): Promise<NewsItem[]> {
  // Two separate requests — USCIS/EOIR agencies, and a State Department
  // term search for "visa" — combined into one item list. See
  // docs/PHASE_F_PLAN.md F4 for why these two queries specifically.
  const [agencyRes, stateRes] = await Promise.all([
    fetch(federalRegisterUrl(20), { headers: { "User-Agent": USER_AGENT } }),
    fetch(federalRegisterStateUrl(10), { headers: { "User-Agent": USER_AGENT } }),
  ]);
  if (!agencyRes.ok) throw new Error(`Federal Register agency query: HTTP ${agencyRes.status}`);
  if (!stateRes.ok) throw new Error(`Federal Register state-department query: HTTP ${stateRes.status}`);

  const agencyItems = parseFederalRegisterResponse(await agencyRes.json());
  const stateItems = parseFederalRegisterResponse(await stateRes.json());

  // De-dupe by externalId in case a document matches both queries.
  const byId = new Map<string, NewsItem>();
  for (const item of [...agencyItems, ...stateItems]) byId.set(item.externalId, item);
  return [...byId.values()];
}

async function fetchUscisNewsroom(): Promise<NewsItem[]> {
  const res = await fetch(USCIS_NEWSROOM_URL, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`USCIS newsroom: HTTP ${res.status}`);
  return parseUscisNewsroomHtml(await res.text());
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const cronSecret = requireEnv("CRON_SECRET");
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // SERVICE_SECRET_KEY, not the legacy SUPABASE_SERVICE_ROLE_KEY — see the
  // comment in check-cases/index.ts and docs/HANDOFF.md "Polling outage".
  const db = createClient(requireEnv("SUPABASE_URL"), requireEnv("SERVICE_SECRET_KEY"), {
    auth: { persistSession: false },
  });

  const sources: Array<{ name: string; fetcher: () => Promise<NewsItem[]> }> = [
    { name: "federal_register", fetcher: fetchFederalRegister },
    { name: "uscis_newsroom", fetcher: fetchUscisNewsroom },
  ];

  const results: SourceResult[] = [];

  for (const { name, fetcher } of sources) {
    try {
      const items = await fetcher();
      let inserted = 0;
      for (const item of items) {
        const { error } = await db.from("news_items").upsert(
          {
            source: item.source,
            external_id: item.externalId,
            title: item.title,
            summary: item.summary,
            url: item.url,
            published_at: item.publishedAt,
            fetched_at: new Date().toISOString(),
          },
          { onConflict: "source,external_id" },
        );
        if (error) throw new Error(`upsert failed for ${item.externalId}: ${error.message}`);
        inserted += 1;
      }
      results.push({ source: name, fetched: items.length, inserted, error: null });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.error(`fetch-news: ${name} failed:`, message);
      results.push({ source: name, fetched: 0, inserted: 0, error: message });
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
