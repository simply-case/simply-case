import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
      <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← All cases
      </Link>

      <h1 className="mt-2 text-xl font-semibold text-neutral-900">
        {caseDetail.nickname || caseDetail.case_key}
      </h1>
      <p className="mt-0.5 text-xs uppercase tracking-wide text-neutral-500">
        {caseDetail.provider} · {caseDetail.case_key}
        {caseDetail.form_type && ` · ${caseDetail.form_type}`}
      </p>

      <div className="mt-6 rounded-lg border border-neutral-200 p-4">
        <p className="text-sm font-medium text-neutral-900">
          {caseDetail.status_text_en ?? "Pending first check…"}
        </p>
        {caseDetail.status_detail_en && (
          <p className="mt-2 text-sm text-neutral-600">{caseDetail.status_detail_en}</p>
        )}
        {caseDetail.last_checked_at && (
          <p className="mt-3 text-xs text-neutral-400">
            Last checked {new Date(caseDetail.last_checked_at).toLocaleString()}
          </p>
        )}
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-neutral-900">History</h2>
        {!events || events.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No history yet.</p>
        ) : (
          <ol className="mt-3 space-y-4 border-l border-neutral-200 pl-4">
            {events.map((e) => (
              // observed_at is NOT NULL on case_status_events; the view type
              // widens it to nullable, but the underlying constraint holds.
              <li key={e.event_id}>
                <p className="text-xs text-neutral-400">
                  {e.observed_at && new Date(e.observed_at).toLocaleDateString()}
                </p>
                <p className="mt-0.5 text-sm text-neutral-800">{e.status_text_en}</p>
                {e.status_detail_en && (
                  <p className="mt-0.5 text-sm text-neutral-500">{e.status_detail_en}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}
