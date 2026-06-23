"use client";

import { useEffect, useRef } from "react";

export interface SignOutConfirmDialogProps {
  /** Dialog heading. */
  title: string;
  /** Body copy warning the user to export their local data first. */
  description: string;
  /** Label for the confirm (proceed to sign out) action. */
  confirmLabel: string;
  /** Label for the cancel action. */
  cancelLabel: string;
  /** Called when the user confirms sign-out. */
  onConfirm: () => void;
  /** Called when the user dismisses the dialog without signing out. */
  onCancel: () => void;
}

/**
 * Accessible confirmation step shown before a free user signs out (REQ-031). Reminds the user that
 * their data is local-first and should be exported before the session is cleared. Sign-out only
 * proceeds when the user explicitly confirms.
 */
export function SignOutConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: SignOutConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmRef.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-kyar-text/40 p-4"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sign-out-dialog-title"
        aria-describedby="sign-out-dialog-description"
        className="w-full max-w-md rounded-sm border border-kyar-cardBorder bg-kyar-surface p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="sign-out-dialog-title"
          className="text-sm font-semibold uppercase tracking-widest text-kyar-text"
        >
          {title}
        </h2>
        <p id="sign-out-dialog-description" className="mt-3 text-sm text-kyar-textSecondary">
          {description}
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-full border border-kyar-borderSubtle bg-kyar-surface px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-kyar-text transition-colors hover:bg-kyar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] rounded-full border border-kyar-danger px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-kyar-danger transition-colors hover:bg-kyar-danger/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
