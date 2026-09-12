import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, id, className = "", ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text-muted)]">
          {label}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error && inputId ? `${inputId}-error` : undefined}
        className={`w-full rounded-[10px] border px-3 py-2.5 text-sm text-[var(--color-text)] bg-[var(--color-surface)] outline-none transition-colors placeholder:text-[var(--color-text-faint)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] ${
          error ? "border-[var(--color-danger)]" : "border-[var(--color-border)] focus:border-[var(--color-accent)]"
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={inputId ? `${inputId}-error` : undefined} role="alert" className="text-xs text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </div>
  );
});
