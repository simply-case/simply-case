import { classifyStatus, statusLabels } from "@mycasepro/shared";

const STATUS_VARS: Record<string, string> = {
  pending: "pending",
  inProgress: "inprogress",
  actionNeeded: "actionneeded",
  approved: "approved",
  denied: "denied",
  unknown: "unknown",
};

/**
 * Mirrors apps/mobile/components/ui/StatusPill.tsx — the single most
 * important visual decision in this app, kept consistent across both
 * platforms. Renders the fixed StatusClass label (see
 * packages/shared/src/status.ts), never the raw provider text; color is
 * reinforcement, the label text is what actually carries the meaning.
 */
export function StatusPill({ statusText, size = "md" }: { statusText: string | null | undefined; size?: "sm" | "md" }) {
  const cls = classifyStatus(statusText);
  const key = STATUS_VARS[cls];
  const isSmall = size === "sm";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${isSmall ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-xs"}`}
      style={{
        color: `var(--status-${key}-fg)`,
        backgroundColor: `var(--status-${key}-bg)`,
      }}
    >
      {statusLabels[cls]}
    </span>
  );
}
