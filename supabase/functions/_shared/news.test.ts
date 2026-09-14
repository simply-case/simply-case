import { test } from "node:test";
import assert from "node:assert/strict";

import {
  federalRegisterUrl,
  NewsParseError,
  parseFederalRegisterResponse,
  parseUscisNewsroomHtml,
} from "./news.ts";

import {
  FEDERAL_REGISTER_EMPTY_RESPONSE,
  FEDERAL_REGISTER_SAMPLE_RESPONSE,
  USCIS_NEWSROOM_MALFORMED_HTML,
  USCIS_NEWSROOM_SAMPLE_HTML,
} from "./news.fixtures.ts";

// --- Federal Register --------------------------------------------------

test("parses real Federal Register documents into NewsItems", () => {
  const items = parseFederalRegisterResponse(FEDERAL_REGISTER_SAMPLE_RESPONSE);
  assert.equal(items.length, 3);
  assert.equal(items[0].source, "federal_register");
  assert.equal(items[0].externalId, "2026-18736");
  assert.match(items[0].title, /Petition To Remove the Conditions on Residence/);
  assert.equal(items[0].url, FEDERAL_REGISTER_SAMPLE_RESPONSE.results[0].html_url);
  assert.equal(items[0].publishedAt, "2026-09-14T00:00:00.000Z");
});

test("an empty Federal Register result set is not a parse error", () => {
  const items = parseFederalRegisterResponse(FEDERAL_REGISTER_EMPTY_RESPONSE);
  assert.deepEqual(items, []);
});

test("a Federal Register response missing `results` entirely is a parse error", () => {
  assert.throws(() => parseFederalRegisterResponse({ description: "oops" }), NewsParseError);
  assert.throws(() => parseFederalRegisterResponse(null), NewsParseError);
});

test("federalRegisterUrl includes both immigration agencies and asks for newest first", () => {
  const url = federalRegisterUrl(20);
  assert.match(url, /order=newest/);
  assert.match(url, /u-s-citizenship-and-immigration-services/);
  assert.match(url, /executive-office-for-immigration-review/);
  assert.match(url, /per_page=20/);
});

// --- USCIS newsroom ------------------------------------------------------

test("parses real USCIS newsroom rows into NewsItems", () => {
  const items = parseUscisNewsroomHtml(USCIS_NEWSROOM_SAMPLE_HTML);
  assert.equal(items.length, 6);
  assert.equal(items[0].source, "uscis_newsroom");
  assert.equal(items[0].title, "USCIS Reaches H-2B Cap for First Half of FY 2027");
  assert.equal(items[0].externalId, "/newsroom/alerts/uscis-reaches-h-2b-cap-for-first-half-of-fy-2027");
  assert.equal(items[0].url, "https://www.uscis.gov/newsroom/alerts/uscis-reaches-h-2b-cap-for-first-half-of-fy-2027");
  assert.equal(items[0].publishedAt, "2026-09-11T13:40:20.000Z");
  assert.ok(items[0].summary && items[0].summary.length > 0);
});

test("decodes HTML entities and strips tags from newsroom titles/summaries", () => {
  const items = parseUscisNewsroomHtml(USCIS_NEWSROOM_SAMPLE_HTML);
  const withEntity = items.find((i) => i.summary?.includes("H-2B cap"));
  assert.ok(withEntity, "expected to find the H-2B row");
  assert.ok(!withEntity!.summary!.includes("&nbsp;"), "should have decoded &nbsp;");
  assert.ok(!withEntity!.summary!.includes("<"), "should have stripped any inner tags");
});

test("markup with no views-row blocks at all is a parse error, not zero results", () => {
  assert.throws(() => parseUscisNewsroomHtml(USCIS_NEWSROOM_MALFORMED_HTML), NewsParseError);
});

test("finding rows but extracting zero usable items is a parse error", () => {
  const brokenRows = `<div class="views-row">no title or date markup here</div>
    <div class="views-row">still nothing usable</div>`;
  assert.throws(() => parseUscisNewsroomHtml(brokenRows), NewsParseError);
});

test("one malformed row doesn't drop the rest of a real batch", () => {
  const baseline = parseUscisNewsroomHtml(USCIS_NEWSROOM_SAMPLE_HTML);
  // Corrupt only the FIRST row's title field class name (one occurrence),
  // so its title/date regex can't match, while the other 5 rows are
  // untouched real markup.
  const mixed = USCIS_NEWSROOM_SAMPLE_HTML.replace('views-field-title"', 'views-field-titleXXX"');
  const items = parseUscisNewsroomHtml(mixed);
  assert.equal(items.length, baseline.length - 1, "exactly the one corrupted row should be skipped");
});
