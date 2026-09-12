import { CaseListSkeleton } from "@/components/ui";

/**
 * Next.js route-level loading UI — shown automatically while page.tsx's
 * server component awaits its Supabase queries. Previously there was no
 * loading state at all on web (the page just appeared blank until data
 * resolved); this is the direct counterpart to mobile's CaseListSkeleton.
 */
export default function Loading() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="h-6 w-28 animate-pulse rounded bg-[var(--color-surface-muted)]" />
      <div className="mt-2 h-4 w-40 animate-pulse rounded bg-[var(--color-surface-muted)]" />
      <div className="mt-6 h-40 animate-pulse rounded-2xl bg-[var(--color-surface-muted)]" />
      <CaseListSkeleton />
    </main>
  );
}
