"use client";

import type { ReactNode } from "react";
import { CreationModalsProvider } from "@/contexts/CreationModalsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SyncStatus } from "@/components/SyncStatus";
import { SyncWorkerProvider } from "@/lib/offline";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SyncWorkerProvider>
        <CreationModalsProvider>{children}</CreationModalsProvider>
        <SyncStatus />
      </SyncWorkerProvider>
    </ThemeProvider>
  );
}
