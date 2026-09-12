"use client";

import Link from "next/link";
import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button, Input } from "@/components/ui";
import {
  signInWithPassword,
  signUpWithPassword,
  type PasswordAuthState,
} from "./actions";

const passwordInitial: PasswordAuthState = { status: "idle" };

/** Reads ?error= from the /auth/confirm redirect. Needs its own Suspense
 * boundary — useSearchParams() otherwise forces the whole page to opt out
 * of static rendering during the build. */
function LinkError() {
  const linkError = useSearchParams().get("error");
  if (!linkError) return null;
  return (
    <p role="status" className="mt-4 text-sm text-[var(--color-danger)]">
      {linkError}
    </p>
  );
}

/**
 * Email + password only. Magic link was removed at the user's request —
 * the /auth/confirm route is kept, since password reset uses the same
 * token-exchange mechanism.
 *
 * Note: email confirmation is currently disabled project-wide (see
 * auth.email.enable_confirmations in supabase/config.toml), so signup
 * returns a session immediately with no email sent. That's deliberate
 * while Resend is still on its test sender — re-enabling it is tracked in
 * docs/ROADMAP.md Phase E.
 */
function PasswordForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signInWithPassword : signUpWithPassword;
  const [state, formAction, pending] = useActionState(action, passwordInitial);

  return (
    <>
      <form action={formAction} className="mt-6 space-y-3">
        <Input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        <Input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Password (min. 6 characters)"
        />
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>

      {state.status === "error" && (
        <p role="status" className="mt-4 text-sm text-[var(--color-danger)]">
          {state.message}
        </p>
      )}
      {state.status === "info" && (
        <p role="status" className="mt-4 text-sm text-[var(--color-accent)]">
          {state.message}
        </p>
      )}
      {state.status === "idle" && (
        <Suspense fallback={null}>
          <LinkError />
        </Suspense>
      )}

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
        {mode === "signin" && (
          <Link href="/forgot-password" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
            Forgot password?
          </Link>
        )}
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Simply Case</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Track your immigration case status.
        </p>
        <PasswordForm />
      </div>
    </main>
  );
}
