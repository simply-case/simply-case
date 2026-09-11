"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  sendMagicLink,
  signInWithPassword,
  signUpWithPassword,
  type PasswordAuthState,
  type SendMagicLinkState,
} from "./actions";

const magicLinkInitial: SendMagicLinkState = { status: "idle" };
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

function MagicLinkForm() {
  const [state, formAction, pending] = useActionState(sendMagicLink, magicLinkInitial);

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

/** Password sign-in/sign-up, added alongside magic link purely so local and
 * device testing doesn't need an email round trip every time. See
 * app/login/actions.ts for why this doesn't replace magic link. */
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

      <button
        type="button"
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-3 text-xs text-neutral-500 hover:text-neutral-800"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
      </button>
    </>
  );
}

export default function LoginPage() {
  const [tab, setTab] = useState<"magic" | "password">("password");

  return (
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-neutral-900">mycase pro</h1>

        <div className="mt-4 flex gap-1 rounded-md bg-neutral-100 p-1 text-sm">
          <button
            type="button"
            onClick={() => setTab("password")}
            className={`flex-1 rounded px-3 py-1.5 ${tab === "password" ? "bg-white font-medium shadow-sm" : "text-neutral-500"}`}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setTab("magic")}
            className={`flex-1 rounded px-3 py-1.5 ${tab === "magic" ? "bg-white font-medium shadow-sm" : "text-neutral-500"}`}
          >
            Email link
          </button>
        </div>

        {tab === "password" ? <PasswordForm /> : <MagicLinkForm />}
      </div>
    </main>
  );
}
