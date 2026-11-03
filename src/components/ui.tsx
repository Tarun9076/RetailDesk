import type { ButtonHTMLAttributes, ComponentProps } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

/** 56px tall: comfortable for thumbs on a low-end phone. */
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles =
    variant === "primary"
      ? "bg-accent text-white hover:bg-accent-strong disabled:bg-accent/50"
      : "text-accent hover:bg-accent-soft disabled:text-muted";
  return (
    <button
      {...props}
      className={`min-h-14 w-full rounded-xl px-5 text-base font-medium transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
    />
  );
}

type FieldProps = ComponentProps<"input"> & { label: string; id: string };

export function Field({ label, id, className = "", ...props }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className={`min-h-14 w-full rounded-xl border border-line bg-bg px-4 text-lg placeholder:text-muted/60 focus:border-accent ${className}`}
      />
    </div>
  );
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
      {children}
    </p>
  );
}
