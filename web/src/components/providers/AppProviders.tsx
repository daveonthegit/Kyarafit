"use client";

import type { ReactNode } from "react";
import { CreationModalsProvider } from "@/contexts/CreationModalsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { SyncWorkerProvider } from "@/lib/offline";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SyncWorkerProvider>
        <CreationModalsProvider>{children}</CreationModalsProvider>
      </SyncWorkerProvider>
    </ThemeProvider>
  );
}
