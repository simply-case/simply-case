/**
 * Recorded USCIS newsroom HTML and Federal Register JSON, trimmed to a
 * handful of real items, used by the offline news-parsing tests.
 *
 * Fetched live 2026-09-13. USCIS_NEWSROOM_SAMPLE_HTML is 6 real
 * <div class="views-row"> blocks from https://www.uscis.gov/newsroom/all-news
 * (Drupal Views markup) — kept verbatim so the parser is tested against the
 * actual markup shape, not an idealized version of it. Real news content, not
 * placeholder text; dates are real as of the fetch.
 */

export const USCIS_NEWSROOM_SAMPLE_HTML = `<div class="view-content">
<div class="views-row"><div class="views-field views-field-title"><h3 class="field-content"><a href="/newsroom/alerts/uscis-reaches-h-2b-cap-for-first-half-of-fy-2027" hreflang="en">USCIS Reaches H-2B Cap for First Half of FY 2027</a></h3></div><div class="views-field views-field-field-display-date"><div class="field-content"><time datetime="2026-09-11T13:40:20Z" class="datetime">September 11, 2026</time>
</div></div><div class="views-field views-field-body"><div class="field-content">U.S. Citizenship and Immigration Services received enough petitions to meet the congressionally established&nbsp;H-2B cap for the first half of fiscal year (FY) 2027.</div></div></div>
    
<div class="views-row"><div class="views-field views-field-title"><h3 class="field-content"><a href="/newsroom/alerts/dhs-announces-rule-for-certain-children-born-in-the-united-states-to-foreign-government-employees" hreflang="en">DHS Announces Rule for Certain Children Born in the United States to Foreign Government Employees</a></h3></div><div class="views-field views-field-field-display-date"><div class="field-content"><time datetime="2026-09-04T22:26:12Z" class="datetime">September 04, 2026</time>
</div></div><div class="views-field views-field-body"><div class="field-content">The Department of Homeland Security today issued an&nbsp;interim final rule amending its regulations to allow certain children born in the United States to foreign government employees who are not U.S. citizens to register as lawful permanent residents.</div></div></div>
    
<div class="views-row"><div class="views-field views-field-title"><h3 class="field-content"><a href="/newsroom/alerts/court-order-on-diversity-immigrant-visa-program-hold-policy" hreflang="en">Court Order on Diversity Immigrant Visa Program Hold Policy</a></h3></div><div class="views-field views-field-field-display-date"><div class="field-content"><time datetime="2026-09-04T17:40:27Z" class="datetime">September 04, 2026</time>
</div></div><div class="views-field views-field-body"><div class="field-content">On Aug. 28, 2026, the U.S. District Court for the Northern District of California issued an order in&nbsp;Medani, et al., v. Trump, et al.,&nbsp;26-cv-6332 (NDCA), temporarily vacating PM-602-0193 pending further litigation. USCIS is ordered, “to the extent practicable and in good faith, to take all reasonable steps during the remainder of the Diversity Visa fiscal year to resume ordinary adjudication of plaintiffs’ pending adjustment of status applications without applying” PM-602-0193.</div></div></div>
    
<div class="views-row"><div class="views-field views-field-title"><h3 class="field-content"><a href="/newsroom/news-releases/naturalized-us-citizen-indicted-for-lying-to-obtain-us-citizenship-after-committing-felonies" hreflang="en">Naturalized U.S. Citizen Indicted for Lying to Obtain U.S. Citizenship After Committing Felonies</a></h3></div><div class="views-field views-field-field-display-date"><div class="field-content"><time datetime="2026-09-03T18:36:10Z" class="datetime">September 03, 2026</time>
</div></div><div class="views-field views-field-body"><div class="field-content">A naturalized U.S. citizen made his initial appearance in court Sept. 2 for allegedly lying about his prior criminal acts to obtain U.S. citizenship. The U.S. Attorney's Office for the District of Nevada announced the charges.</div></div></div>
    
<div class="views-row"><div class="views-field views-field-title"><h3 class="field-content"><a href="/newsroom/alerts/uscis-opens-new-international-field-office-in-ethiopia-to-support-fraud-prevention" hreflang="en">USCIS Opens New International Field Office in Ethiopia to Support Fraud Prevention</a></h3></div><div class="views-field views-field-field-display-date"><div class="field-content"><time datetime="2026-09-03T18:15:27Z" class="datetime">September 03, 2026</time>
</div></div><div class="views-field views-field-body"><div class="field-content">U.S. Citizenship and Immigration Services (USCIS) is opening a new international field office in Addis Ababa, Ethiopia. The office will begin operations on September 9, 2026, and will handle USCIS immigration matters in Ethiopia.</div></div></div>
    
<div class="views-row"><div class="views-field views-field-title"><h3 class="field-content"><a href="/newsroom/news-releases/illegal-alien-indicted-in-marriage-related-immigration-fraud" hreflang="en">Illegal Alien Indicted in Marriage-Related Immigration Fraud</a></h3></div><div class="views-field views-field-field-display-date"><div class="field-content"><time datetime="2026-09-03T13:57:11Z" class="datetime">September 03, 2026</time>
</div></div><div class="views-field views-field-body"><div class="field-content">U.S. Citizenship and Immigration Services played a critical role in the investigation that led to the&nbsp;indictment of Miguel Angel Olivera‑Borda, 38, a Peruvian alien illegally present in the United States, after federal prosecutors presented evidence to a grand jury.</div></div></div>
    
</div>`;

/** A trimmed real response from federalregister.gov/api/v1/documents.json. */
export const FEDERAL_REGISTER_SAMPLE_RESPONSE = {
  "description": "Documents from U.S. Citizenship and Immigration Services",
  "count": 2086,
  "total_pages": 50,
  "next_page_url": "https://www.federalregister.gov/api/v1/documents?conditions%5Bagencies%5D%5B%5D=u-s-citizenship-and-immigration-services&fields%5B%5D=document_number&fields%5B%5D=title&fields%5B%5D=abstract&fields%5B%5D=html_url&fields%5B%5D=publication_date&fields%5B%5D=type&format=json&order=newest&page=2&per_page=5&search_after_cursor=WzE3ODkzNDQwMDAwMDAsIjIwMjYtMTg3MjAiXQ",
  "results": [
    {
      "document_number": "2026-18736",
      "title": "Agency Information Collection Activities; Revision of a Currently Approved Collection: Petition To Remove the Conditions on Residence",
      "abstract": "The Department of Homeland Security (DHS), U.S. Citizenship and Immigration Services (USCIS) will be submitting the following information collection request to the Office of Management and Budget (OMB) for review and clearance in accordance with the Paperwork Reduction Act of 1995. The purpose of this notice is to allow an additional 30 days for public comments.",
      "html_url": "https://www.federalregister.gov/documents/2026/09/14/2026-18736/agency-information-collection-activities-revision-of-a-currently-approved-collection-petition-to",
      "publication_date": "2026-09-14",
      "type": "Notice"
    },
    {
      "document_number": "2026-18724",
      "title": "Agency Information Collection Activities; Extension, Without Change, of a Currently Approved Collection: Application for Certificate of Citizenship",
      "abstract": "The Department of Homeland Security (DHS), U.S. Citizenship and Immigration Services (USCIS) invites the general public and other Federal agencies to comment upon this proposed extension of a currently approved collection of information. In accordance with the Paperwork Reduction Act (PRA) of 1995, the information collection notice is published in the Federal Register to obtain comments regarding the nature of the information collection, the categories of respondents, the estimated burden (i.e., the time, effort, and resources used by the respondents to respond), the estimated cost to the respondent, and the actual information collection instruments.",
      "html_url": "https://www.federalregister.gov/documents/2026/09/14/2026-18724/agency-information-collection-activities-extension-without-change-of-a-currently-approved-collection",
      "publication_date": "2026-09-14",
      "type": "Notice"
    },
    {
      "document_number": "2026-18722",
      "title": "Agency Information Collection Activities; Extension, Without Change, of a Currently Approved Collection: Application for Regional Center Designation; Application for Approval of an Investment in a Commercial Enterprise; Regional Center Annual Statement; Bona Fides of Persons Involved With Regional Center Program; Registration for Direct and Third-Party Promoters",
      "abstract": "The Department of Homeland Security (DHS), U.S. Citizenship and Immigration Services (USCIS) invites the general public and other Federal agencies to comment upon this proposed extension. In accordance with the Paperwork Reduction Act (PRA) of 1995, the information collection notice is published in the Federal Register to obtain comments regarding the nature of the information collection, the categories of respondents, the estimated burden (i.e., the time, effort, and resources used by the respondents to respond), the estimated cost to the respondent, and the actual information collection instruments.",
      "html_url": "https://www.federalregister.gov/documents/2026/09/14/2026-18722/agency-information-collection-activities-extension-without-change-of-a-currently-approved-collection",
      "publication_date": "2026-09-14",
      "type": "Notice"
    }
  ]
};

/** A response shape indicating no matching documents — must not be treated as an error. */
export const FEDERAL_REGISTER_EMPTY_RESPONSE = {
  description: "Documents from U.S. Citizenship and Immigration Services",
  count: 0,
  total_pages: 0,
  next_page_url: null,
  results: [],
};

/** Malformed HTML with none of the expected views-row markup — must be treated as a parse failure, not zero results. */
export const USCIS_NEWSROOM_MALFORMED_HTML = "<html><body><h1>Site under maintenance</h1></body></html>";
