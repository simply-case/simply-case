import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next 16 renamed this convention from "middleware" to "proxy" (still backed
 * by the same lib/supabase/middleware.ts helper — that filename follows
 * Supabase's own SSR docs, unrelated to Next's naming).
 *
 * Next's own guidance for proxy.ts is to keep it "thin" — check for a session
 * cookie and redirect, but skip expensive verification here. We deliberately
 * don't: updateSession calls supabase.auth.getUser(), which revalidates
 * against Supabase Auth rather than trusting the cookie's own claims. Given
 * what's behind this gate (immigration case data), a session check that
 * would accept a stale or forged-looking cookie is the wrong tradeoff for
 * the extra request latency.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every request except static assets and Next's own internals —
     * those never need a session and re-running auth on them is pure cost.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
