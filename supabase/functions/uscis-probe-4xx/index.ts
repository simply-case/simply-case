/**
 * uscis-probe-4xx — deliberately sends known-bad requests to the USCIS
 * sandbox so USCIS can see real 4xx traffic on our key(s) (see
 * docs/HANDOFF.md, "USCIS 4xx testing requirement").
 *
 * Triggered on a schedule by pg_cron (migration 0017), same shared-secret
 * pattern and --no-verify-jwt deploy as check-cases/fetch-news.
 *
 * Deliberately SEPARATE from check-cases: writes only to
 * uscis_probe_runs, never touches tracked_cases / case_status_events /
 * poll_runs. It cannot trip the polling circuit breaker, dirty real case
 * history, or trigger a notification email.
 *
 * Hard-pinned to the sandbox environment — never reads USCIS_ENVIRONMENT.
 * If production access is later granted and that env var flips elsewhere in
 * the app, this must not start firing deliberately-bad requests at the real
 * USCIS API on the account we just got approved for. See uscis-probe.ts.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { UscisClient } from "../_shared/uscis.ts";
import { PROBE_CASES, probeOnce } from "../_shared/uscis-probe.ts";

function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

interface CredentialPair {
  label: string;
  clientId: string;
  clientSecret: string;
}

/**
 * Credential pairs to probe. Always includes the primary pair check-cases
 * already uses. USCIS_CLIENT_ID_2 / USCIS_CLIENT_SECRET_2 are optional — set
 * them only if a second sandbox key ever needs exercising (USCIS's
 * 2026-09-22 message referenced "either of your API keys"; see
 * docs/HANDOFF.md for whether that second key is even a sandbox key).
 * Omitting them just probes the one key we have.
 */
function loadCredentialPairs(): CredentialPair[] {
  const pairs: CredentialPair[] = [
    {
      label: "primary",
      clientId: requireEnv("USCIS_CLIENT_ID"),
      clientSecret: requireEnv("USCIS_CLIENT_SECRET"),
    },
  ];
  const secondId = Deno.env.get("USCIS_CLIENT_ID_2");
  const secondSecret = Deno.env.get("USCIS_CLIENT_SECRET_2");
  if (secondId && secondSecret) {
    pairs.push({ label: "secondary", clientId: secondId, clientSecret: secondSecret });
  }
  return pairs;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const cronSecret = requireEnv("CRON_SECRET");
  if (req.headers.get("x-cron-secret") !== cronSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceSecretKey = requireEnv("SERVICE_SECRET_KEY");
  const db = createClient(supabaseUrl, serviceSecretKey, {
    auth: { persistSession: false },
  });

  const pairs = loadCredentialPairs();
  const results: Array<Record<string, unknown>> = [];

  for (const pair of pairs) {
    // environment is hard-coded to "sandbox" here, never derived from
    // USCIS_ENVIRONMENT or any other env-driven flag — see module header.
    const client = new UscisClient({
      clientId: pair.clientId,
      clientSecret: pair.clientSecret,
      environment: "sandbox",
    });

    let accessToken: string;
    try {
      accessToken = await client.getAccessToken();
    } catch (cause) {
      const message = `token request failed: ${String(cause)}`;
      console.error(`[uscis-probe-4xx] ${pair.label}: ${message}`);
      results.push({ credential_label: pair.label, error: message });
      await db.from("uscis_probe_runs").insert({
        credential_label: pair.label,
        probe_label: "token_request",
        receipt: null,
        http_status: null,
        is_four_xx: false,
        error_kind: "network",
        message,
      });
      continue;
    }

    for (const probeCase of PROBE_CASES) {
      const outcome = await probeOnce(probeCase, accessToken);
      results.push({ credential_label: pair.label, ...outcome });

      const { error: insertError } = await db.from("uscis_probe_runs").insert({
        credential_label: pair.label,
        probe_label: outcome.label,
        receipt: outcome.receipt,
        http_status: outcome.httpStatus,
        is_four_xx: outcome.isFourXx,
        error_kind: outcome.errorKind,
        message: outcome.message,
      });
      if (insertError) {
        console.error(
          `[uscis-probe-4xx] failed to record run (${pair.label}/${outcome.label}):`,
          insertError,
        );
      }
    }
  }

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
