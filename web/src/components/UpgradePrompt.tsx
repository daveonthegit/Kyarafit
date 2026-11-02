"use client";

import Link from "next/link";

export interface UpgradePromptProps {
  /** Message shown when the feature is gated (e.g. "Upgrade to Premium Basic to sync across devices"). */
  message: string;
  /** Link target for upgrade/manage plan. Defaults to /settings/subscription. */
  linkHref?: string;
  /** Link label. Defaults to "View plan". */
  linkText?: string;
  /** "glass" = panel-header strip on glass surfaces (icon + text + underline action) */
  surface?: "cream" | "glass";
  /** Optional class name for the container. */
  className?: string;
}

/**
 * Shown when a feature is gated by tier. Displays message and link to subscription page.
 * Use with useFeatureAccess() to show when canUseCloudSync, canExport, etc. are false.
 */
export function UpgradePrompt({
  message,
  linkHref = "/settings/subscription",
  linkText = "View plan",
  surface = "cream",
  className = "",
}: UpgradePromptProps) {
  if (surface === "glass") {
    return (
      <div
        className={`flex items-center gap-3 rounded-[10px] border border-glass-border bg-glass-bar px-4 py-3 text-kyar-media-fg ${className}`}
        role="region"
        aria-label="Upgrade prompt"
      >
        <span className="material-symbols-outlined text-lg text-media-fg-55" aria-hidden>
          cloud_upload
        </span>
        <p className="min-w-0 flex-1 text-[13px] text-media-fg-70">{message}</p>
        <Link
          href={linkHref}
          className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg border-b border-glass-border-strong pb-0.5 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
        >
          {linkText}
        </Link>
      </div>
    );
  }

  return (
    <div
      className={`rounded-sm border border-kyar-borderSubtle bg-kyar-muted p-4 ${className}`}
      role="region"
      aria-label="Upgrade prompt"
    >
      <p className="text-sm text-kyar-text mb-3">{message}</p>
      <Link
        href={linkHref}
        className="text-[11px] uppercase tracking-widest font-semibold text-kyar-accent hover:underline focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 rounded-sm"
      >
        {linkText}
      </Link>
    </div>
  );
}

export interface FeatureGateProps {
  /** Whether the user can use the feature (e.g. from useFeatureAccess().canUseCloudSync). */
  canUseFeature: boolean;
  /** Message shown when gated. */
  message: string;
  /** Link href when gated. Defaults to /settings/subscription. */
  linkHref?: string;
  /** Link text when gated. Defaults to "View plan". */
  linkText?: string;
  /** Rendered when canUseFeature is true. */
  children: React.ReactNode;
  /** Optional class for the UpgradePrompt when gated. */
  className?: string;
}

/**
 * Renders children when the user has access; otherwise shows UpgradePrompt.
 * Use for gated sections (e.g. sync, export).
 */
export function FeatureGate({
  canUseFeature,
  message,
  linkHref,
  linkText,
  children,
  className,
}: FeatureGateProps) {
  if (canUseFeature) return <>{children}</>;
  return (
    <UpgradePrompt
      message={message}
      linkHref={linkHref}
      linkText={linkText}
      className={className}
    />
  );
}
