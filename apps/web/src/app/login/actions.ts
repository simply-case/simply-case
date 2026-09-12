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

export interface PasswordAuthState {
  status: "idle" | "error" | "info";
  message?: string;
}

/**
 * Password sign-in — now the only auth method (magic link was removed at
 * the user's request). signInWithPassword() returns a session directly and
 * the server client's setAll sets the cookie immediately, same mechanism as
 * every other server-side Supabase call in this app.
 *
 * Caveat worth knowing: accounts originally created via magic link have no
 * password set, so they get `invalid_credentials` here and currently have
 * no in-app way to set one — password reset isn't built yet.
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
 * Self-serve signup.
 *
 * With auth.email.enable_confirmations currently OFF (see config.toml for
 * why — Resend's test sender can't reach anyone but the account owner),
 * signUp() returns a session immediately and no email is sent at all. The
 * no-session branch below is kept because it becomes the real path again
 * the moment confirmations are re-enabled, which is a launch blocker.
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
  // Genuinely a success message (an account was created), not an error —
  // previously returned as status "error" here, which rendered it in red.
  return {
    status: "info",
    message: "Account created — check your email to confirm it before signing in.",
  };
}
