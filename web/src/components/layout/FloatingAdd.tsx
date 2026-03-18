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
      className={`fixed right-4 z-40 lg:hidden ${className}`.trim()}
      style={{
        bottom: "calc(4.5rem + env(safe-area-inset-bottom, 0px))",
      }}
      aria-label={t("add")}
    >
      <AddContextMenu
        variant="fab"
        align="bottom-right"
        trigger={
          <span className="flex h-14 w-14 min-h-[44px] min-w-[44px] items-center justify-center rounded-sm transition-transform hover:scale-105 focus-within:scale-105 active:scale-95">
            <span className="material-symbols-outlined font-light text-2xl" aria-hidden>
              add
            </span>
          </span>
        }
      />
    </div>
  );
}
