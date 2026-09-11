"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { status: "idle" };

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Reset your password</h1>
        <p className="mt-1 text-sm text-neutral-600">
          We&apos;ll email you a link to set a new one.
        </p>

        <form action={formAction} className="mt-6 space-y-3">
          <label htmlFor="email" className="sr-only">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send reset link"}
          </button>
        </form>

        {state.status !== "idle" && (
          <p
            role="status"
            className={`mt-4 text-sm ${
              state.status === "error" ? "text-red-600" : "text-green-700"
            }`}
          >
            {state.message}
          </p>
        )}

        <Link
          href="/login"
          className="mt-4 inline-block text-xs text-neutral-500 hover:text-neutral-800"
        >
          ← Back to sign in
        </Link>
      </div>
    </main>
  );
}
