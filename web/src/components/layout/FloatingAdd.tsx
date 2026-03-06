"use client";

import { useTranslations } from "next-intl";
import { AddContextMenu } from "@/components/layout/AddContextMenu";

/**
 * Mobile FAB that opens Add context menu (Add outfit / Add item / Add event).
 * Hidden on lg+ (desktop uses WebTopBar Add).
 */
export function FloatingAdd({ className = "" }: { className?: string }) {
  const t = useTranslations("Common");

  return (
    <div
      className={`fixed bottom-28 right-6 z-50 lg:hidden ${className}`.trim()}
      aria-label={t("add")}
    >
      <AddContextMenu
        variant="fab"
        align="bottom-right"
        trigger={
          <span className="flex h-14 w-14 items-center justify-center">
            <span className="material-symbols-outlined font-light text-2xl">add</span>
          </span>
        }
      />
    </div>
  );
}
