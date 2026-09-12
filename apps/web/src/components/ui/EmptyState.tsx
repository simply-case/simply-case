export function EmptyState({ title, message }: { title: string; message?: string }) {
  return (
    <div className="flex flex-col items-center py-16 px-4 text-center">
      <p className="text-sm font-semibold text-[var(--color-text)]">{title}</p>
      {message && <p className="mt-1 max-w-xs text-sm text-[var(--color-text-muted)]">{message}</p>}
    </div>
  );
}
