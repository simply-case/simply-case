"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { status: "idle" };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Reset your password</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          We&apos;ll email you a link to set a new one.
        </p>

        <form action={formAction} className="mt-6 space-y-3">
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            aria-label="Email"
          />
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Sending…" : "Send reset link"}
          </Button>
        </form>

        {state.status !== "idle" && (
          <p
            role="status"
            className={`mt-4 text-sm ${
              state.status === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-accent)]"
            }`}
          >
            {state.message}
          </p>
        )}

        <Link
          href="/login"
          className="mt-4 inline-block text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
