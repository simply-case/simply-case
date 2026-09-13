/**
 * Real-news fetching for the News tab (ROADMAP Phase F4).
 *
 * Two independent sources, each with its own parser: the Federal Register
 * API (structured JSON, no key) and the USCIS newsroom listing (HTML —
 * there is no real newsroom-specific feed; see the header comment on why
 * `uscis.gov/rss.xml` was rejected). Kept as pure functions with no
 * network calls, so they're tested offline against real recorded samples
 * (news.fixtures.ts) — same pattern as uscis.ts / uscis.fixtures.ts.
 *
 * One source failing must never take down the other — see fetchAllNews()
 * in supabase/functions/fetch-news/index.ts, which calls these and
 * catches per-source.
 */

export interface NewsItem {
  source: "federal_register" | "uscis_newsroom";
  externalId: string;
  title: string;
  summary: string | null;
  url: string;
  publishedAt: string; // ISO 8601
}

export class NewsParseError extends Error {
  source: NewsItem["source"];
  constructor(source: NewsItem["source"], message: string) {
    super(message);
    this.name = "NewsParseError";
    this.source = source;
  }
}

const FEDERAL_REGISTER_AGENCIES = [
  "u-s-citizenship-and-immigration-services",
  "executive-office-for-immigration-review",
] as const;

const FEDERAL_REGISTER_STATE_TERM = "visa";

export function federalRegisterUrl(perPage = 20): string {
  const params = new URLSearchParams();
  params.set("per_page", String(perPage));
  params.set("order", "newest");
  for (const field of ["document_number", "title", "abstract", "html_url", "publication_date", "type"]) {
    params.append("fields[]", field);
  }
  for (const agency of FEDERAL_REGISTER_AGENCIES) {
    params.append("conditions[agencies][]", agency);
  }
  return `https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`;
}

export function federalRegisterStateUrl(perPage = 10): string {
  const params = new URLSearchParams();
  params.set("per_page", String(perPage));
  params.set("order", "newest");
  params.set("conditions[term]", FEDERAL_REGISTER_STATE_TERM);
  for (const field of ["document_number", "title", "abstract", "html_url", "publication_date", "type"]) {
    params.append("fields[]", field);
  }
  params.append("conditions[agencies][]", "state-department");
  return `https://www.federalregister.gov/api/v1/documents.json?${params.toString()}`;
}

interface FederalRegisterDoc {
  document_number: string;
  title: string;
  abstract: string | null;
  html_url: string;
  publication_date: string;
  type: string;
}

interface FederalRegisterResponse {
  results: FederalRegisterDoc[];
}

/**
 * Parses a Federal Register API response. An empty `results` array is a
 * legitimate answer (no matching documents today) and must NOT be treated
 * as a parse failure — only a response missing the `results` field
 * entirely (a genuinely different/broken response shape) is.
 */
export function parseFederalRegisterResponse(json: unknown): NewsItem[] {
  const body = json as Partial<FederalRegisterResponse>;
  if (!body || !Array.isArray(body.results)) {
    throw new NewsParseError(
      "federal_register",
      "Response is missing a `results` array — the API shape may have changed.",
    );
  }
  return body.results.map((doc) => ({
    source: "federal_register" as const,
    externalId: doc.document_number,
    title: doc.title,
    summary: doc.abstract,
    url: doc.html_url,
    // publication_date is a bare YYYY-MM-DD (no time-of-day) — midnight UTC
    // is an approximation, not the real publish time, but the Federal
    // Register API doesn't expose one.
    publishedAt: new Date(`${doc.publication_date}T00:00:00Z`).toISOString(),
  }));
}

/**
 * Parses the USCIS newsroom listing page (Drupal Views markup — there is
 * no dedicated newsroom RSS/Atom feed; `uscis.gov/rss.xml` exists but
 * serves unrelated, largely stale site content, not press releases, so it
 * was rejected rather than used). Deliberately narrow, hand-rolled regex
 * rather than a full HTML parser (no DOM library is a project dependency),
 * scoped to one `views-row` block at a time so a malformed neighboring row
 * can't corrupt extraction of a good one.
 *
 * Per docs/PLAN.md's "store the raw source, alert on parse failure"
 * discipline (the same rule as the Visa Bulletin): finding the newsroom
 * markup at all but extracting ZERO items is treated as a failure, since
 * that's the signature of the page having been restructured — not "there
 * happened to be no news."
 */
export function parseUscisNewsroomHtml(html: string): NewsItem[] {
  const rowStarts: number[] = [];
  const rowRegex = /<div class="views-row">/g;
  for (let m = rowRegex.exec(html); m; m = rowRegex.exec(html)) {
    rowStarts.push(m.index);
  }

  if (rowStarts.length === 0) {
    throw new NewsParseError(
      "uscis_newsroom",
      "No views-row blocks found — the newsroom page markup may have changed.",
    );
  }

  const titleRe = /views-field-title["'][^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/;
  const dateRe = /<time datetime="([^"]+)"/;
  const bodyRe = /views-field-body["'][^>]*>[\s\S]*?<div class="field-content">([\s\S]*?)<\/div>/;

  const items: NewsItem[] = [];
  for (let i = 0; i < rowStarts.length; i++) {
    const block = html.slice(rowStarts[i], rowStarts[i + 1] ?? rowStarts[i] + 4000);

    const titleMatch = titleRe.exec(block);
    const dateMatch = dateRe.exec(block);
    if (!titleMatch || !dateMatch) continue; // one bad row shouldn't drop the rest

    const path = titleMatch[1];
    const title = decodeHtmlEntities(stripTags(titleMatch[2])).trim();
    const publishedAt = new Date(dateMatch[1]).toISOString();
    const bodyMatch = bodyRe.exec(block);
    const summary = bodyMatch ? decodeHtmlEntities(stripTags(bodyMatch[1])).trim() : null;

    items.push({
      source: "uscis_newsroom",
      externalId: path,
      title,
      summary,
      url: path.startsWith("http") ? path : `https://www.uscis.gov${path}`,
      publishedAt,
    });
  }

  if (items.length === 0) {
    throw new NewsParseError(
      "uscis_newsroom",
      `Found ${rowStarts.length} views-row block(s) but extracted 0 usable items — the inner markup may have changed.`,
    );
  }

  return items;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}
