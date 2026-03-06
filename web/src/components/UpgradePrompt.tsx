"use client";

import Link from "next/link";

export interface UpgradePromptProps {
  /** Message shown when the feature is gated (e.g. "Upgrade to Premium Basic to sync across devices"). */
  message: string;
  /** Link target for upgrade/manage plan. Defaults to /settings/subscription. */
  linkHref?: string;
  /** Link label. Defaults to "View plan". */
  linkText?: string;
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
  className = "",
}: UpgradePromptProps) {
  return (
    <div
      className={`rounded border border-kyar-accent/30 bg-kyar-accent/5 p-4 ${className}`}
      role="region"
      aria-label="Upgrade prompt"
    >
      <p className="text-sm text-kyar-text mb-2">{message}</p>
      <Link
        href={linkHref}
        className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2 rounded"
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
