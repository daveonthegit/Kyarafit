import type { ReactNode } from "react";

/**
 * react-native-safe-area-context imports real react-native (Flow syntax the
 * vitest runner can't parse) — aliased in `src/offline/vitest.config.ts`.
 */
export function useSafeAreaInsets() {
  return { top: 0, bottom: 0, left: 0, right: 0 };
}

export function SafeAreaProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function SafeAreaView({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
