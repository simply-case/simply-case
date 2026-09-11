"use client";

import { useActionState } from "react";
import { updatePassword, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = { status: "idle" };

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-neutral-900">Set a new password</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Choose a password you&apos;ll use to sign in from now on.
        </p>

        <form action={formAction} className="mt-6 space-y-3">
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="New password (min. 6 characters)"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <input
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Confirm new password"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
          />
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save password"}
          </button>
        </form>

        {state.status === "error" && (
          <p role="status" className="mt-4 text-sm text-red-600">
            {state.message}
          </p>
        )}
      </div>
    </main>
  );
}
