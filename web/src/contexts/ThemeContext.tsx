"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export const KYAR_THEME_STORAGE_KEY = "kyar-theme";
export type Theme = "light" | "dark";
export type ThemePreference = "system" | Theme;

function systemTheme(): Theme {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function resolveTheme(preference: ThemePreference): Theme {
  return preference === "system" ? systemTheme() : preference;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  root.classList.toggle("dark", theme === "dark");
}

function readStoredPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(KYAR_THEME_STORAGE_KEY);
    if (v === "dark" || v === "light" || v === "system") return v;
  } catch {
    // ignore
  }
  return "system";
}

type ThemeContextValue = {
  /** Resolved theme actually applied to the document. */
  theme: Theme;
  /** Stored preference; "system" follows the OS setting. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  /** Sets an explicit light/dark preference (kept for existing callers). */
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
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [theme, setThemeState] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const pref = readStoredPreference();
    setPreferenceState(pref);
    const resolved = resolveTheme(pref);
    setThemeState(resolved);
    applyTheme(resolved);
  }, []);

  // Follow OS theme changes while preference is "system".
  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = systemTheme();
      setThemeState(resolved);
      applyTheme(resolved);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    const resolved = resolveTheme(pref);
    setThemeState(resolved);
    applyTheme(resolved);
    try {
      localStorage.setItem(KYAR_THEME_STORAGE_KEY, pref);
    } catch {
      // ignore
    }
  }, []);

  const setTheme = useCallback(
    (next: Theme | ((prev: Theme) => Theme)) => {
      const resolved = typeof next === "function" ? next(resolveTheme(preference)) : next;
      setPreference(resolved);
    },
    [preference, setPreference]
  );

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }, [setTheme]);

  return (
    <ThemeContext.Provider
      value={{ theme, preference, setPreference, setTheme, toggleTheme, mounted }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
