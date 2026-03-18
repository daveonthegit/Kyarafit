"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { getActiveSection, NAV_SECTIONS_BOTTOM } from "@kyarafit/design-system";
import { NAV_ICON_MAP } from "@/lib/navIcons";

/** Mobile viewport bottom nav: Home, Outfits, Planner, Events, Profile. Uses shared nav config. */
export function BottomNav({ active, className = "" }: { active?: string; className?: string }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const currentActive = active ?? getActiveSection(pathname ?? null);

  return (
    <footer
      className={`fixed bottom-0 left-0 right-0 z-50 bg-kyar-bgWarm/95 backdrop-blur-md border-t border-kyar-cardBorder pt-2 ${className}`.trim()}
      style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0.5rem))" }}
    >
      <div className="flex justify-around items-stretch px-2">
        {NAV_SECTIONS_BOTTOM.map((section) => {
          const isActive = currentActive === section.id;
          const icon = NAV_ICON_MAP[section.id] ?? "circle";
          const label = section.id === "settings" ? t("profile") : t(section.id);
          return (
            <Link
              key={section.id}
              href={section.path}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] flex-1 py-2 rounded-sm transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm ${
                isActive ? "opacity-100" : "opacity-30"
              } hover:opacity-100`}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
            >
              <span className="material-symbols-outlined text-2xl font-light" aria-hidden>
                {icon}
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-widest">{label}</span>
              {isActive && <div className="w-1 h-1 bg-black rounded-full mt-0.5" aria-hidden />}
            </Link>
          );
        })}
      </div>
    </footer>
  );
}
