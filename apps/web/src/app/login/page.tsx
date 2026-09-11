"use client";

import Link from "next/link";
import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
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
    <p role="status" className="mt-4 text-sm text-red-600">
      {linkError}
    </p>
  );
}

/**
 * Email + password only. Magic link was removed at the user's request —
 * the /auth/confirm route is kept, since password reset (not yet built)
 * will use the same token-exchange mechanism.
 *
 * Note: email confirmation is currently disabled project-wide (see
 * auth.email.enable_confirmations in supabase/config.toml), so signup
 * returns a session immediately with no email sent. That's deliberate
 * while Resend is still on its test sender — re-enabling it is a launch
 * blocker tracked in docs/HANDOFF.md.
 */
function PasswordForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signInWithPassword : signUpWithPassword;
  const [state, formAction, pending] = useActionState(action, passwordInitial);

  return (
    <>
      <form action={formAction} className="mt-6 space-y-3">
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder="Password (min. 6 characters)"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      {state.status === "error" && (
        <p role="status" className="mt-4 text-sm text-red-600">
          {state.message}
        </p>
      )}
      {state.status === "idle" && (
        <Suspense fallback={null}>
          <LinkError />
        </Suspense>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-xs text-neutral-500 hover:text-neutral-800"
        >
          {mode === "signin"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
        {mode === "signin" && (
          <Link href="/forgot-password" className="text-xs text-neutral-500 hover:text-neutral-800">
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
        <h1 className="text-xl font-semibold text-neutral-900">mycase pro</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Track your immigration case status.
        </p>
        <PasswordForm />
      </div>
    </main>
  );
}
