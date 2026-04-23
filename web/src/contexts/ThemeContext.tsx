"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export const KYAR_THEME_STORAGE_KEY = "kyar-theme";
export type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", theme === "dark");
}

function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(KYAR_THEME_STORAGE_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {
    // ignore
  }
  return "light";
}

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme | ((prev: Theme) => Theme)) => void;
  toggleTheme: () => void;
  mounted: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const t = readStoredTheme();
    setThemeState(t);
    applyTheme(t);
  }, []);

  const setTheme = useCallback((next: Theme | ((prev: Theme) => Theme)) => {
    setThemeState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next;
      applyTheme(resolved);
      try {
        localStorage.setItem(KYAR_THEME_STORAGE_KEY, resolved);
      } catch {
        // ignore
      }
      return resolved;
    });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, mounted }}>
      {children}
    </ThemeContext.Provider>
  );
}
