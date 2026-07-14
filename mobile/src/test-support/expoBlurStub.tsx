import { forwardRef, type ReactNode } from "react";

/**
 * expo-blur ships untranspiled JSX in its build output, which the vitest
 * (jsdom) runner cannot parse — aliased in `src/offline/vitest.config.ts`.
 * Component tests only need BlurView to render its children.
 */
export const BlurView = forwardRef(function BlurViewStub(
  { children }: { children?: ReactNode },
  _ref: unknown
) {
  return <div data-testid="expo-blur-stub">{children}</div>;
});
