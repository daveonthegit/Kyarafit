"use client";

import { useTranslations } from "next-intl";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  /** Landing header: matches frosted bar in {@link LandingSiteHeader} */
  variant?: "header" | "sidebar";
  showLabel?: boolean;
  collapsed?: boolean;
  className?: string;
};

export function ThemeToggle({
  variant = "header",
  showLabel = false,
  collapsed = false,
  className,
}: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const t = useTranslations("Theme");
  const isDark = theme === "dark";
  const label = isDark ? t("switchToLight") : t("switchToDark");

  const buttonClass =
    variant === "header"
      ? cn(
          "min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full",
          "text-kyar-text hover:bg-kyar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bg",
          className
        )
      : cn(
          "min-h-[44px] w-full flex items-center gap-3 rounded-sm text-kyar-meta hover:text-kyar-text hover:bg-kyar-muted/50 transition-colors",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-panel",
          collapsed ? "justify-center px-0" : "justify-start px-4",
          className
        );

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={buttonClass}
      aria-label={label}
      title={collapsed ? label : undefined}
    >
      <span className="material-symbols-outlined text-[20px] font-light shrink-0" aria-hidden>
        {isDark ? "light_mode" : "dark_mode"}
      </span>
      {variant === "sidebar" && showLabel && !collapsed && (
        <span className="text-[11px] uppercase tracking-[0.16em] font-semibold truncate">
          {t("label")}
        </span>
      )}
    </button>
  );
}
