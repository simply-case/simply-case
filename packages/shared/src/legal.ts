/**
 * The Terms of Service and Privacy Policy text, as structured content.
 *
 * This is the SINGLE source of truth for both platforms. It used to live as
 * JSX inside apps/web's two legal pages, which meant the mobile app could
 * only show it by opening the website in a browser sheet. Legal text living
 * in two places is the kind of thing that quietly becomes wrong — a Privacy
 * Policy that says different things in the app and on the site is a real
 * problem, not a cosmetic one — so the text moved here and both platforms
 * now render the same content with their own primitives.
 *
 * The public web pages must KEEP EXISTING regardless: App Store and Play
 * Store review both require a reachable terms/privacy URL, and a reviewer
 * is never signed in.
 *
 * ⚠️ NOT reviewed by a lawyer. Written to accurately describe what the
 * product actually does (docs/PHASE_F_PLAN.md), which is a floor, not a
 * substitute for real legal review before a public launch.
 *
 * Deliberately a small, closed format — paragraphs, bullet lists, and links
 * to the *other* legal document — rather than Markdown or HTML. Both of
 * those would need a parser/renderer on mobile, and arbitrary HTML in a
 * native app is a bigger surface than this content ever needs.
 */

export type LegalDocId = "terms" | "privacy";

/** A run of text, optionally linking to the other legal document. */
export type LegalInline = string | { text: string; doc: LegalDocId };

export type LegalBlock =
  | { kind: "paragraph"; content: LegalInline[] }
  | { kind: "list"; items: string[] };

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  id: LegalDocId;
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
}

/**
 * Contact address shown on both documents, and used for "Contact us" /
 * "Send feedback" in the app.
 *
 * ⚠️ LAUNCH BLOCKER: must be replaced with a real, monitored address before
 * any real user beyond the account owner can sign up — it's where someone
 * would write to ask for their data to be deleted. This is now the ONE
 * definition (apps/web and apps/mobile both import it), so replacing it is
 * a one-line change here.
 */
export const LEGAL_CONTACT_EMAIL = "contact@REPLACE-BEFORE-LAUNCH.invalid";

/** Shown on both documents — bump whenever the text below changes. */
export const LEGAL_LAST_UPDATED = "September 22, 2026";

const p = (...content: LegalInline[]): LegalBlock => ({ kind: "paragraph", content });
const ul = (...items: string[]): LegalBlock => ({ kind: "list", items });

function termsSections(contactEmail: string): LegalSection[] {
  return [
    {
      heading: "Not affiliated with any government agency",
      blocks: [
        p(
          "Simply Case is an independent, third-party service. It is not affiliated with, endorsed by, or operated by U.S. Citizenship and Immigration Services (USCIS), the U.S. Department of State, the Executive Office for Immigration Review (EOIR), or any other U.S. government agency.",
        ),
      ],
    },
    {
      heading: "Not legal advice",
      blocks: [
        p(
          "Nothing in this app is legal advice. Case status information is retrieved from public and official government sources and may be delayed, incomplete, or incorrect. Always confirm your case's actual status on the relevant official government website before making any decision. If you need legal advice about an immigration matter, consult a licensed attorney.",
        ),
      ],
    },
    {
      heading: "What the service does",
      blocks: [
        p(
          "You may add case or receipt numbers you are authorized to track. We periodically check the status of those cases against the relevant official source and notify you of changes. You are responsible for only adding cases you have a legitimate right to track (for example, your own case, or one you are assisting with, with permission).",
        ),
      ],
    },
    {
      heading: "Accounts",
      blocks: [
        p(
          "You are responsible for keeping your account credentials secure. You may delete your account at any time from the Profile screen in the app; see our ",
          { text: "Privacy Policy", doc: "privacy" },
          " for what that does.",
        ),
      ],
    },
    {
      heading: "No warranty",
      blocks: [
        p(
          'The service is provided "as is," without warranty of any kind. We do not guarantee that case status information will always be accurate, complete, or available.',
        ),
      ],
    },
    {
      heading: "Changes",
      blocks: [
        p(
          "We may update these terms from time to time. Continued use of the app after a change means you accept the updated terms.",
        ),
      ],
    },
    {
      heading: "Contact",
      blocks: [p(`Questions about these terms: ${contactEmail}`)],
    },
  ];
}

function privacySections(contactEmail: string): LegalSection[] {
  return [
    {
      heading: "What we store",
      blocks: [
        ul(
          "Your account email address and password (handled by our authentication provider, Supabase).",
          "Your name, if you give us one when creating your account.",
          "Case or receipt numbers you add, an optional nickname you give them, and whether they're archived.",
          "The status history we've observed for cases you track.",
          "Your notification preferences per case, and quiet-hours settings.",
          "A record of notifications sent to you, so we don't send duplicates.",
          "Your timezone and preferred language, if you've set them.",
          "A push-notification device token, once push notifications are available and you enable them.",
          "If you use the Visa Bulletin personalization feature: your selected category, country, and priority date.",
          "If you use visa-status (CEAC) tracking: the case or application identifier you enter.",
          "If you track an immigration court (EOIR) case: the A-Number you enter. An A-Number is a government identification number, and we treat it with the same care as any other case identifier you give us.",
        ),
      ],
    },
    {
      heading: "What stays only on your phone",
      blocks: [
        p(
          "Some government status pages ask for more than a case number. Anything extra you choose to save for those lookups is stored only in your device's secure storage (the iOS Keychain or Android Keystore). It is never sent to us, never stored on our servers, and never included in backups or logs we hold. If you reinstall the app or switch phones, you'll need to enter it again. This applies to:",
        ),
        ul(
          "For visa-status (CEAC) cases: your passport number, the first five letters of your surname, and the consulate location.",
          "For immigration court (EOIR) cases: your nationality.",
        ),
      ],
    },
    {
      heading: "What we don't do",
      blocks: [
        p(
          "We don't sell your data or use it for advertising. We don't use any analytics or crash-reporting service — there is none built into the app as of this writing.",
        ),
      ],
    },
    {
      heading: "Who we share it with",
      blocks: [
        ul(
          "Supabase — our database, authentication, and backend hosting provider.",
          "Vercel — hosts the web app.",
          "Resend — sends account and notification emails.",
          "USCIS — when you add a case, your receipt number is sent to USCIS's official case-status API to check on it. This is the only way to look up a case's status.",
        ),
        p("We don't share your data with anyone else."),
        p(
          "Visa-status (CEAC) and immigration court (EOIR) checks work differently. Those agencies don't offer us a way to look up a case on your behalf, so the app opens their official status page inside the app and fills in the details you gave us. The request goes from your phone directly to that government website — the State Department for visa cases, the Executive Office for Immigration Review for court cases — the same as if you had typed it into their page in your own browser. Those sites may set their own cookies and apply their own privacy policies and security checks, which we don't control. We receive the result back so we can show it to you and save the status to your case history.",
        ),
      ],
    },
    {
      heading: "How long we keep it",
      blocks: [
        p(
          "We keep your data for as long as your account exists. If you delete your account, your profile, tracked cases, notification history, and any case data that no one else is tracking are deleted immediately. A case that other users are also tracking stays in our system for their sake, but is no longer linked to you in any way.",
        ),
      ],
    },
    {
      heading: "Deleting your account",
      blocks: [
        p(
          `You can delete your account at any time from Profile → Delete account in the app. You can also email us at ${contactEmail} and we'll delete it for you.`,
        ),
      ],
    },
    {
      heading: "Security",
      blocks: [
        p(
          "Your data is stored in a Postgres database with row-level security, so only you (and, where applicable, our automated polling process) can access your case data. We never store your password in a readable form.",
        ),
      ],
    },
    {
      heading: "Contact",
      blocks: [p(`Questions about this policy, or a data request: ${contactEmail}`)],
    },
  ];
}

export const LEGAL_DOC_TITLES: Record<LegalDocId, string> = {
  terms: "Terms of Service",
  privacy: "Privacy Policy",
};

/**
 * Builds one legal document. `contactEmail` is injected rather than read
 * from the constant directly so a caller can substitute one (a test, or a
 * future per-environment address) without the text going stale.
 */
export function getLegalDocument(
  id: LegalDocId,
  contactEmail: string = LEGAL_CONTACT_EMAIL,
): LegalDocument {
  return {
    id,
    title: LEGAL_DOC_TITLES[id],
    lastUpdated: LEGAL_LAST_UPDATED,
    sections: id === "terms" ? termsSections(contactEmail) : privacySections(contactEmail),
  };
}
