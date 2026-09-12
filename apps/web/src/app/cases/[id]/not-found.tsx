import Link from "next/link";
import { EmptyState } from "@/components/ui";

/**
 * Next.js route-level not-found UI, triggered by notFound() in page.tsx.
 * Previously fell through to Next's unstyled default page — themed to
 * match the rest of the app instead.
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/" className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
        ← All cases
      </Link>
      <EmptyState title="Case not found" message="It may have been removed, or the link is out of date." />
    </main>
  );
}
