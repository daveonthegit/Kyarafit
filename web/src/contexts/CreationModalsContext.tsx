"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AddMenuModal } from "@kyarafit/design-system";
import { NewBuildModal } from "@/components/creation/NewBuildModal";
import { NewClosetItemModal } from "@/components/creation/NewClosetItemModal";
import { NewConventionModal } from "@/components/creation/NewConventionModal";
import { NewGroupModal } from "@/components/creation/NewGroupModal";

type OpenOptions = { dismissTo?: string };

type CreationModalsContextValue = {
  open: (modal: AddMenuModal, options?: OpenOptions) => void;
};

const CreationModalsContext = createContext<CreationModalsContextValue | null>(null);

export function useCreationModals(): CreationModalsContextValue {
  const ctx = useContext(CreationModalsContext);
  if (!ctx) {
    throw new Error("useCreationModals must be used within CreationModalsProvider");
  }
  return ctx;
}

export function CreationModalsProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [active, setActive] = useState<AddMenuModal | null>(null);
  const dismissToRef = useRef<string | undefined>(undefined);

  const open = useCallback((modal: AddMenuModal, options?: OpenOptions) => {
    dismissToRef.current = options?.dismissTo;
    setActive(modal);
  }, []);

  const dismiss = useCallback(() => {
    const to = dismissToRef.current;
    dismissToRef.current = undefined;
    setActive(null);
    if (to) {
      router.replace(to);
    }
  }, [router]);

  const dismissQuiet = useCallback(() => {
    dismissToRef.current = undefined;
    setActive(null);
  }, []);

  return (
    <CreationModalsContext.Provider value={{ open }}>
      {children}
      {active === "newCloset" && (
        <NewClosetItemModal key="newCloset" onDismiss={dismiss} onSuccessComplete={dismissQuiet} />
      )}
      {active === "newBuild" && (
        <NewBuildModal key="newBuild" onDismiss={dismiss} onSuccessComplete={dismissQuiet} />
      )}
      {active === "newConvention" && (
        <NewConventionModal
          key="newConvention"
          onDismiss={dismiss}
          onSuccessComplete={dismissQuiet}
        />
      )}
      {active === "newGroup" && (
        <NewGroupModal key="newGroup" onDismiss={dismiss} onSuccessComplete={dismissQuiet} />
      )}
    </CreationModalsContext.Provider>
  );
}
