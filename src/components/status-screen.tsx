import type { ReactNode } from "react";

/**
 * A calm full-width message for "this page broke" and "this page does not exist". English first, Hindi
 * underneath, so a shopkeeper who chose Hindi is never left with a screen they cannot read, and the
 * page needs no language lookup that could itself fail while everything else is failing.
 */
export function StatusScreen({
  mark,
  title,
  titleHi,
  hint,
  hintHi,
  reference,
  children,
}: {
  mark: string;
  title: string;
  titleHi: string;
  hint: string;
  hintHi: string;
  reference?: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center sm:py-24">
      <p aria-hidden className="text-6xl font-semibold tracking-tight text-line">
        {mark}
      </p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-muted">{hint}</p>
      <p lang="hi" className="mt-5 text-lg font-medium">
        {titleHi}
      </p>
      <p lang="hi" className="mt-1 text-sm text-muted">
        {hintHi}
      </p>
      <div className="mt-8 flex w-full flex-col gap-3">{children}</div>
      {reference && <p className="mt-6 text-xs text-muted">Reference: {reference}</p>}
    </div>
  );
}

export const primaryLink =
  "flex min-h-14 w-full items-center justify-center rounded-xl bg-accent px-5 text-base font-medium text-white hover:bg-accent-strong";
export const quietLink =
  "flex min-h-12 w-full items-center justify-center rounded-xl border border-line px-5 text-base font-medium text-ink hover:bg-surface";
