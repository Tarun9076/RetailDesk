"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState, type ComponentProps } from "react";

type Props = Omit<ComponentProps<"input">, "type"> & {
  label: string;
  id: string;
  showLabel: string;
  hideLabel: string;
};

/** A password box with an eye button to check what was typed. Same look as Field. */
export function PasswordField({ label, id, showLabel, hideLabel, className = "", ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          {...props}
          type={visible ? "text" : "password"}
          // typed text is not for the browser to correct, capitalise or remember
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={`min-h-14 w-full rounded-xl border border-line bg-bg pl-4 pr-14 text-lg placeholder:text-muted/60 focus:border-accent ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? hideLabel : showLabel}
          aria-pressed={visible}
          className="absolute right-1.5 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-surface hover:text-ink"
        >
          {visible ? <EyeOff size={20} aria-hidden /> : <Eye size={20} aria-hidden />}
        </button>
      </div>
    </div>
  );
}
