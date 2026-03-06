"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { getActiveSection, NAV_SECTIONS_BOTTOM } from "@kyarafit/design-system";
import { NAV_ICON_MAP } from "@/lib/navIcons";

/** Mobile bottom nav: Home, Outfits, Closet, Events, Profile. Uses shared nav config. */
export function BottomNav({ active, className = "" }: { active?: string; className?: string }) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const currentActive = active ?? getActiveSection(pathname ?? null);

  return (
    <footer
      className={`fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-t border-kyar-borderSubtle pb-8 pt-3 ${className}`.trim()}
    >
      <div className="flex justify-around items-center px-4">
        {NAV_SECTIONS_BOTTOM.map((section) => {
          const isActive = currentActive === section.id;
          const icon = NAV_ICON_MAP[section.id] ?? "circle";
          const label = section.id === "settings" ? t("profile") : t(section.id);
          return (
            <Link
              key={section.id}
              href={section.path}
              className={`flex flex-col items-center gap-1 transition-opacity ${isActive ? "opacity-100" : "opacity-30"} hover:opacity-100`}
            >
              <span className="material-symbols-outlined text-2xl font-light">{icon}</span>
              <span className="text-[9px] font-semibold uppercase tracking-widest">{label}</span>
              {isActive && <div className="w-1 h-1 bg-black rounded-full mt-0.5" />}
            </Link>
          );
        })}
      </div>
    </footer>
  );
}
