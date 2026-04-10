"use client";

interface EmptyStateProps {
  /** Optional Material Symbol name (e.g. "image", "checkroom") */
  icon?: string;
  /** Primary message */
  message: string;
  /** Optional secondary line */
  secondary?: string;
  /** Optional CTA node (e.g. Link or button) */
  action?: React.ReactNode;
  className?: string;
}

/**
 * Reusable empty state block. Uses design-system typography and spacing.
 * Aligns with editorial utility: uppercase meta, clear hierarchy.
 * No card chrome — background comes from the parent surface.
 */
export function EmptyState({ icon, message, secondary, action, className = "" }: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      {icon && (
        <span
          className="material-symbols-outlined text-4xl text-kyar-textTertiary mb-4"
          aria-hidden
        >
          {icon}
        </span>
      )}
      <p className="text-sm text-kyar-textSecondary mb-1">{message}</p>
      {secondary && <p className="text-xs text-kyar-textTertiary mb-4">{secondary}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
