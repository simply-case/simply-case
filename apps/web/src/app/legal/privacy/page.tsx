import type { Metadata } from "next";
import { LegalDocument } from "@/components/LegalDocument";

export const metadata: Metadata = {
  title: "Privacy Policy — Simply Case",
};

/**
 * Public — reachable while signed out, same reasoning as terms/page.tsx.
 *
 * The text lives in packages/shared/src/legal.ts, shared with the mobile
 * app's native rendering of the same document. It was written from an
 * actual inventory of the code (docs/PHASE_F_PLAN.md F8), not boilerplate:
 * every category corresponds to a real table/field in supabase/migrations,
 * and the "we do not" claims were checked by grepping for analytics/crash
 * reporting SDKs (none found). ⚠️ NOT reviewed by a lawyer.
 */
export default function PrivacyPage() {
  return <LegalDocument id="privacy" />;
}
