import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@mycasepro/shared";

// /reset-password is deliberately NOT public: clicking the recovery link
// goes through /auth/confirm first, which exchanges the token for a real
// session — so by the time the user lands on /reset-password they are
// authenticated, and anyone reaching it without a session should be sent
// to /login rather than shown a password form that can't work.
const PUBLIC_PATHS = ["/login", "/auth/confirm", "/forgot-password", "/legal"];

/**
 * Refreshes the Supabase session cookie on every request and redirects
 * signed-out users away from anything but the public paths. This is the
 * documented @supabase/ssr pattern — without it, access tokens expire and
 * server-side reads silently start seeing an empty session.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Must call getUser() (not getSession()) — it revalidates against Supabase
  // Auth rather than trusting the cookie's own claims.
  const { data: { user } } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!user && !isPublicPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
