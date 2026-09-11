"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().toLowerCase().email();

export interface SendMagicLinkState {
  status: "idle" | "sent" | "error";
  message?: string;
}

/**
 * Sends a magic-link sign-in email via Resend (custom SMTP — see
 * docs/DEPLOY_NOTES.md). Two independent throttles can produce a 429 here,
 * and the error copy below must not claim a specific cause it can't confirm:
 *   - a per-address cooldown (auth.email.max_frequency, currently 60s) —
 *     the one you'll actually hit while testing by resending to yourself
 *   - the hourly cap across all addresses (auth.rate_limit.email_sent)
 * Supabase's own error message already distinguishes these ("you can only
 * request this after N seconds" vs "email rate limit exceeded"), so it's
 * surfaced directly rather than replaced with a guess.
 */
export async function sendMagicLink(
  _prev: SendMagicLinkState,
  formData: FormData,
): Promise<SendMagicLinkState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${siteUrl}/auth/confirm`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    console.error("[sendMagicLink]", error.code ?? error.status, error.message);
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      // error.message here is Supabase's own text, which already says
      // whether this is the per-address cooldown or the hourly cap — don't
      // paper over that distinction with a fixed guess.
      return { status: "error", message: `Too many requests: ${error.message}` };
    }
    return {
      status: "error",
      message: `Couldn't send the link: ${error.message}`,
    };
  }
  return { status: "sent", message: `Check ${parsed.data} for a sign-in link.` };
}
