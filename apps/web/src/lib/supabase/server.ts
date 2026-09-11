import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@mycasepro/shared";

/**
 * Server client for Server Components, Server Actions, and Route Handlers.
 * Still uses the publishable key + the caller's own cookies — this is NOT a
 * privileged client. It reads/writes exactly what RLS allows the signed-in
 * user to. Nothing in the web app ever touches the secret key; that's
 * reserved for the check-cases / send-notifications Edge Functions.
 *
 * The `catch` around cookie writes is the documented Next.js pattern: a
 * Server Component can call this to read the session, but can't set cookies
 * (only Server Actions and Route Handlers can) — middleware.ts is what
 * actually refreshes the session cookie on every request.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component — middleware handles refresh instead.
          }
        },
      },
    },
  );
}
