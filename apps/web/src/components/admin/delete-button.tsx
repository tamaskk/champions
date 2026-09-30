"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const UNDO_SECONDS = 5;

/**
 * Delete button for a Server Action form: asks for confirmation, then waits UNDO_SECONDS with an
 * Undo button before it submits the surrounding form.
 */
export function DeleteButton({
  confirmText,
  label,
  title,
  children,
}: {
  confirmText: string;
  /** Accessible name of the button. */
  label: string;
  title?: string;
  children: ReactNode;
}) {
  const [left, setLeft] = useState<number | null>(null);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (left === null) return;
    const timer = setTimeout(() => {
      if (left > 1) setLeft(left - 1);
      else ref.current?.form?.requestSubmit();
    }, 1000);
    return () => clearTimeout(timer);
  }, [left]);

  if (left !== null)
    return (
      <span className="inline-flex items-center gap-2 text-xs text-muted">
        Deleting in {left}s
        <button
          type="button"
          onClick={() => setLeft(null)}
          className="rounded-lg bg-rose-50 px-2.5 py-1 font-medium text-rose-600 hover:bg-rose-100"
        >
          Undo
        </button>
        {/* Keeps the form reachable for requestSubmit while the trash button is hidden. */}
        <button ref={ref} type="submit" hidden aria-hidden tabIndex={-1} />
      </span>
    );

  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      onClick={() => {
        if (window.confirm(confirmText)) setLeft(UNDO_SECONDS);
      }}
      className="rounded-lg p-2 text-muted hover:bg-rose-50 hover:text-rose-500"
    >
      {children}
    </button>
  );
}
