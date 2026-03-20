"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRef, useState, useEffect } from "react";
import { ADD_MENU_ITEMS } from "@kyarafit/design-system";
import { useCreationModals } from "@/contexts/CreationModalsContext";

type AddContextMenuProps = {
  /** Trigger element (e.g. top bar button content or FAB). */
  trigger: React.ReactNode;
  /** Optional class for the wrapper (e.g. for FAB positioning). */
  className?: string;
  /** Menu alignment: "right" for top bar, "bottom-right" for FAB. */
  align?: "right" | "bottom-right";
  /** "topbar" = bordered button; "fab" = no border, trigger styles the button. */
  variant?: "topbar" | "fab";
};

export function AddContextMenu({
  trigger,
  className = "",
  align = "right",
  variant = "topbar",
}: AddContextMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("Common");
  const { open: openCreationModal } = useCreationModals();

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const buttonClass =
    variant === "fab"
      ? "flex items-center justify-center rounded-sm bg-black text-white shadow-fab transition-transform hover:scale-95 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
      : "flex items-center gap-1.5 rounded-sm border border-black px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest hover:bg-kyar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2";

  return (
    <div ref={wrapperRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={buttonClass}
        aria-label={t("add")}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {trigger}
      </button>
      {open && (
        <ul
          className="absolute z-50 mt-1 min-w-[10rem] rounded-sm border border-kyar-borderSubtle bg-white py-1 shadow-soft focus:outline-none"
          role="menu"
          style={
            align === "bottom-right"
              ? { bottom: "100%", right: 0, marginBottom: "0.25rem", marginTop: 0 }
              : { right: 0, left: "auto" }
          }
        >
          {ADD_MENU_ITEMS.map((item) => (
            <li key={item.href} role="none">
              {item.modal ? (
                <button
                  type="button"
                  role="menuitem"
                  className="block w-full px-3 py-2 text-left text-sm text-kyar-text hover:bg-kyar-muted"
                  onClick={() => {
                    setOpen(false);
                    openCreationModal(item.modal!);
                  }}
                >
                  {t(item.labelKey)}
                </button>
              ) : (
                <Link
                  href={item.href}
                  role="menuitem"
                  className="block px-3 py-2 text-sm text-kyar-text hover:bg-kyar-muted"
                  onClick={() => setOpen(false)}
                >
                  {t(item.labelKey)}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
