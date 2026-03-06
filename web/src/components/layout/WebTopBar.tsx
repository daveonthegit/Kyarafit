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
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-kyar-borderSubtle bg-white/95 px-4 backdrop-blur-sm lg:px-6">
      <Link href="/home" className="font-serif text-lg font-bold italic tracking-tight">
        Kyarafit
      </Link>
      <div className="flex items-center gap-2">
        <AddContextMenu
          align="right"
          trigger={
            <>
              <span className="material-symbols-outlined text-lg font-light">add</span>
              {t("add")}
            </>
          }
        />
      </div>
    </header>
  );
}
