import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — Simply Case",
};

/**
 * Public — reachable while signed out (see PUBLIC_PATHS in
 * lib/supabase/middleware.ts). The App Store and Play Store both require a
 * reachable terms/privacy URL as part of app review, and a reviewer
 * account is never logged in.
 *
 * ⚠️ NOT reviewed by a lawyer. Written to accurately describe what the
 * product actually does (docs/PHASE_F_PLAN.md), which is a floor, not a
 * substitute for real legal review before a public launch.
 */
export default function TermsPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded"
      >
        ← Simply Case
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-[var(--color-text)]">
        Terms of Service
      </h1>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">
        Last updated: {LEGAL_LAST_UPDATED}
      </p>

      <Card className="mt-6 flex flex-col gap-4 text-sm leading-relaxed text-[var(--color-text)]">
        <section>
          <h2 className="font-semibold">Not affiliated with any government agency</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            Simply Case is an independent, third-party service. It is not
            affiliated with, endorsed by, or operated by U.S. Citizenship
            and Immigration Services (USCIS), the U.S. Department of
            State, the Executive Office for Immigration Review (EOIR), or
            any other U.S. government agency.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Not legal advice</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            Nothing in this app is legal advice. Case status information is
            retrieved from public and official government sources and may
            be delayed, incomplete, or incorrect. Always confirm your
            case&apos;s actual status on the relevant official government
            website before making any decision. If you need legal advice
            about an immigration matter, consult a licensed attorney.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">What the service does</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            You may add case or receipt numbers you are authorized to
            track. We periodically check the status of those cases against
            the relevant official source and notify you of changes. You
            are responsible for only adding cases you have a legitimate
            right to track (for example, your own case, or one you are
            assisting with, with permission).
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Accounts</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            You are responsible for keeping your account credentials
            secure. You may delete your account at any time from the
            Profile screen in the app; see our{" "}
            <Link href="/legal/privacy" className="underline">
              Privacy Policy
            </Link>{" "}
            for what that does.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">No warranty</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            The service is provided &quot;as is,&quot; without warranty of
            any kind. We do not guarantee that case status information
            will always be accurate, complete, or available.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Changes</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            We may update these terms from time to time. Continued use of
            the app after a change means you accept the updated terms.
          </p>
        </section>

        <section>
          <h2 className="font-semibold">Contact</h2>
          <p className="mt-1 text-[var(--color-text-muted)]">
            Questions about these terms: {LEGAL_CONTACT_EMAIL}
          </p>
        </section>
      </Card>
    </main>
  );
}
