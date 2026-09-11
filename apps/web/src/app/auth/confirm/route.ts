import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * The link in the magic-link email points here with a token_hash + type.
 * verifyOtp exchanges it for a real session and sets the session cookie via
 * the server client's setAll — this route handler, unlike a Server
 * Component, is allowed to write cookies.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      // Built fresh rather than cloning request.nextUrl — cloning carries
      // every incoming query param (token_hash, type, next itself) onto the
      // destination, which a per-param delete() call easily misses one of.
      return NextResponse.redirect(new URL(next, request.nextUrl.origin));
    }
  }

  const errorUrl = request.nextUrl.clone();
  errorUrl.pathname = "/login";
  errorUrl.searchParams.set("error", "That link is invalid or has expired.");
  return NextResponse.redirect(errorUrl);
}
