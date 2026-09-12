/**
 * CSS-only pulse (Tailwind's animate-pulse), unlike mobile's Skeleton which
 * needs the Animated API — the web platform gets this for free. Respects
 * prefers-reduced-motion globally via globals.css.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-[var(--color-surface-muted)] ${className}`} />;
}

/** Case-list loading state — mirrors apps/mobile/components/ui/Skeleton.tsx's
 * CaseListSkeleton so both platforms show the same shape while loading. */
export function CaseListSkeleton() {
  return (
    <div className="mt-3 space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2 rounded-lg border border-[var(--color-border)] p-4">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-1/3" />
          <Skeleton className="mt-1 h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function CaseDetailSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-16 rounded-lg" />
      <Skeleton className="h-16 rounded-lg" />
    </div>
  );
}
