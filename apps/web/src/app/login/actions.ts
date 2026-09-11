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
    return { status: "error", message: "Couldn't send the link. Try again shortly." };
  }
  return { status: "sent", message: `Check ${parsed.data} for a sign-in link.` };
}
