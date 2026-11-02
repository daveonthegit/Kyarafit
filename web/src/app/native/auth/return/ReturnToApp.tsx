"use client";

import { useTranslations } from "next-intl";
import { AuthGlassFrame } from "@/components/auth/AuthGlassFrame";

/** Localized body of the native OAuth return fallback (the page itself stays a server component). */
export function ReturnToApp({ appLink }: { appLink: string }) {
  const t = useTranslations("NativeReturn");
  return (
    <AuthGlassFrame icon="open_in_new" eyebrow={t("eyebrow")} title={t("title")}>
      <div className="text-center">
        <p className="mb-8 -mt-2 text-sm text-media-fg-70 leading-relaxed">{t("body")}</p>
        <a
          href={appLink}
          className="block w-full min-h-[44px] rounded-full bg-glass-solid text-glass-ink py-3 text-[10px] uppercase tracking-[0.18em] font-bold hover:opacity-90 transition-opacity text-center"
        >
          {t("open")}
        </a>
      </div>
    </AuthGlassFrame>
  );
}
