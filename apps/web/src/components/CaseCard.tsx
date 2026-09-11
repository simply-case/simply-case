"use client";

import Link from "next/link";
import { useTransition } from "react";
import { archiveCase, unarchiveCase, removeCase } from "@/app/cases/actions";
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
    <li className="flex items-start justify-between gap-4 rounded-lg border border-neutral-200 p-4">
      <div className="min-w-0">
        <Link href={`/cases/${c.tracked_case_id}`} className="font-medium text-neutral-900 hover:underline">
          {c.nickname || c.case_key}
        </Link>
        <p className="mt-0.5 text-xs uppercase tracking-wide text-neutral-500">
          {c.provider} · {c.case_key}
          {c.form_type && ` · ${c.form_type}`}
        </p>
        <p className="mt-2 text-sm text-neutral-700">
          {c.status_text_en ?? (c.last_checked_at ? "No status yet" : "Pending first check…")}
        </p>
        {c.last_checked_at && (
          <p className="mt-1 text-xs text-neutral-400">
            Last checked {new Date(c.last_checked_at).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-1 text-xs">
        {isArchived ? (
          <button
            disabled={pending}
            onClick={() => startTransition(() => unarchiveCase(userCaseId))}
            className="rounded border border-neutral-300 px-2 py-1 text-neutral-700 disabled:opacity-50"
          >
            Unarchive
          </button>
        ) : (
          <button
            disabled={pending}
            onClick={() => startTransition(() => archiveCase(userCaseId))}
            className="rounded border border-neutral-300 px-2 py-1 text-neutral-700 disabled:opacity-50"
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
          className="rounded border border-red-200 px-2 py-1 text-red-600 disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </li>
  );
}
