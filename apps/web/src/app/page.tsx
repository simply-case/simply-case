import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AddCaseForm } from "@/components/AddCaseForm";
import { CaseCard } from "@/components/CaseCard";
import { EmptyState } from "@/components/ui";
import { signOut } from "@/app/cases/actions";

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Reads through my_case_details, never tracked_cases directly — the view
  // is already scoped to this user's own subscriptions (see 0002_rls.sql),
  // so there's no need to filter by user here.
  const { data: cases, error } = await supabase
    .from("my_case_details")
    .select("*")
    .order("subscribed_at", { ascending: false });

  const active = (cases ?? []).filter((c) => c.archived_at === null);
  const archived = (cases ?? []).filter((c) => c.archived_at !== null);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[var(--color-text)]">mycase pro</h1>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] rounded"
          >
            Sign out
          </button>
        </form>
      </div>
      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{user.email}</p>

      <div className="mt-6">
        <AddCaseForm />
      </div>

      {error && <p className="mt-6 text-sm text-[var(--color-danger)]">Couldn&apos;t load your cases.</p>}

      <section className="mt-8">
        <h2 className="text-sm font-medium text-[var(--color-text)]">
          Your cases {active.length > 0 && `(${active.length})`}
        </h2>
        {active.length === 0 ? (
          <EmptyState
            title="No cases yet"
            message="Add a USCIS receipt number above to start tracking its status."
          />
        ) : (
          <ul className="mt-3 space-y-3">
            {active.map((c) => (
              <CaseCard key={c.user_case_id} c={c} />
            ))}
          </ul>
        )}
      </section>

      {archived.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-medium text-[var(--color-text)]">Archived ({archived.length})</h2>
          <ul className="mt-3 space-y-3">
            {archived.map((c) => (
              <CaseCard key={c.user_case_id} c={c} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
