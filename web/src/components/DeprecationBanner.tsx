"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

/** localStorage key; bump the suffix to show the banner again after a copy change. */
export const DEPRECATION_BANNER_STORAGE_KEY = "kyar-deprecation-banner-dismissed-v1";

/** Set on <html> by the inline head script so a dismissed banner never flashes. */
export const DEPRECATION_BANNER_DISMISSED_ATTR = "data-deprecation-banner-dismissed";

/**
 * Inline <head> script: hides the banner before first paint when this browser dismissed it.
 * Storage access is wrapped because it can throw (private mode, blocked site data).
 */
export const DEPRECATION_BANNER_HEAD_SCRIPT = `(function(){try{if(localStorage.getItem('${DEPRECATION_BANNER_STORAGE_KEY}')==='1'){document.documentElement.setAttribute('${DEPRECATION_BANNER_DISMISSED_ATTR}','');}}catch(e){}})();`;

export function DeprecationBanner() {
  const t = useTranslations("DeprecationBanner");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DEPRECATION_BANNER_STORAGE_KEY, "1");
      document.documentElement.setAttribute(DEPRECATION_BANNER_DISMISSED_ATTR, "");
    } catch {
      // Storage unavailable: hide for this page view only.
    }
  };

  return (
    <div
      role="region"
      aria-label={t("label")}
      className="deprecation-banner relative flex items-start gap-2 border-b border-glass-divider-strong bg-glass-bar-on-wall py-2.5 pl-4 pr-1 text-kyar-media-fg shadow-glass-overlay backdrop-blur-glass-bar sm:pl-6 sm:pr-3"
    >
      <span className="material-symbols-outlined mt-1.5 text-lg text-media-fg-55" aria-hidden>
        campaign
      </span>
      <p className="min-w-0 flex-1 py-1.5 text-[13px] leading-snug text-media-fg-70">
        <strong className="font-semibold text-kyar-media-fg">{t("title")}</strong> {t("body")}
      </p>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label={t("dismiss")}
        className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-media-fg-70 transition-opacity hover:text-kyar-media-fg hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
      >
        <span className="material-symbols-outlined text-xl" aria-hidden>
          close
        </span>
      </button>
    </div>
  );
}
