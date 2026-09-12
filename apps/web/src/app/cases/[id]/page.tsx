import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, StatusPill } from "@/components/ui";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Both reads go through the my_case_* views, scoped to this user's own
  // subscriptions — a tracked_case_id for a case this user hasn't added
  // returns no rows here, not someone else's data (see 0002_rls.sql).
  const { data: caseDetail } = await supabase
    .from("my_case_details")
    .select("*")
    .eq("tracked_case_id", id)
    .maybeSingle();

  if (!caseDetail) notFound();

  const { data: events } = await supabase
    .from("my_case_events")
    .select("*")
    .eq("tracked_case_id", id)
    .order("observed_at", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/"
        className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded"
      >
        ← All cases
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-[var(--color-text)]">
        {caseDetail.nickname || caseDetail.case_key}
      </h1>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-[var(--color-text-faint)]">
        {caseDetail.provider} · {caseDetail.case_key}
        {caseDetail.form_type && ` · ${caseDetail.form_type}`}
      </p>

      <Card className="mt-6 space-y-2">
        <StatusPill statusText={caseDetail.status_text_en} />
        <p className="text-sm font-medium text-[var(--color-text)]">
          {caseDetail.status_text_en ?? "Pending first check…"}
        </p>
        {caseDetail.status_detail_en && (
          <p className="text-sm text-[var(--color-text-muted)]">{caseDetail.status_detail_en}</p>
        )}
        {caseDetail.last_checked_at && (
          <p className="pt-1 text-xs text-[var(--color-text-faint)]">
            Last checked {new Date(caseDetail.last_checked_at).toLocaleString()}
          </p>
        )}
      </Card>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-[var(--color-text)]">History</h2>
        {!events || events.length === 0 ? (
          <EmptyState title="No history yet" message="This case hasn't been checked yet, or nothing has changed." />
        ) : (
          <ol className="mt-3 space-y-4 border-l border-[var(--color-border)] pl-4">
            {events.map((e) => (
              // observed_at is NOT NULL on case_status_events; the view type
              // widens it to nullable, but the underlying constraint holds.
              <li key={e.event_id}>
                <p className="text-xs text-[var(--color-text-faint)]">
                  {e.observed_at && new Date(e.observed_at).toLocaleDateString()}
                </p>
                <p className="mt-0.5 text-sm text-[var(--color-text)]">{e.status_text_en}</p>
                {e.status_detail_en && (
                  <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{e.status_detail_en}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
