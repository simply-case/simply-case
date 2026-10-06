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
export const LEGAL_LAST_UPDATED = "October 6, 2026";

/**
 * One-line, plain-language summaries of what changed, newest first. Shown
 * on the re-consent screen (app/legal-update.tsx) so a returning user sees
 * what's different rather than the whole document again. Hand-written on
 * purpose — diffing the structured content below into "plain language"
 * automatically isn't something worth building; a human already knows what
 * changed and can say it in one sentence.
 *
 * Each entry's `date` is a literal string, NOT a reference to
 * LEGAL_LAST_UPDATED — that constant only ever holds the CURRENT date, so a
 * reference would silently rewrite every past entry's date each time it's
 * bumped.
 */
export const LEGAL_CHANGELOG: Array<{ date: string; summary: string }> = [
  {
    date: "October 6, 2026",
    summary:
      "Strengthened the \"If Simply Case changes ownership\" section: a new owner must now follow this same Privacy Policy, and you can delete your account first if you'd rather not have your data transferred.",
  },
  {
    date: "October 2, 2026",
    summary:
      "We added new sections on data breaches, business transfers, and California privacy rights. We also clarified how long we keep your data and how email deletion requests are handled. Finally, we changed how we'll handle future policy updates — see \"Changes\" in the Terms.",
  },
];

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
          "We may update these terms. If a change affects your rights or how your data is used, we'll ask you to actively agree to the updated terms the next time you open the app — simply continuing to use the app is not enough.",
        ),
        p(
          "When that happens, we'll show you a short, plain-language summary of what changed, with a link to the full updated terms and privacy policy.",
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
        p(
          "We do not collect your location, financial information, medical information, or access your device's contacts.",
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
          "We don't sell your data or use it for advertising. We don't use any analytics or crash-reporting service — there is none built into the app as of this writing. We also don't share de-identified, anonymized, or pseudonymized versions of your data with anyone.",
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
          "The companies listed above may only use your data to provide their service to us. For example, Resend can only use your email address to send the messages we ask it to send. None of them may use your data for their own purposes, or share it with anyone else, without your active consent. Each of them is bound to handle your data consistent with this policy.",
        ),
        p(
          "Visa-status (CEAC) and immigration court (EOIR) checks work differently. Those agencies don't offer us a way to look up a case on your behalf, so the app opens their official status page and fills in the details you gave us.",
        ),
        p(
          "The request goes from your phone directly to that government website — the State Department for visa cases, the Executive Office for Immigration Review for court cases. It's the same as if you had typed it into their page yourself.",
        ),
        p(
          "Those sites may set their own cookies. They have their own privacy policies and security checks, which we don't control.",
        ),
        p(
          "We receive the result back so we can show it to you and save the status to your case history.",
        ),
        p(
          "If another Simply Case user is also tracking the same case or receipt number, you both see the same publicly-sourced status history for that case — that status information isn't private to either of you. Your own account details, like your name, your nickname for the case, and your notification settings, are never shared with other users.",
        ),
      ],
    },
    {
      heading: "How long we keep it",
      blocks: [
        p(
          "We keep your data for as long as your account exists. We don't automatically delete inactive accounts — if you stop using the app, your data stays exactly as described above until you delete your account yourself.",
        ),
        p(
          "If you delete your account, your profile, tracked cases, notification history, and any case data that no one else is tracking are deleted immediately. A case that other users are also tracking stays in our system for their sake, but is no longer linked to you in any way.",
        ),
      ],
    },
    {
      heading: "Deleting your account",
      blocks: [
        p(
          "Deleting your account from Profile → Delete account in the app happens immediately.",
        ),
        p(
          `If you'd rather email us at ${contactEmail}, we'll delete your account and data within 30 days of your request.`,
        ),
      ],
    },
    {
      heading: "If there's a data breach",
      blocks: [
        p(
          "If we discover that your data was accessed without authorization, we'll notify you without unreasonable delay by email. We'll tell you what happened and what steps you can take, if any — for example, changing your password.",
        ),
      ],
    },
    {
      heading: "California privacy rights",
      blocks: [
        p(
          "California residents may have extra rights under the California Consumer Privacy Act (CCPA). These include the right to know what personal information we have about you, and the right to ask us to delete it.",
        ),
        p(
          "You can use the account deletion options above for either of these, or email us.",
        ),
        p("We don't sell personal information, so there's no sale to opt out of."),
      ],
    },
    {
      heading: "If Simply Case changes ownership",
      blocks: [
        p(
          "If Simply Case is ever sold, merged, or otherwise transferred to a new owner, we'll notify you before your data is transferred. The new owner will be required to follow this same Privacy Policy.",
        ),
        p(
          "If you'd rather not have your data transferred, you can delete your account before the transfer happens — see \"Deleting your account\" above.",
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
