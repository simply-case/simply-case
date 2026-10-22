# Website handoff: jakarallc.com and /simplycase

Hand this file to the website repo. It is self-contained. Written
2026-10-14 from the Simply Case app repo (github.com/simply-case/simply-case,
public). Nothing here is secret.

**Status: policy text finalized 2026-10-14 (Appendix A); a few company details still open (§9).** Items marked ⚠️ are decisions
or facts the owner still has to supply. Don't invent them.

---

## 1. What to build

| URL | Purpose |
|---|---|
| `jakarallc.com/` | Main page for the company, **Jakara LLC**. Brief, credible, links to its products. |
| `jakarallc.com/simplycase` | Landing page for the Simply Case app. Also the "support URL" and marketing URL for App Store / Play Store listings. |
| `jakarallc.com/simplycase/privacy` | Public Privacy Policy. Reachable with no sign-in. |
| `jakarallc.com/simplycase/terms` | Public Terms of Service. Reachable with no sign-in. |
| `jakarallc.com/simplycase/delete-account` | How to permanently delete your data (see §5). |

The privacy, terms and delete pages are **required**, not optional. App
Store and Play Store review need a public URL for each, and USCIS reviews
them before granting API production access (§3).

## 2. What Simply Case is (for the landing page copy)

An immigration case tracker. You add a case number and the app shows its
status history and emails you when it changes. iPhone first (Expo app);
web version exists at simply-case-web.vercel.app. Free, no limits, for now.

Case types it tracks:
- **USCIS** cases by receipt number, using USCIS's official case-status API.
- **Visa cases (NVC / DS-160)** through the State Department's CEAC page.
- **Immigration court (EOIR)** cases by A-Number, through the court's
  public case-status page.

Also in the app: a news feed (Federal Register and USCIS newsroom), a
Resources tab of official links, per-case notifications with quiet hours,
and in-app account deletion.

**Honest limits to state on the page** (the app's own Terms say these, and
USCIS reviews for it):
- **Not affiliated with, endorsed by, or operated by** USCIS, the
  Department of State, EOIR, or any government agency. Put this above the
  fold or in a visible footer on every `/simplycase` page. Do not use
  government seals, logos, or wording that implies an official service.
- **Not legal advice.** Status can be delayed or wrong; confirm on the
  official site.
- **Visa-status and court lookups are user-assisted.** The app opens the
  official page and fills in what you saved. Passport number, surname,
  consulate and nationality stay **only on the phone**, never on our
  servers. No email alerts for those two types.
- Don't claim push notifications (not built yet), Android (untested), or
  social sign-in (buttons exist as a layout preview only, not wired up).
- Don't claim "secure"/"encrypted" beyond what the Privacy Policy says.
  Keep marketing claims inside the policy text.

Suggested sections: hero (one line + App Store button), three-step "how it
works", case types supported, "what stays on your phone", the disclaimer
block, FAQ, footer with Privacy / Terms / Delete account / contact email.

⚠️ App Store link and screenshots: the app is not on TestFlight or the App
Store yet (needs the Apple Developer account). Until then use a "Coming
soon" or waitlist state. Don't ship a dead link.

Brand: name is **"Simply Case"** everywhere visible (internal IDs still say
`mycasepro`; never show that). Mobile design language is a warm cream
background, navy buttons, bright-blue tappable links, serif headlines
(Georgia). Logo files are in the app repo at `apps/mobile/assets/`
(`simplycase.png`, `iconandwriting.PNG`, `header-logo.png`). Note the
`.PNG` extension is capitalised on one of them.

## 3. USCIS requirements the site must meet

USCIS reviews the Terms and Privacy Policy before the demo and before
production API access. Their checklist, trimmed to what applies to a
website, is below. The first group is about **how the pages look**, so it
binds your repo directly. The second group is **what the text says**; the
text already exists (§4), so your job is to publish it unchanged and not
weaken it.

### 3a. Readability (desktop and mobile)

Every one of these is checked on both the privacy and terms pages.

- Body text **14px or larger**. Use 16px. Footnotes and "Last updated"
  lines count too; one such line already failed the check once at 13px.
- Text and background contrast **at least 4.5:1** (WCAG AA). Check muted
  grey text and links, not just the body. Light grey on cream is the usual
  failure. Use a contrast checker; don't eyeball it.
- **No narrow columns.** On desktop, a reading column of roughly 60 to 80
  characters (about 640 to 720px). Don't squeeze text into a thin sidebar
  or a multi-column layout. On mobile, full width with a 16px gutter and
  no horizontal scroll.
- **No long unbroken paragraphs.** Keep paragraphs short (2 to 4
  sentences) and use headings and bullet lists.
- **No run-on sentences** and **no ALL-CAPS paragraphs** (a word or a
  sentence is fine). Don't use all-caps legal boilerplate ("THE SERVICE IS
  PROVIDED AS IS…").
- **Reading level grade 12 or below** and **no typos**. The existing text
  was measured with Flesch-Kincaid. Anything you add (landing-page legal
  blurbs, the delete page) must meet it too. Re-measure after edits.

Also keep the legal pages as plain, fast, server-rendered HTML. A
reviewer, a crawler and a signed-out phone must all see the full text
without JavaScript or a login.

### 3b. Content (must be present, publicly, on your domain)

Each item maps to a section in the shared policy text. The "status" column
is from reading that text on 2026-10-14.

| USCIS requirement | In the current text? |
|---|---|
| Easy way to request permanent deletion | Yes in-app (Profile → Delete account). **Needs a public web path too: §5.** |
| How soon deletion happens | Yes: immediate in-app; within 30 days by email. |
| CCPA compliance | Yes, "California privacy rights" section. |
| Specific types of data collected | Yes, "What we store" (and says no location, financial, medical, contacts). |
| How data is used, incl. de-identified data | Yes ("What we don't do": no sharing of de-identified data). |
| Entities data is shared with, and how they use it | Yes: Supabase, Vercel, Resend, USCIS, plus the CEAC/EOIR direct-from-phone lookups. |
| State that no data is sold | Yes. |
| Data-sharing **choices, risks, benefits, limitations** | Yes, "Your choices about sharing" (added 2026-10-14). |
| **Impact of sharing on others** (their genetic/family example) | Yes, "How your choices can affect other people" (added 2026-10-14). |
| Third-party use or disclosure prohibited without active consent | Yes. |
| Third parties bound by the policy | Yes. |
| Breach notification and what the user can do | Yes. |
| Retention policy, including **dormant accounts** | Yes: kept until you delete; inactive accounts not auto-deleted. |
| How to permanently delete data | Yes in-app and by email; add the web page (§5). |
| Ownership transfer or business end: new owner follows same policy, or user can delete first; users are notified | Yes ("If Simply Case changes ownership"). Business **shutdown** is now covered too (added 2026-10-14). |
| How to close an account | Yes. |
| **Active consent** to policy changes, how it's obtained, plain-language summary of changes | Yes in text and in the app (a blocking re-consent screen). **On the website, add a "What changed" section** listing the same plain-language summaries (§4). |

The policy now names **Jakara LLC** as the operator. The text in
Appendix A is the final version and matches `packages/shared/src/legal.ts`
in the app repo exactly (it was generated from that file). Edit it in the
app repo first, then re-sync, so the site and app never disagree.

## 4. Where the legal text comes from (don't fork it)

The only source of truth is `packages/shared/src/legal.ts` in the app
repo. It's structured content: a list of sections, each with paragraphs and
bullet lists, plus `LEGAL_LAST_UPDATED` and `LEGAL_CHANGELOG`. The mobile
app and `simply-case-web.vercel.app/legal/*` already render from it.

Recommended: **copy it into the website repo as static content** and
render your own pages from it. Keep a header comment pointing back to the
app repo path and the rule "change it there first". Don't paraphrase or
"improve" the wording on the site. If the website is Next.js or
TypeScript, you can copy `legal.ts` verbatim (it has no dependencies) and
call `getLegalDocument("privacy" | "terms", contactEmail)`.

Rules for the copy:
- Show **Last updated** on each page, and the changelog as a "What changed"
  section (newest first, each entry has a date and one plain sentence).
- Pass the real contact address in (§6). Right now the shared text ships
  with a placeholder, `contact@REPLACE-BEFORE-LAUNCH.invalid`.
- When the app repo bumps the date, the website must be updated in the same
  release. The app asks existing users to re-accept on a date change, and
  the page they're sent to has to match.
- The app points to these pages. After the site is live, the app repo will
  change its public legal URLs from `simply-case-web.vercel.app/legal/*` to
  `jakarallc.com/simplycase/privacy` and `/terms`. That's a change in the
  app repo, not yours; just keep these URLs stable once published.

Decision made by the owner: **copy-and-sync**, kept simple. Use
Appendix A below as the source for the site's pages.

## 5. Account and data deletion page

`/simplycase/delete-account` should be a plain page that:

1. Says what deletion does: your profile, tracked cases, notification
   history, and any case data nobody else tracks are deleted **immediately**
   when you delete in the app. A case other users also track stays, but is
   no longer linked to you.
2. Shows the in-app path: **Profile → Delete account**.
3. For people who can't open the app (lost phone, uninstalled), gives the
   email route: write to the contact address and the account and data are
   deleted **within 30 days** of the request.
4. Says what to include in the email (the account email address) and that
   we may need to confirm the request comes from that address.
5. Notes that data stored only on the phone (passport number, surname,
   consulate, nationality) is removed by deleting the app or its data.

This page needs the real, monitored mailbox from §6 before it can go live.
Link it from the footer of every `/simplycase` page and from the Privacy
page.

⚠️ Optional later: a form instead of an email. Not needed for USCIS; an
email address is enough.

## 6. Contact email and domain

The app has no real contact address yet; this blocks the first outside
tester. Since the owner has jakarallc.com, create a monitored mailbox such
as ⚠️ `support@jakarallc.com` (owner to choose the name) and use it for:
- the Terms and Privacy "Contact" sections,
- the deletion-by-email route,
- the footer.

This domain is also the planned **verified sender domain** for the app's
email (Resend), and the app's sign-up confirmation emails depend on it.
That is app-side work, but the DNS records (SPF/DKIM/DMARC from Resend)
will be added to this domain, so don't clobber existing DNS and don't
point the apex at something that breaks mail. ⚠️ Where is DNS managed?

## 7. Main page (`jakarallc.com/`)

Keep it small and honest: company name, one or two sentences on what Jakara
LLC does, a card for Simply Case linking to `/simplycase`, and a footer
with the contact email. ⚠️ The owner needs to supply the company blurb,
any other products, and whether to show a mailing address. Don't invent a
company history, team, or client logos.

## 8. Technical notes

- Public, fast, accessible. Pre-render the legal pages; no sign-in, no
  cookie wall. If you add analytics, **the Privacy Policy currently says
  there is none** (and says the app has no analytics or crash reporting).
  Don't add tracking to these pages without telling the app-repo owner,
  because the policy would then be wrong.
- No third-party fonts or scripts on the legal pages unless the policy
  names them; a system serif/sans stack avoids the question.
- Set `<title>`, meta description and a canonical URL per page. Add
  `lang="en"`, one `<h1>` per page, real heading levels, and visible focus
  styles.
- Light mode only is fine; if you add dark mode, re-check contrast (§3a).
- `robots.txt` should allow the legal pages. USCIS and the app stores need
  to reach them.
- Test at 360px and 1280px wide, and with the browser zoomed to 200%.

## 9. Still open

1. ⚠️ Website stack. If the repo already exists, use whatever it is; if it
   is empty, Next.js on Vercel matches the app's web side.
2. ⚠️ Mailbox name and where the domain's settings (DNS) are managed (§6).
   Replace `{{CONTACT_EMAIL}}` in Appendix A with the real address.
3. ⚠️ Company blurb for the main page. Placeholder for now (§7).
4. App Store link and screenshots: "Coming soon" until they exist.
5. Whether to mention the web app at simply-case-web.vercel.app.

Decided: Jakara LLC is the named operator; copy-and-sync for legal text.
Placeholder company blurb for the main page: "Jakara LLC is a technology
company. We build AI solutions." (Owner will replace.)

---

## Appendix A. Policy text as of 2026-10-14 (STALE: the live text is `packages/shared/src/legal.ts`, updated 2026-10-20 with a receipt-numbers section)

Replace `{{CONTACT_EMAIL}}` with the real address. Keep the wording as is.

### Terms of Service

_Last updated: October 14, 2026_

#### Who we are

Simply Case is operated by Jakara LLC. In these terms, "we," "us," and "our" mean Jakara LLC.

#### Not affiliated with any government agency

Simply Case is an independent, third-party service. It is not affiliated with, endorsed by, or operated by U.S. Citizenship and Immigration Services (USCIS), the U.S. Department of State, the Executive Office for Immigration Review (EOIR), or any other U.S. government agency.

#### Not legal advice

Nothing in this app is legal advice. Case status information is retrieved from public and official government sources and may be delayed, incomplete, or incorrect. Always confirm your case's actual status on the relevant official government website before making any decision. If you need legal advice about an immigration matter, consult a licensed attorney.

#### What the service does

You may add case or receipt numbers you are authorized to track. We periodically check the status of those cases against the relevant official source and notify you of changes. You are responsible for only adding cases you have a legitimate right to track (for example, your own case, or one you are assisting with, with permission).

#### Accounts

You are responsible for keeping your account credentials secure. You may delete your account at any time from the Profile screen in the app; see our Privacy Policy for what that does.

#### No warranty

The service is provided "as is," without warranty of any kind. We do not guarantee that case status information will always be accurate, complete, or available.

#### Changes

We may update these terms. If a change affects your rights or how your data is used, we'll ask you to actively agree to the updated terms the next time you open the app — simply continuing to use the app is not enough.

When that happens, we'll show you a short, plain-language summary of what changed, with a link to the full updated terms and privacy policy.

#### Contact

Questions about these terms: {{CONTACT_EMAIL}}


### Privacy Policy

_Last updated: October 14, 2026_

#### Who we are

Simply Case is operated by Jakara LLC. In this policy, "we," "us," and "our" mean Jakara LLC.

#### What we store

- Your account email address and password (handled by our authentication provider, Supabase).
- Your name, if you give us one when creating your account.
- Case or receipt numbers you add, an optional nickname you give them, and whether they're archived.
- The status history we've observed for cases you track.
- Your notification preferences per case, and quiet-hours settings.
- A record of notifications sent to you, so we don't send duplicates.
- Your timezone and preferred language, if you've set them.
- A push-notification device token, once push notifications are available and you enable them.
- If you use the Visa Bulletin personalization feature: your selected category, country, and priority date.
- If you use visa-status (CEAC) tracking: the case or application identifier you enter.
- If you track an immigration court (EOIR) case: the A-Number you enter. An A-Number is a government identification number, and we treat it with the same care as any other case identifier you give us.

We do not collect your location, financial information, medical information, or access your device's contacts.

#### What stays only on your phone

Some government status pages ask for more than a case number. Anything extra you choose to save for those lookups is stored only in your device's secure storage (the iOS Keychain or Android Keystore). It is never sent to us, never stored on our servers, and never included in backups or logs we hold. If you reinstall the app or switch phones, you'll need to enter it again. This applies to:

- For visa-status (CEAC) cases: your passport number, the first five letters of your surname, and the consulate location.
- For immigration court (EOIR) cases: your nationality.

#### What we don't do

We don't sell your data or use it for advertising. We don't use any analytics or crash-reporting service — there is none built into the app as of this writing. We also don't share de-identified, anonymized, or pseudonymized versions of your data with anyone.

#### Who we share it with

- Supabase — our database, authentication, and backend hosting provider.
- Vercel — hosts the web app.
- Resend — sends account and notification emails.
- USCIS — when you add a case, your receipt number is sent to USCIS's official case-status API to check on it. This is the only way to look up a case's status.

We don't share your data with anyone else.

The companies listed above may only use your data to provide their service to us. For example, Resend can only use your email address to send the messages we ask it to send. None of them may use your data for their own purposes, or share it with anyone else, without your active consent. Each of them is bound to handle your data consistent with this policy.

Visa-status (CEAC) and immigration court (EOIR) checks work differently. Those agencies don't offer us a way to look up a case on your behalf, so the app opens their official status page and fills in the details you gave us.

The request goes from your phone directly to that government website — the State Department for visa cases, the Executive Office for Immigration Review for court cases. It's the same as if you had typed it into their page yourself.

Those sites may set their own cookies. They have their own privacy policies and security checks, which we don't control.

We receive the result back so we can show it to you and save the status to your case history.

If another Simply Case user is also tracking the same case or receipt number, you both see the same publicly-sourced status history for that case — that status information isn't private to either of you. Your own account details, like your name, your nickname for the case, and your notification settings, are never shared with other users.

#### Your choices about sharing

You decide what to give us. Adding a case is optional, and so are a nickname, a name, and notification settings. You can archive or remove a case, and you can delete your account at any time.

Sharing data is how the app works, and it has trade-offs.

- Benefit: when you add a case, we can check its status for you and email you when it changes.
- Risk: your receipt number goes to USCIS, and your email address goes to our email provider. We trust these companies, but we can't control their systems.
- Limit: government sites may be slow, wrong, or unavailable. Case information we show can be out of date.
- Limit: if you stop sharing a case with us, we can no longer watch it for you.

#### How your choices can affect other people

A receipt number, an A-Number, or a visa case number can identify someone else, such as a spouse, a child, or a client. Only add a case if you have the right to track it.

If you add someone else's case, their case status goes through our systems and the government sites listed above. Please make sure they know and agree.

#### How long we keep it

We keep your data for as long as your account exists. We don't automatically delete inactive accounts — if you stop using the app, your data stays exactly as described above until you delete your account yourself.

If you delete your account, your profile, tracked cases, notification history, and any case data that no one else is tracking are deleted immediately. A case that other users are also tracking stays in our system for their sake, but is no longer linked to you in any way.

#### Deleting your account

Deleting your account from Profile → Delete account in the app happens immediately.

If you'd rather email us at {{CONTACT_EMAIL}}, we'll delete your account and data within 30 days of your request.

#### If there's a data breach

If we discover that your data was accessed without authorization, we'll notify you without unreasonable delay by email. We'll tell you what happened and what steps you can take, if any — for example, changing your password.

#### California privacy rights

California residents may have extra rights under the California Consumer Privacy Act (CCPA). These include the right to know what personal information we have about you, and the right to ask us to delete it.

You can use the account deletion options above for either of these, or email us.

We don't sell personal information, so there's no sale to opt out of.

#### If Simply Case changes ownership

If Simply Case is ever sold, merged, or otherwise transferred to a new owner, we'll notify you before your data is transferred. The new owner will be required to follow this same Privacy Policy.

If you'd rather not have your data transferred, you can delete your account before the transfer happens — see "Deleting your account" above.

If Jakara LLC closes this business, we'll tell you by email first. We'll give you time to delete your account. Any data left after that is permanently and securely deleted.

#### Security

Your data is stored in a Postgres database with row-level security, so only you (and, where applicable, our automated polling process) can access your case data. We never store your password in a readable form.

#### Contact

Questions about this policy, or a data request: {{CONTACT_EMAIL}}


### What changed (newest first)

- **October 14, 2026:** We now name Jakara LLC as the company that runs Simply Case. We added a section on your data-sharing choices and the risks, and a note about how tracking someone else's case can affect them. We also explained what happens to your data if the business shuts down.
- **October 6, 2026:** Strengthened the "If Simply Case changes ownership" section: a new owner must now follow this same Privacy Policy, and you can delete your account first if you'd rather not have your data transferred.
- **October 2, 2026:** We added new sections on data breaches, business transfers, and California privacy rights. We also clarified how long we keep your data and how email deletion requests are handled. Finally, we changed how we'll handle future policy updates — see "Changes" in the Terms.
