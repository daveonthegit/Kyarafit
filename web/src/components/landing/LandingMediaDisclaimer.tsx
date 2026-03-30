"use client";

/**
 * Collapsible notice for marketing imagery provenance (landing page footer).
 * Use `embedded` when placed inside a styled footer to avoid double borders/padding.
 */
export function LandingMediaDisclaimer({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? "" : "border-t border-kyar-borderSubtle bg-kyar-bgWarm"}>
      <details className="group">
        <summary
          className={`flex cursor-pointer list-none items-center justify-between gap-4 text-left [&::-webkit-details-marker]:hidden ${
            embedded ? "py-2" : "px-6 py-4 sm:px-8 lg:px-12"
          }`}
        >
          <span className="font-sans-wide text-[10px] font-semibold uppercase tracking-widest text-kyar-textTertiary">
            Image credits & removal
          </span>
          <span className="material-symbols-outlined text-kyar-textTertiary transition-transform group-open:rotate-180">
            expand_more
          </span>
        </summary>
        <div
          className={`border-t border-kyar-borderSubtle bg-white pb-6 pt-2 text-sm leading-relaxed text-kyar-textSecondary ${
            embedded ? "px-0" : "px-6 sm:px-8 lg:px-12"
          }`}
        >
          <p className="mb-3">
            Preview images on this marketing page were sourced from Unsplash, stock libraries, and
            other third-party references to illustrate the product. They are not endorsements and
            may depict characters or works owned by their respective rights holders.
          </p>
          <p>
            If you appear in a photo or hold rights to an image used here and would like it removed,{" "}
            <a
              href="mailto:hello@kyarafit.com?subject=Marketing%20image%20removal"
              className="font-medium text-kyar-accent underline underline-offset-2 hover:text-kyar-text"
            >
              contact us
            </a>{" "}
            and we will take it down promptly.
          </p>
          <p className="mt-4 text-xs text-kyar-textTertiary">
            Assets live under{" "}
            <code className="rounded bg-kyar-muted px-1 py-0.5 font-mono text-[11px]">
              web/public/mock
            </code>{" "}
            (subfolders <code className="font-mono">builds</code>,{" "}
            <code className="font-mono">elements</code>,{" "}
            <code className="font-mono">convention</code>
            ).
          </p>
        </div>
      </details>
    </div>
  );
}
