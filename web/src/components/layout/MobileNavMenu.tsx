"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  getActiveSection,
  NAV_SECTIONS_PRIMARY,
  NAV_SECTION_SETTINGS,
  type NavSection,
} from "@kyarafit/design-system";
import { NAV_ICON_MAP } from "@/lib/navIcons";
import { Sheet } from "@/components/ui/sheet";
import { SidebarUserProfile } from "@/components/layout/SidebarUserProfile";
import { cn } from "@/lib/utils";

interface MobileNavMenuProps {
  open: boolean;
  onClose: () => void;
}

function DrawerNavLink({
  section,
  isActive,
  label,
  onClose,
}: {
  section: NavSection;
  isActive: boolean;
  label: string;
  onClose: () => void;
}) {
  const icon = NAV_ICON_MAP[section.id] ?? "circle";
  return (
    <Link
      href={section.path}
      onClick={onClose}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center min-h-[44px] gap-4 px-4 py-3 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent",
        isActive ? "bg-glass-bar" : "hover:bg-glass-active"
      )}
    >
      <span
        className={cn(
          "material-symbols-outlined text-[20px] shrink-0 transition-colors",
          isActive ? "text-kyar-media-fg" : "text-media-fg-55"
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span
        className={cn(
          "text-[11px] uppercase tracking-[0.22em] transition-colors",
          isActive ? "font-bold text-kyar-media-fg" : "font-semibold text-media-fg-70"
        )}
      >
        {label}
      </span>
    </Link>
  );
}

/** v2 mobile menu: right-side glass drawer over the dimmed screen (ref 13e). */
export function MobileNavMenu({ open, onClose }: MobileNavMenuProps) {
  const pathname = usePathname();
  const t = useTranslations("Nav");
  const active = getActiveSection(pathname ?? null);

  return (
    <Sheet open={open} onClose={onClose} title="Menu" size="sm" surface="glass">
      <div className="flex flex-col h-full -mx-6 -my-6">
        <nav className="flex flex-col gap-0.5 p-2.5 pt-4 flex-1 overflow-y-auto">
          {NAV_SECTIONS_PRIMARY.map((section) => (
            <DrawerNavLink
              key={section.id}
              section={section}
              isActive={active === section.id}
              label={t(section.id)}
              onClose={onClose}
            />
          ))}

          <div className="my-3.5 mx-4 h-px bg-glass-divider-strong" aria-hidden />

          <DrawerNavLink
            section={NAV_SECTION_SETTINGS}
            isActive={active === NAV_SECTION_SETTINGS.id}
            label={t(NAV_SECTION_SETTINGS.id)}
            onClose={onClose}
          />
        </nav>

        <div className="shrink-0 border-t border-glass-divider-strong px-4 py-3">
          <SidebarUserProfile collapsed={false} surface="glass" />
        </div>
      </div>
    </Sheet>
  );
}
