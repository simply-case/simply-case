"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().trim().toLowerCase().email();

// Mirrors auth.minimum_password_length in supabase/config.toml (currently 6).
// Kept in sync manually — there's no API to read that value at request time.
const passwordSchema = z.string().min(6, "Password must be at least 6 characters.");

const credentialsSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

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

export interface PasswordAuthState {
  status: "idle" | "error";
  message?: string;
}

/**
 * Password sign-in, added alongside (not instead of) magic-link auth —
 * magic link already works end to end, so there was no reason to remove it.
 * This exists purely to make local/device testing fast: no email round
 * trip, no deep-link, no tunnel. signInWithPassword() returns a session
 * directly and the server client's setAll sets the cookie immediately, same
 * mechanism as every other server-side Supabase call in this app.
 */
export async function signInWithPassword(
  _prev: PasswordAuthState,
  formData: FormData,
): Promise<PasswordAuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { status: "error", message: error.message };
  }
  redirect("/");
}

/**
 * Self-serve signup. Subject to the same email-confirmation policy as
 * magic-link accounts (auth.email.enable_confirmations in config.toml) —
 * that setting is about verifying the address, not which login method was
 * used, so it applies here too. A brand-new account therefore can't sign in
 * immediately after this call; it needs the confirmation email clicked
 * first, same as any other unconfirmed account.
 */
export async function signUpWithPassword(
  _prev: PasswordAuthState,
  formData: FormData,
): Promise<PasswordAuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp(parsed.data);
  if (error) {
    return { status: "error", message: error.message };
  }

  // signUp() returns a session directly, with no confirmation step, only
  // when enable_confirmations is off. When it's on (the current setting),
  // data.session is null and the user must click the confirmation email —
  // reuses the same Resend pipeline as magic link, already verified working.
  if (data.session) redirect("/");
  return {
    status: "error",
    message: "Account created — check your email to confirm it before signing in.",
  };
}
