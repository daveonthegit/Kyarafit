"use client";

import { usePathname } from "next/navigation";
import { getActiveSection, shouldHideGlobalFAB } from "@kyarafit/design-system";
import { BottomNav } from "@/components/layout/BottomNav";
import { WebContentContainer } from "@/components/layout/WebContentContainer";
import { GlassTopBar } from "@/components/layout/GlassTopBar";
import { GlobalFAB } from "@/components/layout/GlobalFAB";

/**
 * Web-only app shell: glass top bar (desktop/tablet), content container,
 * glass bottom nav + FAB (mobile). `fullBleed` drops the width-constrained
 * container for v2 photo-backdrop screens, which manage their own padding.
 */
export function WebAppShell({
  children,
  fullBleed = false,
}: {
  children: React.ReactNode;
  fullBleed?: boolean;
}) {
  const pathname = usePathname();
  const active = getActiveSection(pathname ?? null);
  const hideFAB = shouldHideGlobalFAB(pathname ?? null);

  return (
    <div className="min-h-screen flex flex-col bg-kyar-bg relative">
      <GlassTopBar />

      <div className="flex-1 flex flex-col min-w-0 relative">
        <main className="flex-1 flex flex-col pb-24 lg:pb-0">
          {fullBleed ? (
            children
          ) : (
            <WebContentContainer className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8">
              {children}
            </WebContentContainer>
          )}
        </main>

        <BottomNav active={active} className="lg:hidden" />
        {!hideFAB && <GlobalFAB className="lg:hidden" />}
      </div>
    </div>
  );
}
