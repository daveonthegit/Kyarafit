"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { getActiveSection, NAV_SECTIONS_BOTTOM } from "@kyarafit/design-system";
import { NAV_ICON_MAP } from "@/lib/navIcons";
import { MobileNavMenu } from "@/components/layout/MobileNavMenu";
import { cn } from "@/lib/utils";

/** Mobile viewport bottom nav: Home, Outfits, Elements, Planner, Menu. */
export function BottomNav({ active, className = "" }: { active?: string; className?: string }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const currentActive = active ?? getActiveSection(pathname ?? null);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <footer
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 bg-glass-bar-on-wall backdrop-blur-glass-bar border-t border-glass-divider-strong text-kyar-media-fg",
          className
        )}
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0.5rem))" }}
      >
        <div className="flex justify-around items-stretch">
          {NAV_SECTIONS_BOTTOM.map((section) => {
            const isMenu = section.id === "menu";
            // Menu is active when the drawer is open
            const isActive = isMenu ? menuOpen : currentActive === section.id;
            const icon = NAV_ICON_MAP[section.id] ?? "circle";
            const label = section.id === "settings" ? t("profile") : t(section.id);

            const content = (
              <>
                <span
                  className={cn(
                    "material-symbols-outlined text-2xl transition-colors mb-0.5",
                    isActive
                      ? "text-kyar-media-fg font-medium"
                      : "text-media-fg-55 group-hover:text-kyar-media-fg font-light"
                  )}
                  aria-hidden
                >
                  {icon}
                </span>
                <span
                  className={cn(
                    "text-[10px] uppercase tracking-[0.16em] transition-colors",
                    isActive
                      ? "font-bold text-kyar-media-fg"
                      : "font-semibold text-media-fg-55 group-hover:text-kyar-media-fg"
                  )}
                >
                  {label}
                </span>
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-7 h-[2px] bg-kyar-media-fg rounded-b-full" />
                )}
              </>
            );

            const commonClasses =
              "group relative flex flex-col items-center justify-center min-h-[56px] min-w-[44px] flex-1 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent hover:bg-glass-active";

            if (isMenu) {
              return (
                <button
                  key={section.id}
                  onClick={() => setMenuOpen(true)}
                  className={commonClasses}
                  aria-label={label}
                  aria-expanded={menuOpen}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={section.id}
                href={section.path}
                className={commonClasses}
                aria-current={isActive ? "page" : undefined}
                aria-label={label}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </footer>
      <MobileNavMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
