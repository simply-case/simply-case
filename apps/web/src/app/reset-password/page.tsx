"use client";

import { useActionState } from "react";
import { Button, Input } from "@/components/ui";
import { updatePassword, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = { status: "idle" };

export default function ResetPasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">Set a new password</h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Choose a password you&apos;ll use to sign in from now on.
        </p>

        <form action={formAction} className="mt-6 space-y-3">
          <Input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="New password (min. 6 characters)"
            aria-label="New password"
          />
          <Input
            name="confirmPassword"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="Confirm new password"
            aria-label="Confirm new password"
          />
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Saving…" : "Save password"}
          </Button>
        </form>

        {state.status === "error" && (
          <p role="status" className="mt-4 text-sm text-[var(--color-danger)]">
            {state.message}
          </p>
        )}
      </div>
    </main>
  );
}
