import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Simply Case",
};

/**
 * Public — reachable while signed out, same reasoning as terms/page.tsx.
 *
 * Written from an actual inventory of the code (docs/PHASE_F_PLAN.md F8),
 * not boilerplate: every category below corresponds to a real table/field
 * in supabase/migrations, and the "we do not" claims were checked by
 * grepping the codebase for analytics/crash-reporting SDKs (none found)
 * before writing them. ⚠️ NOT reviewed by a lawyer.
 */
export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded"
      >
        ← Simply Case
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-[var(--color-text)]">
        Privacy Policy
      </h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Last updated: {LEGAL_LAST_UPDATED}
      </p>

      <Card className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-[var(--color-text)]">
        <section>
          <h2 className="font-semibold">What we store</h2>
          <ul className="mt-1 list-disc pl-5 text-[var(--color-text-muted)]">
            <li>Your account email address and password (handled by our authentication provider, Supabase).</li>
            <li>Case or receipt numbers you add, an optional nickname you give them, and whether they&apos;re archived.</li>
            <li>The status history we&apos;ve observed for cases you track.</li>
            <li>Your notification preferences per case, and quiet-hours settings.</li>
            <li>A record of notifications sent to you, so we don&apos;t send duplicates.</li>
            <li>Your timezone and preferred language, if you&apos;ve set them.</li>
            <li>A push-notification device token, once push notifications are available and you enable them.</li>
            <li>If you use the Visa Bulletin personalization feature: your selected category, country, and priority date.</li>
            <li>If you use visa-status (CEAC) tracking: the case or application identifier you enter.</li>
            <li>If you track an immigration court (EOIR) case: the A-Number you enter. An A-Number is a government identification number, and we treat it with the same care as any other case identifier you give us.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">What stays only on your phone</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            Some government status pages ask for more than a case number.
            Anything extra you choose to save for those lookups is stored
            only in your device&apos;s secure storage (the iOS Keychain or
            Android Keystore). It is never sent to us, never stored on our
            servers, and never included in backups or logs we hold. If you
            reinstall the app or switch phones, you&apos;ll need to enter it
            again. This applies to:
          </p>
          <ul className="mt-1 list-disc pl-5 text-[var(--color-text-muted)]">
            <li>For visa-status (CEAC) cases: your passport number, the first five letters of your surname, and the consulate location.</li>
            <li>For immigration court (EOIR) cases: your nationality.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-semibold">What we don&apos;t do</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            We don&apos;t sell your data or use it for advertising. We
            don&apos;t use any analytics or crash-reporting service — there
            is none built into the app as of this writing.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Who we share it with</h2>
          <ul className="mt-1 list-disc pl-5 text-[var(--color-text-muted)]">
            <li>Supabase — our database, authentication, and backend hosting provider.</li>
            <li>Vercel — hosts the web app.</li>
            <li>Resend — sends account and notification emails.</li>
            <li>USCIS — when you add a case, your receipt number is sent to USCIS&apos;s official case-status API to check on it. This is the only way to look up a case&apos;s status.</li>
          </ul>
          <p className="mt-1 text-[var(--color-text-muted)]">
            We don&apos;t share your data with anyone else.
          </p>
          <p className="mt-2 text-[var(--color-text-muted)]">
            Visa-status (CEAC) and immigration court (EOIR) checks work
            differently. Those agencies don&apos;t offer us a way to look up
            a case on your behalf, so the app opens their official status
            page inside the app and fills in the details you gave us. The
            request goes from your phone directly to that government
            website — the State Department for visa cases, the Executive
            Office for Immigration Review for court cases — the same as if
            you had typed it into their page in your own browser. Those
            sites may set their own cookies and apply their own privacy
            policies and security checks, which we don&apos;t control. We
            receive the result back so we can show it to you and save the
            status to your case history.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">How long we keep it</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            We keep your data for as long as your account exists. If you
            delete your account, your profile, tracked cases, notification
            history, and any case data that no one else is tracking are
            deleted immediately. A case that other users are also tracking
            stays in our system for their sake, but is no longer linked to
            you in any way.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Deleting your account</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            You can delete your account at any time from Profile → Delete
            account in the app. You can also email us at{" "}
            {LEGAL_CONTACT_EMAIL} and we&apos;ll delete it for you.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Security</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            Your data is stored in a Postgres database with row-level
            security, so only you (and, where applicable, our automated
            polling process) can access your case data. We never store
            your password in a readable form.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Contact</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            Questions about this policy, or a data request:{" "}
            {LEGAL_CONTACT_EMAIL}
          </p>
        </section>
      </Card>
    </main>
  );
}
