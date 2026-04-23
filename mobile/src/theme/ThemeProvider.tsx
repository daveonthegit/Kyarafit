import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Appearance, Platform, useColorScheme as useRnColorScheme } from "react-native";
import * as SecureStore from "expo-secure-store";
import { useColorScheme as useNativeWindColorScheme } from "nativewind";

export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "kyarafit.theme.preference";

type ThemeCtx = {
  preference: ThemePreference;
  resolvedScheme: "light" | "dark";
  setPreference: (p: ThemePreference) => Promise<void>;
};

const ThemeContext = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useRnColorScheme();
  const { setColorScheme } = useNativeWindColorScheme();
  const [preference, setPrefState] = useState<ThemePreference>("system");

  useEffect(() => {
    void (async () => {
      const stored = await SecureStore.getItemAsync(STORAGE_KEY);
      if (stored === "light" || stored === "dark" || stored === "system") {
        setPrefState(stored);
      }
    })();
  }, []);

  const resolvedScheme =
    preference === "system" ? (system === "dark" ? "dark" : "light") : preference;

  useEffect(() => {
    setColorScheme(preference);
  }, [preference, setColorScheme]);

  const setPreference = useCallback(async (p: ThemePreference) => {
    setPrefState(p);
    await SecureStore.setItemAsync(STORAGE_KEY, p);
    if (Platform.OS === "android" && p !== "system") {
      Appearance.setColorScheme?.(p);
    }
  }, []);

  const value = useMemo(
    () => ({
      preference,
      resolvedScheme,
      setPreference,
    }),
    [preference, resolvedScheme, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
