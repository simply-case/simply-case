"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().toLowerCase().email();

export interface SendMagicLinkState {
  status: "idle" | "sent" | "error";
  message?: string;
}

/**
 * Sends a magic-link sign-in email. Supabase's own auth email relay is
 * rate-limited to a handful per hour (see docs/PLAN.md "email" decision) —
 * fine for the low volume of login attempts this will see before Resend is
 * wired in for the higher-volume notification channel.
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
    // Surface what actually went wrong. A generic "try again shortly" for
    // every failure makes the most common one — Supabase's built-in email
    // relay hitting its few-per-hour cap — indistinguishable from a real
    // outage, and sends people retrying into the same wall.
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return {
        status: "error",
        message:
          "Too many sign-in emails sent recently. Supabase's built-in email is rate-limited to a few per hour — wait a bit, or configure custom SMTP to remove the cap.",
      };
    }
    console.error("[sendMagicLink]", error.code ?? error.status, error.message);
    return {
      status: "error",
      message: `Couldn't send the link: ${error.message}`,
    };
  }
  return { status: "sent", message: `Check ${parsed.data} for a sign-in link.` };
}
