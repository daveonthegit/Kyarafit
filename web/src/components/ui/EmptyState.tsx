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
  /** "glass" = light-on-glass/photo (200-weight icon, light text); default = cream */
  surface?: "default" | "glass";
  className?: string;
}

/**
 * Reusable empty state block. Uses design-system typography and spacing.
 * Aligns with editorial utility: uppercase meta, clear hierarchy.
 * No card chrome — background comes from the parent surface.
 */
export function EmptyState({
  icon,
  message,
  secondary,
  action,
  surface = "default",
  className = "",
}: EmptyStateProps) {
  const glass = surface === "glass";
  return (
    <div
      className={`flex flex-col items-center justify-center py-16 px-4 text-center ${className}`.trim()}
      role="status"
      aria-live="polite"
    >
      {icon && (
        <span
          className={`material-symbols-outlined text-4xl mb-4 ${
            glass ? "text-media-fg-45" : "text-kyar-textTertiary"
          }`}
          style={
            glass
              ? { fontVariationSettings: '"FILL" 0, "wght" 200, "GRAD" 0, "opsz" 24' }
              : undefined
          }
          aria-hidden
        >
          {icon}
        </span>
      )}
      <p className={`text-sm mb-1 ${glass ? "text-kyar-media-fg" : "text-kyar-textSecondary"}`}>
        {message}
      </p>
      {secondary && (
        <p className={`text-xs mb-4 ${glass ? "text-media-fg-55" : "text-kyar-textTertiary"}`}>
          {secondary}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
