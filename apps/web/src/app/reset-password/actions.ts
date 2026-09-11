"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Mirrors auth.minimum_password_length in supabase/config.toml (currently 6).
const passwordSchema = z.string().min(6, "Password must be at least 6 characters.");

export interface ResetPasswordState {
  status: "idle" | "error";
  message?: string;
}

/**
 * Sets a new password for the currently-signed-in user.
 *
 * By the time this runs the user already has a real session — /auth/confirm
 * exchanged the recovery token for one before forwarding here. That's what
 * makes updateUser() work without needing the old password, and it's also
 * why this route isn't in PUBLIC_PATHS: no session means the recovery link
 * wasn't actually followed, and there'd be nothing to update.
 */
export async function updatePassword(
  _prev: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = formData.get("password");
  const confirm = formData.get("confirmPassword");

  const parsed = passwordSchema.safeParse(password);
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid password." };
  }
  if (password !== confirm) {
    return { status: "error", message: "Passwords don't match." };
  }

  const supabase = await createClient();

  // Guard explicitly rather than relying on updateUser's error text — a
  // missing session here means an expired or already-used recovery link,
  // which deserves a message that tells the user what to do next.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      status: "error",
      message: "That reset link has expired or was already used. Request a new one.",
    };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    return { status: "error", message: error.message };
  }

  redirect("/");
}
