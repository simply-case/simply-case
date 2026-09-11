"use client";

import { useActionState, useRef, useEffect } from "react";
import { addCase, type AddCaseState } from "@/app/cases/actions";

const initialState: AddCaseState = { status: "idle" };

export function AddCaseForm() {
  const [state, formAction, pending] = useActionState(addCase, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3 rounded-lg border border-neutral-200 p-4">
      <h2 className="text-sm font-medium text-neutral-900">Add a case</h2>

      <div className="flex gap-2">
        <select
          name="provider"
          defaultValue="uscis"
          className="rounded-md border border-neutral-300 px-2 py-2 text-sm"
        >
          <option value="uscis">USCIS</option>
          <option value="eoir" disabled>
            EOIR (coming soon)
          </option>
          <option value="ceac" disabled>
            CEAC (coming soon)
          </option>
        </select>
        <input
          name="caseKey"
          required
          placeholder="Receipt number, e.g. IOE0912345678"
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
        />
      </div>

      <input
        name="nickname"
        placeholder="Nickname (optional) — shown in notifications"
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500"
      />

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Adding…" : "Add case"}
      </button>

      {state.status !== "idle" && (
        <p className={`text-sm ${state.status === "error" ? "text-red-600" : "text-green-700"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
