"use client";

import type { ReactNode } from "react";
import { CreationModalsProvider } from "@/contexts/CreationModalsContext";

export function AppProviders({ children }: { children: ReactNode }) {
  return <CreationModalsProvider>{children}</CreationModalsProvider>;
}
