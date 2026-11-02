import { forwardRef, type ReactNode } from "react";

/**
 * expo-linear-gradient ships untranspiled JSX in its build output, which the
 * vitest (jsdom) runner cannot parse — aliased in `src/offline/vitest.config.ts`.
 */
export const LinearGradient = forwardRef(function LinearGradientStub(
  { children }: { children?: ReactNode },
  _ref: unknown
) {
  return <div data-testid="expo-linear-gradient-stub">{children}</div>;
});
