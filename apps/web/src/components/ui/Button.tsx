import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
}

/**
 * The one button every screen uses, mirroring apps/mobile/components/ui/Button.tsx
 * so the two platforms read as the same product. focus-visible ring (not
 * plain focus) is deliberate — Phase D3's a11y pass: a visible ring for
 * keyboard users, no distracting ring on a mouse click.
 */
export function Button({ variant = "primary", className = "", disabled, children, ...props }: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-[10px] px-4 py-2.5 text-sm font-semibold transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: Record<string, string> = {
    primary: "bg-[var(--color-accent)] text-[var(--color-accent-text)] hover:opacity-90 focus-visible:ring-[var(--color-accent)]",
    secondary:
      "bg-[var(--color-surface-muted)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-border)]/40 focus-visible:ring-[var(--color-accent)]",
    ghost: "text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus-visible:ring-[var(--color-accent)]",
  };

  return (
    <button disabled={disabled} className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
