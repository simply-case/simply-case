"use client";

import Link from "next/link";
import { useTransition } from "react";
import { archiveCase, unarchiveCase, removeCase } from "@/app/cases/actions";
import { Card, StatusPill } from "@/components/ui";
import type { Database } from "@mycasepro/shared";

type CaseRow = Database["public"]["Views"]["my_case_details"]["Row"];

export function CaseCard({ c }: { c: CaseRow }) {
  const [pending, startTransition] = useTransition();
  const isArchived = c.archived_at !== null;

  // user_case_id is NOT NULL on user_cases (the view's primary key column);
  // the generated view type widens it to nullable, but the constraint holds.
  // Guard rather than assert, since it's cheap and this is user input driving
  // a destructive action (archive/remove).
  if (!c.user_case_id) return null;
  const userCaseId = c.user_case_id;

  return (
    <Card as="li" className={`flex items-start justify-between gap-4 ${isArchived ? "opacity-65" : ""}`}>
      <div className="min-w-0">
        <Link
          href={`/cases/${c.tracked_case_id}`}
          className="font-medium text-[var(--color-text)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded"
        >
          {c.nickname || c.case_key}
        </Link>
        <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--color-text-faint)]">
          {c.provider} · {c.case_key}
          {c.form_type && ` · ${c.form_type}`}
        </p>
        <div className="mt-2">
          <StatusPill statusText={c.status_text_en} />
        </div>
        {c.last_checked_at && (
          <p className="mt-2 text-xs text-[var(--color-text-faint)]">
            Last checked {new Date(c.last_checked_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1 text-xs">
        {isArchived ? (
          <button
            disabled={pending}
            onClick={() => startTransition(() => unarchiveCase(userCaseId))}
            className="rounded border border-[var(--color-border)] px-2 py-1 text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            Unarchive
          </button>
        ) : (
          <button
            disabled={pending}
            onClick={() => startTransition(() => archiveCase(userCaseId))}
            className="rounded border border-[var(--color-border)] px-2 py-1 text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            Archive
          </button>
        )}
        <button
          disabled={pending}
          onClick={() => {
            if (confirm("Remove this case? Its history will still exist but you'll stop tracking it.")) {
              startTransition(() => removeCase(userCaseId));
            }
          }}
          className="rounded border border-[var(--color-danger)]/30 px-2 py-1 text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
        >
          Remove
        </button>
      </div>
    </Card>
  );
}
