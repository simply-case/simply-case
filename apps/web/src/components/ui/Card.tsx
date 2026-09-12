import type { ElementType, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Renders as a different element (e.g. "li" for CaseCard, which lives in
   * a <ul>) while keeping the same visual treatment. Defaults to "div". */
  as?: ElementType;
}

export function Card({ as: Component = "div", className = "", ...props }: CardProps) {
  return (
    <Component
      className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[0_4px_12px_-4px_rgba(28,27,26,0.08)] dark:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)] ${className}`}
      {...props}
    />
  );
}
