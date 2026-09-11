"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, type SendMagicLinkState } from "./actions";

const initialState: SendMagicLinkState = { status: "idle" };

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

function LoginForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, initialState);

  return (
    <>
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
          {pending ? "Sending…" : "Send sign-in link"}
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
      {state.status === "idle" && (
        <Suspense fallback={null}>
          <LinkError />
        </Suspense>
      )}
    </>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-neutral-900">mycase pro</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Sign in with your email — no password needed.
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
