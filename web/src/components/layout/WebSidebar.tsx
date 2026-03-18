"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  getActiveSection,
  NAV_SECTIONS_PRIMARY,
  NAV_SECTION_SETTINGS,
} from "@kyarafit/design-system";
import { NAV_ICON_MAP } from "@/lib/navIcons";

const STORAGE_KEY = "kyar-sidebar-collapsed";

/**
 * Web-only: sidebar nav for desktop/tablet (lg+). Collapsible to icon-only. Primary nav, divider, then Settings.
 */
export function WebSidebar() {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const active = getActiveSection(pathname ?? null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setCollapsed(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <aside
      className={`hidden lg:flex lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-kyar-cardBorder lg:bg-kyar-bgWarm lg:sticky lg:top-0 lg:h-screen transition-[width] duration-200 ease-out ${
        collapsed ? "lg:w-[4.5rem]" : "lg:w-64"
      }`}
      aria-label="Main navigation"
    >
      <div
        className={`flex items-center border-b border-kyar-cardBorder min-h-[3.5rem] ${collapsed ? "justify-center p-2" : "p-4"}`}
      >
        <Link
          href="/home"
          className={`font-serif font-bold italic tracking-tight text-kyar-text block py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm rounded overflow-hidden ${
            collapsed ? "text-base w-9 text-center" : "text-lg"
          }`}
          title="Kyarafit"
        >
          {collapsed ? "K" : "Kyarafit"}
        </Link>
      </div>
      <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-hidden">
        {NAV_SECTIONS_PRIMARY.map((section) => {
          const isActive = active === section.id;
          const icon = NAV_ICON_MAP[section.id] ?? "circle";
          return (
            <Link
              key={section.id}
              href={section.path}
              title={collapsed ? t(section.id) : undefined}
              className={`flex items-center rounded-sm py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                collapsed ? "justify-center px-0 w-full" : "gap-3 px-3"
              } ${
                isActive
                  ? "bg-black text-white"
                  : "text-kyar-text hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
              }`}
            >
              <span className="material-symbols-outlined text-xl font-light shrink-0" aria-hidden>
                {icon}
              </span>
              {!collapsed && <span className="truncate">{t(section.id)}</span>}
            </Link>
          );
        })}
        <div className="my-2 border-t border-kyar-cardBorder" aria-hidden />
        {(() => {
          const section = NAV_SECTION_SETTINGS;
          const isActive = active === section.id;
          const icon = NAV_ICON_MAP[section.id] ?? "circle";
          return (
            <Link
              href={section.path}
              title={collapsed ? t(section.id) : undefined}
              className={`flex items-center rounded-sm py-2.5 text-sm font-medium transition-colors min-h-[44px] ${
                collapsed ? "justify-center px-0 w-full" : "gap-3 px-3"
              } ${
                isActive
                  ? "bg-black text-white"
                  : "text-kyar-text hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
              }`}
            >
              <span className="material-symbols-outlined text-xl font-light shrink-0" aria-hidden>
                {icon}
              </span>
              {!collapsed && <span className="truncate">{t(section.id)}</span>}
            </Link>
          );
        })()}
      </nav>
      <div className="p-2 border-t border-kyar-cardBorder">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="min-h-[44px] w-full flex items-center justify-center rounded-sm text-kyar-text hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span
            className="material-symbols-outlined text-xl transition-transform duration-200"
            aria-hidden
            style={{ transform: collapsed ? "rotate(180deg)" : undefined }}
          >
            chevron_left
          </span>
        </button>
      </div>
    </aside>
  );
}
