"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useEffect } from "react";
import { getActiveSection, getPrimaryAddMenuItem, ADD_MENU_ITEMS } from "@kyarafit/design-system";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function GlobalFAB({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Common");
  const { open: openCreationModal } = useCreationModals();
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const activeSection = getActiveSection(pathname);
  const primaryAction = getPrimaryAddMenuItem(activeSection);
  const otherActions = ADD_MENU_ITEMS.filter((i) => i !== primaryAction);

  const handlePrimaryClick = () => {
    if (primaryAction.modal) {
      openCreationModal(primaryAction.modal);
    } else {
      router.push(primaryAction.href);
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={`fixed right-4 sm:right-6 lg:right-8 z-40 max-lg:bottom-[calc(max(1.5rem,env(safe-area-inset-bottom,1rem))+4.5rem)] lg:bottom-[calc(max(1.5rem,env(safe-area-inset-bottom,1rem)))] ${className}`.trim()}
    >
      <div className="flex items-center shadow-fab rounded-full bg-glass-solid text-glass-ink overflow-hidden transition-transform hover:scale-105 active:scale-95 focus-within:ring-2 focus-within:ring-kyar-accent">
        <button
          type="button"
          onClick={handlePrimaryClick}
          className="flex items-center gap-2 px-5 py-3.5 hover:bg-glass-ink/10 transition-colors focus:outline-none"
          aria-label={`Primary Add: ${t(primaryAction.labelKey)}`}
        >
          <Plus className="size-5" />
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] hidden sm:inline">
            {t(primaryAction.labelKey)}
          </span>
        </button>
        <div className="w-px h-6 shrink-0 bg-glass-ink/25" aria-hidden />
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="px-3 py-3.5 hover:bg-glass-ink/10 transition-colors focus:outline-none"
          aria-label="More options"
          aria-expanded={menuOpen}
        >
          <span
            className="material-symbols-outlined text-xl"
            style={{
              transform: menuOpen ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          >
            expand_more
          </span>
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.ul
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full right-0 mb-3 min-w-[12rem] rounded-glass-overlay border border-glass-border-overlay bg-glass-overlay-on-wall backdrop-blur-glass-overlay py-1 shadow-glass-overlay focus:outline-none origin-bottom-right"
            role="menu"
          >
            {otherActions.map((item) => (
              <li key={item.href} role="none">
                {item.modal ? (
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-3 text-left text-sm font-medium text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:bg-glass-active"
                    onClick={() => {
                      setMenuOpen(false);
                      openCreationModal(item.modal!);
                    }}
                  >
                    {t(item.labelKey)}
                  </button>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className="block w-full px-4 py-3 text-left text-sm font-medium text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:bg-glass-active"
                    onClick={() => {
                      setMenuOpen(false);
                      router.push(item.href);
                    }}
                  >
                    {t(item.labelKey)}
                  </button>
                )}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
