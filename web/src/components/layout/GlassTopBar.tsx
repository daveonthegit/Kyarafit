"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import {
  getActiveSection,
  getPrimaryAddMenuItem,
  ADD_MENU_ITEMS,
  NAV_SECTIONS_TOPBAR_PRIMARY,
  NAV_SECTIONS_TOPBAR_SOCIAL,
  NAV_SECTION_SETTINGS,
  type NavSection,
} from "@kyarafit/design-system";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { SidebarUserProfile } from "@/components/layout/SidebarUserProfile";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

function BarNavLink({
  section,
  isActive,
  label,
}: {
  section: NavSection;
  isActive: boolean;
  label: string;
}) {
  return (
    <Link
      href={section.path}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        // pb/-mb pulls the active underline down onto the bar's bottom border
        "text-[10px] uppercase tracking-[0.18em] whitespace-nowrap pb-[15px] -mb-4 border-b-[1.5px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent",
        isActive
          ? "font-bold text-kyar-media-fg border-kyar-media-fg"
          : "font-semibold text-media-fg-55 border-transparent hover:text-kyar-media-fg"
      )}
    >
      {label}
    </Link>
  );
}

/**
 * v2 desktop shell: persistent glass top bar (replaces WebSidebar). Studio
 * sections inline left, social sections + settings + account right, plus the
 * context-aware "New …" pill that absorbs the desktop GlobalFAB.
 */
export function GlassTopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Nav");
  const tCommon = useTranslations("Common");
  const { open: openCreationModal } = useCreationModals();
  const active = getActiveSection(pathname ?? null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const primaryAction = getPrimaryAddMenuItem(active);
  const otherActions = ADD_MENU_ITEMS.filter((i) => i !== primaryAction);

  const handleAdd = (modal: typeof primaryAction.modal, href: string) => {
    setMenuOpen(false);
    if (modal) {
      openCreationModal(modal);
    } else {
      router.push(href);
    }
  };

  return (
    <header
      className="hidden lg:flex sticky top-0 z-40 items-center gap-8 px-9 py-4 bg-glass-bar-on-wall backdrop-blur-glass-bar border-b border-glass-divider-strong text-kyar-media-fg"
      aria-label="Main navigation"
    >
      <Link
        href="/home"
        className="font-serif italic text-[21px] leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded"
      >
        Kyarafit
      </Link>

      <nav className="flex items-center gap-8" aria-label="Studio">
        {NAV_SECTIONS_TOPBAR_PRIMARY.map((section) => (
          <BarNavLink
            key={section.id}
            section={section}
            isActive={active === section.id}
            label={t(section.id)}
          />
        ))}
      </nav>

      <div className="flex-1" />

      <nav className="flex items-center gap-8" aria-label="Social">
        {NAV_SECTIONS_TOPBAR_SOCIAL.map((section) => (
          <BarNavLink
            key={section.id}
            section={section}
            isActive={active === section.id}
            label={t(section.id)}
          />
        ))}
      </nav>

      <div ref={menuRef} className="relative flex items-center">
        <div className="flex items-center rounded-full bg-glass-solid text-glass-ink overflow-hidden focus-within:ring-2 focus-within:ring-kyar-accent">
          <button
            type="button"
            onClick={() => handleAdd(primaryAction.modal, primaryAction.href)}
            className="flex items-center gap-2 pl-4 pr-2.5 py-[9px] hover:bg-glass-ink/10 transition-colors focus:outline-none"
            aria-label={`Primary Add: ${tCommon(primaryAction.labelKey)}`}
          >
            <span className="material-symbols-outlined text-[15px]" aria-hidden>
              add
            </span>
            <span className="text-[9px] font-bold uppercase tracking-[0.16em]">
              {tCommon(primaryAction.labelKey)}
            </span>
          </button>
          <div className="w-px h-4 shrink-0 bg-glass-ink/25" aria-hidden />
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="pl-2 pr-3 py-[9px] hover:bg-glass-ink/10 transition-colors focus:outline-none"
            aria-label="More options"
            aria-expanded={menuOpen}
          >
            <span
              className="material-symbols-outlined text-[16px]"
              style={{
                transform: menuOpen ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
              aria-hidden
            >
              expand_more
            </span>
          </button>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.ul
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-3 min-w-[12rem] rounded-glass-overlay border border-glass-border-overlay bg-glass-overlay-on-wall backdrop-blur-glass-overlay shadow-glass-overlay py-1 focus:outline-none origin-top-right"
              role="menu"
            >
              {otherActions.map((item) => (
                <li key={item.href} role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-3 text-left text-sm font-medium text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:bg-glass-active"
                    onClick={() => handleAdd(item.modal, item.href)}
                  >
                    {tCommon(item.labelKey)}
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      <Link
        href={NAV_SECTION_SETTINGS.path}
        aria-label={t(NAV_SECTION_SETTINGS.id)}
        aria-current={active === NAV_SECTION_SETTINGS.id ? "page" : undefined}
        className={cn(
          "flex items-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent rounded",
          active === NAV_SECTION_SETTINGS.id
            ? "text-kyar-media-fg"
            : "text-media-fg-70 hover:text-kyar-media-fg"
        )}
      >
        <span className="material-symbols-outlined text-[19px]" aria-hidden>
          settings
        </span>
      </Link>

      <SidebarUserProfile collapsed={false} surface="glass" compact />
    </header>
  );
}
