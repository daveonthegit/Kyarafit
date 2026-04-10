"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getActiveSection,
  NAV_SECTIONS_PRIMARY,
  NAV_SECTION_SETTINGS,
} from "@kyarafit/design-system";
import { NAV_ICON_MAP } from "@/lib/navIcons";
import { Sheet } from "@/components/ui/sheet";
import { SidebarUserProfile } from "@/components/layout/SidebarUserProfile";
import { cn } from "@/lib/utils";

interface MobileNavMenuProps {
  open: boolean;
  onClose: () => void;
}

export function MobileNavMenu({ open, onClose }: MobileNavMenuProps) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const active = getActiveSection(pathname ?? null);

  return (
    <Sheet open={open} onClose={onClose} title="Menu" size="sm">
      <div className="flex flex-col h-full -mx-6 -my-6 bg-kyar-bg">
        <nav className="flex flex-col gap-2 p-4 pt-6 flex-1 overflow-y-auto">
          {NAV_SECTIONS_PRIMARY.map((section) => {
            const isActive = active === section.id;
            const icon = NAV_ICON_MAP[section.id] ?? "circle";
            return (
              <Link
                key={section.id}
                href={section.path}
                onClick={onClose}
                className="group relative flex items-center min-h-[44px] gap-4 px-4 transition-[padding,gap] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bg rounded-sm hover:bg-kyar-muted"
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-[20px] transition-colors shrink-0",
                    isActive
                      ? "text-kyar-text font-medium"
                      : "text-kyar-meta group-hover:text-kyar-text font-light"
                  )}
                  aria-hidden
                >
                  {icon}
                </span>
                <span className="relative flex flex-col overflow-hidden whitespace-nowrap min-w-0">
                  <span
                    className={cn(
                      "text-[11px] uppercase tracking-[0.25em] transition-colors",
                      isActive
                        ? "font-bold text-kyar-text"
                        : "font-semibold text-kyar-meta group-hover:text-kyar-text"
                    )}
                  >
                    {t(section.id)}
                  </span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 w-full h-[1.5px] bg-kyar-text rounded-full" />
                  )}
                </span>
              </Link>
            );
          })}

          <div className="my-6 mx-4 border-t border-kyar-borderSubtle" aria-hidden />

          {(() => {
            const section = NAV_SECTION_SETTINGS;
            const isActive = active === section.id;
            const icon = NAV_ICON_MAP[section.id] ?? "circle";
            return (
              <Link
                href={section.path}
                onClick={onClose}
                className="group relative flex items-center min-h-[44px] gap-4 px-4 transition-[padding,gap] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bg rounded-sm hover:bg-kyar-muted"
              >
                <span
                  className={cn(
                    "material-symbols-outlined text-[20px] transition-colors shrink-0",
                    isActive
                      ? "text-kyar-text font-medium"
                      : "text-kyar-meta group-hover:text-kyar-text font-light"
                  )}
                  aria-hidden
                >
                  {icon}
                </span>
                <span className="relative flex flex-col overflow-hidden whitespace-nowrap min-w-0">
                  <span
                    className={cn(
                      "text-[11px] uppercase tracking-[0.25em] transition-colors",
                      isActive
                        ? "font-bold text-kyar-text"
                        : "font-semibold text-kyar-meta group-hover:text-kyar-text"
                    )}
                  >
                    {t(section.id)}
                  </span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 w-full h-[1.5px] bg-kyar-text rounded-full" />
                  )}
                </span>
              </Link>
            );
          })()}

          <div className="mt-auto pt-8 mb-4 px-4">
            <SidebarUserProfile collapsed={false} />
          </div>
        </nav>
      </div>
    </Sheet>
  );
}
