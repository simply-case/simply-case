import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Two different shapes can land here, and a real email click only ever
 * produces the second one:
 *
 * - `token_hash` + `type` — what you get by calling verifyOtp directly with a
 *   token from the admin API (generate_link). Useful for scripted testing,
 *   but NOT what a real email link produces.
 * - `code` — a PKCE authorization code. @supabase/ssr's server client
 *   defaults to flowType "pkce", so Supabase's own default email templates
 *   point at its hosted /auth/v1/verify endpoint, which verifies the OTP
 *   server-side and redirects here with `?code=` for us to exchange via
 *   exchangeCodeForSession — not with token_hash/type. Discovered by driving
 *   an actual email click through this route rather than only the
 *   admin-API-generated links used in earlier testing, which bypass this
 *   path entirely and so never exercised it.
 *
 * Either path ends by setting the session cookie via the server client's
 * setAll — this route handler, unlike a Server Component, is allowed to
 * write cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, request.nextUrl.origin));
  }

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/login";
  errorUrl.searchParams.set("error", "That link is invalid or has expired.");
  return NextResponse.redirect(errorUrl);
}
