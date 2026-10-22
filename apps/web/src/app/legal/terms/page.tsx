import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Terms of Service — Simply Case",
};

/**
 * Public — reachable while signed out (see PUBLIC_PATHS in
 * lib/supabase/middleware.ts). The App Store and Play Store both require a
 * reachable terms/privacy URL as part of app review, and a reviewer
 * account is never logged in.
 *
 * The text lives in packages/shared/src/legal.ts, shared with the mobile
 * app's native rendering of the same document. Edit it there, not here.
 */
export default function TermsPage() {
  return <LegalDocument id="terms" />;
}
