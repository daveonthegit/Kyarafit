"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AddContextMenu } from "@/components/layout/AddContextMenu";

/**
 * Web-only: top bar for desktop/tablet. Logo, Add context menu.
 * Settings moved to sidebar.
 */
export function WebTopBar() {
  const t = useTranslations("Common");

  return (
    <header className="sticky top-0 z-40 flex h-14 min-h-[44px] items-center justify-between border-b border-kyar-cardBorder bg-kyar-bgWarm/95 px-4 backdrop-blur-sm lg:px-6">
      <Link
        href="/home"
        className="font-serif text-lg font-bold italic tracking-tight text-kyar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm rounded min-h-[44px] min-w-[44px] flex items-center"
        aria-label="Kyarafit home"
      >
        Kyarafit
      </Link>
      <div className="flex items-center gap-2">
        <AddContextMenu
          align="right"
          trigger={
            <>
              <span className="material-symbols-outlined text-lg font-light" aria-hidden>
                add
              </span>
              <span>{t("add")}</span>
            </>
          }
        />
      </div>
    </header>
  );
}
