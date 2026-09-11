"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().toLowerCase().email();

export interface ForgotPasswordState {
  status: "idle" | "sent" | "error";
  message?: string;
}

/**
 * Sends a password-recovery email.
 *
 * The link lands on /auth/confirm (which exchanges the token for a session,
 * the same route the old magic-link flow used — this is why that route was
 * kept when magic link was removed), then forwards to /reset-password via
 * the `next` param.
 *
 * Always reports success, even when the address isn't registered. Saying
 * "no account with that email" would turn this form into a way to test
 * which addresses have accounts — the same enumeration leak that Supabase's
 * own signup endpoint guards against by returning a decoy user.
 */
export async function requestPasswordReset(
  _prev: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { status: "error", message: "Enter a valid email address." };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });

  if (error) {
    console.error("[requestPasswordReset]", error.code ?? error.status, error.message);
    // Rate limits are worth surfacing accurately — they're the one failure a
    // user can actually act on (by waiting) rather than a generic retry.
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { status: "error", message: `Too many requests: ${error.message}` };
    }
    return { status: "error", message: `Couldn't send the email: ${error.message}` };
  }

  return {
    status: "sent",
    message: `If an account exists for ${parsed.data}, a reset link is on its way.`,
  };
}
