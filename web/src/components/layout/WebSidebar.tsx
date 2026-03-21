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
import { SidebarUserProfile } from "@/components/layout/SidebarUserProfile";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "kyar-sidebar-collapsed";

const navLabelClass = (collapsed: boolean) =>
  cn(
    "relative flex flex-col overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] min-w-0",
    collapsed ? "max-w-0 opacity-0" : "max-w-[220px] opacity-100 delay-75"
  );

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
      className={cn(
        "hidden lg:flex lg:flex-shrink-0 lg:flex-col lg:border-r lg:border-kyar-borderSubtle bg-[#F4F4F4] lg:sticky lg:top-0 lg:h-screen overflow-hidden",
        "transition-[width] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
        collapsed ? "lg:w-[4.5rem]" : "lg:w-[260px]"
      )}
      aria-label="Main navigation"
    >
      <div
        className={cn(
          "flex flex-col min-h-[5.5rem] pt-8 pb-4 transition-[padding] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
          collapsed ? "items-center px-2" : "px-8"
        )}
      >
        <Link
          href="/home"
          className={cn(
            "relative flex items-center font-serif text-[22px] font-normal italic tracking-tight text-kyar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F4F4] rounded min-h-[28px]",
            collapsed ? "w-9 justify-center" : "justify-start"
          )}
          title="Kyarafit"
        >
          <span
            className={cn(
              "absolute inset-0 flex items-center justify-center transition-opacity duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
              collapsed ? "opacity-100 delay-75" : "opacity-0 pointer-events-none"
            )}
            aria-hidden={!collapsed}
          >
            K
          </span>
          <span
            className={cn(
              "whitespace-nowrap transition-opacity duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
              collapsed ? "opacity-0 pointer-events-none" : "opacity-100 delay-75"
            )}
          >
            Kyarafit
          </span>
        </Link>
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
            collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
          )}
        >
          <div className="overflow-hidden min-h-0">
            <div className="flex flex-col gap-1 pt-6">
              <span className="font-serif-elegant text-[15px] font-medium text-kyar-text">
                Kyarafit
              </span>
              <span className="text-[9px] font-bold uppercase tracking-[0.25em] text-kyar-meta">
                Cosplay Planner
              </span>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex flex-col gap-2 p-4 pt-4 flex-1 overflow-y-auto overflow-x-hidden">
        {NAV_SECTIONS_PRIMARY.map((section) => {
          const isActive = active === section.id;
          const icon = NAV_ICON_MAP[section.id] ?? "circle";
          return (
            <Link
              key={section.id}
              href={section.path}
              title={collapsed ? t(section.id) : undefined}
              className={cn(
                "group flex items-center min-h-[36px] transition-[padding,gap] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F4F4] rounded-sm",
                collapsed ? "justify-center gap-0 px-0 w-full" : "gap-4 px-4"
              )}
            >
              <span
                className={`material-symbols-outlined text-[18px] transition-colors shrink-0 ${
                  isActive
                    ? "text-black font-medium"
                    : "text-kyar-meta group-hover:text-black font-light"
                }`}
                aria-hidden
              >
                {icon}
              </span>
              <span className={navLabelClass(collapsed)} aria-hidden={collapsed}>
                <span
                  className={`text-[10px] uppercase tracking-[0.25em] transition-colors ${
                    isActive
                      ? "font-bold text-black"
                      : "font-semibold text-kyar-meta group-hover:text-black"
                  }`}
                >
                  {t(section.id)}
                </span>
                {isActive && (
                  <span className="absolute -bottom-1 left-0 w-full h-[1.5px] bg-black rounded-full" />
                )}
              </span>
            </Link>
          );
        })}

        <div
          className={cn(
            "my-6 border-t border-black/[0.06] transition-[margin] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
            collapsed ? "mx-2" : "mx-4"
          )}
          aria-hidden
        />

        {(() => {
          const section = NAV_SECTION_SETTINGS;
          const isActive = active === section.id;
          const icon = NAV_ICON_MAP[section.id] ?? "circle";
          return (
            <Link
              href={section.path}
              title={collapsed ? t(section.id) : undefined}
              className={cn(
                "group flex items-center min-h-[36px] transition-[padding,gap] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F4F4] rounded-sm",
                collapsed ? "justify-center gap-0 px-0 w-full" : "gap-4 px-4"
              )}
            >
              <span
                className={`material-symbols-outlined text-[18px] transition-colors shrink-0 ${
                  isActive
                    ? "text-black font-medium"
                    : "text-kyar-meta group-hover:text-black font-light"
                }`}
                aria-hidden
              >
                {icon}
              </span>
              <span className={navLabelClass(collapsed)} aria-hidden={collapsed}>
                <span
                  className={`text-[10px] uppercase tracking-[0.25em] transition-colors ${
                    isActive
                      ? "font-bold text-black"
                      : "font-semibold text-kyar-meta group-hover:text-black"
                  }`}
                >
                  {t(section.id)}
                </span>
                {isActive && (
                  <span className="absolute -bottom-1 left-0 w-full h-[1.5px] bg-black rounded-full" />
                )}
              </span>
            </Link>
          );
        })()}

        <div
          className={cn(
            "mt-auto mb-4 transition-[padding] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none",
            collapsed ? "px-2" : "px-4"
          )}
        >
          <SidebarUserProfile collapsed={collapsed} />
        </div>
      </nav>

      <div className="p-2 border-t border-black/[0.06]">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="min-h-[44px] w-full flex items-center justify-center rounded-sm text-kyar-meta hover:text-black hover:bg-black/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4F4F4]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span
            className="material-symbols-outlined text-lg transition-transform duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none"
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
