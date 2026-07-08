"use client";

/**
 * Collapsible notice for marketing imagery provenance (landing page footer).
 * Use `embedded` when placed inside a styled footer to avoid double borders/padding.
 */
export function LandingMediaDisclaimer({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? "" : "border-t border-glass-divider-strong"}>
      <details className="group">
        <summary
          className={`flex cursor-pointer list-none items-center justify-between gap-4 text-left [&::-webkit-details-marker]:hidden ${
            embedded ? "py-2" : "px-6 py-4 sm:px-8 lg:px-12"
          }`}
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-media-fg-55">
            Image credits & removal
          </span>
          <span className="material-symbols-outlined text-media-fg-55 transition-transform group-open:rotate-180">
            expand_more
          </span>
        </summary>
        <div
          className={`border-t border-glass-divider pb-6 pt-2 text-sm leading-relaxed text-media-fg-70 ${
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
              className="font-medium text-kyar-media-fg underline underline-offset-2 decoration-glass-border-strong hover:decoration-kyar-media-fg"
            >
              contact us
            </a>{" "}
            and we will take it down promptly.
          </p>
          <p className="mt-4 text-xs text-media-fg-55">
            Assets live under{" "}
            <code className="rounded bg-glass-active px-1 py-0.5 font-mono text-[11px]">
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
