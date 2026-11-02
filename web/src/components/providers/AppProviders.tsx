"use client";

import type { ReactNode } from "react";
import { CreationModalsProvider } from "@/contexts/CreationModalsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { CloudRetentionBanner } from "@/components/CloudRetentionBanner";
import { DeprecationBanner } from "@/components/DeprecationBanner";
import { RestoreReadOnlyNotice } from "@/components/RestoreReadOnlyNotice";
import { SyncWorkerProvider } from "@/lib/offline";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SyncWorkerProvider>
        <DeprecationBanner />
        <RestoreReadOnlyNotice />
        {/* SyncStatus lives on the Backup & data settings page (owner: no floating status chips). */}
        <CreationModalsProvider>{children}</CreationModalsProvider>
        <CloudRetentionBanner />
      </SyncWorkerProvider>
    </ThemeProvider>
  );
}
