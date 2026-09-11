import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@mycasepro/shared";

/**
 * Browser client. Only ever holds the publishable key — it's designed to be
 * public, and RLS (see supabase/migrations/0002_rls.sql) is what actually
 * protects the data, not the secrecy of this key.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
