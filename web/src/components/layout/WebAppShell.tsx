"use client";

import { usePathname } from "next/navigation";
import { BottomNav } from "@/components/layout/BottomNav";
import { WebContentContainer } from "@/components/layout/WebContentContainer";
import { WebSidebar } from "@/components/layout/WebSidebar";
import { WebTopBar } from "@/components/layout/WebTopBar";

/**
 * Web-only app shell: sidebar (desktop/tablet), top bar, content container, bottom nav (mobile).
 */
export function WebAppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const active =
    pathname?.startsWith("/builds") ||
    pathname?.startsWith("/build-detail") ||
    pathname?.startsWith("/closet")
      ? "builds"
      : pathname?.startsWith("/conventions") || pathname?.startsWith("/itinerary")
        ? "events"
        : pathname?.startsWith("/planner") || pathname?.startsWith("/packing")
          ? "todo"
          : pathname?.startsWith("/home")
            ? "home"
            : "home";

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <WebSidebar />

      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <WebTopBar />
        <main className="flex-1 flex flex-col pb-32 lg:pb-0">
          <WebContentContainer className="flex-1 flex flex-col">{children}</WebContentContainer>
        </main>

        <BottomNav active={active} className="lg:hidden" />
      </div>
    </div>
  );
}
