"use client";

import { useActionState, useRef, useEffect } from "react";
import { Button, Card, Input } from "@/components/ui";
import { addCase, type AddCaseState } from "@/app/cases/actions";

const initialState: AddCaseState = { status: "idle" };

export function AddCaseForm() {
  const [state, formAction, pending] = useActionState(addCase, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state.status]);

  return (
    <Card>
      <form ref={formRef} action={formAction} className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Add a case</h2>

        <div className="flex gap-2">
          <select
            name="provider"
            defaultValue="uscis"
            aria-label="Case provider"
            className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-2.5 text-sm text-[var(--color-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <option value="uscis">USCIS</option>
            <option value="eoir" disabled>
              EOIR (coming soon)
            </option>
            <option value="ceac" disabled>
              CEAC (coming soon)
            </option>
          </select>
          <div className="flex-1">
            <Input name="caseKey" required placeholder="Receipt number, e.g. IOE0912345678" aria-label="Receipt number" />
          </div>
        </div>

        <Input name="nickname" placeholder="Nickname (optional) — shown in notifications" aria-label="Nickname" />

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Adding…" : "Add case"}
        </Button>

        {state.status !== "idle" && (
          <p
            role="status"
            className={`text-sm ${state.status === "error" ? "text-[var(--color-danger)]" : "text-[var(--color-accent)]"}`}
          >
            {state.message}
          </p>
        )}
      </form>
    </Card>
  );
}
