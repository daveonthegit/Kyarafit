"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NAV_SECTIONS } from "@kyarafit/design-system";
import { NAV_ICON_MAP } from "@/lib/navIcons";

/**
 * Web-only: sidebar nav for desktop/tablet (lg+). Renders from shared nav config.
 */
export function WebSidebar() {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const active =
    pathname?.startsWith("/builds") ||
    pathname?.startsWith("/build-detail") ||
    pathname?.startsWith("/closet")
      ? "builds"
      : pathname?.startsWith("/conventions") || pathname?.startsWith("/itinerary")
        ? "events"
        : pathname?.startsWith("/planner") || pathname?.startsWith("/packing")
          ? "todo"
          : pathname?.startsWith("/home")
            ? "home"
            : "home";

  return (
    <aside
      className="hidden lg:flex lg:w-64 lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-kyar-borderSubtle lg:bg-kyar-muted/30 lg:sticky lg:top-0 lg:h-screen"
      aria-label="Main navigation"
    >
      <nav className="flex flex-col gap-1 p-4">
        {NAV_SECTIONS.map((section) => {
          const isActive = active === section.id;
          const icon = NAV_ICON_MAP[section.id] ?? "circle";
          return (
            <Link
              key={section.id}
              href={section.path}
              className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive ? "bg-black text-white" : "text-kyar-text hover:bg-kyar-borderSubtle"
              }`}
            >
              <span className="material-symbols-outlined text-xl font-light">{icon}</span>
              <span>{t(section.id)}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
