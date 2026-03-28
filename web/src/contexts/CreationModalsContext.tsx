"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { AddMenuModal } from "@kyarafit/design-system";
import type { Id } from "convex/_generated/dataModel";
import { NewBuildModal } from "@/components/creation/NewBuildModal";
import { NewClosetItemModal } from "@/components/creation/NewClosetItemModal";
import { NewConventionModal } from "@/components/creation/NewConventionModal";
import { NewGroupModal } from "@/components/creation/NewGroupModal";

export type NewNodeModalOptions = {
  dismissTo?: string;
  successRedirectTo?: string | null;
  initialNodeType?: "element" | "material";
  initialCategory?: string;
  onCreated?: (node: { _id: Id<"cosplayNodes">; nodeType: "element" | "material"; name: string }) => void | Promise<void>;
};

type OpenOptions = NewNodeModalOptions;

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
  const newClosetOptionsRef = useRef<NewNodeModalOptions | undefined>(undefined);

  const open = useCallback((modal: AddMenuModal, options?: OpenOptions) => {
    dismissToRef.current = options?.dismissTo;
    newClosetOptionsRef.current = modal === "newCloset" ? options : undefined;
    setActive(modal);
  }, []);

  const dismiss = useCallback(() => {
    const to = dismissToRef.current;
    dismissToRef.current = undefined;
    newClosetOptionsRef.current = undefined;
    setActive(null);
    if (to) {
      router.replace(to);
    }
  }, [router]);

  const dismissQuiet = useCallback(() => {
    dismissToRef.current = undefined;
    newClosetOptionsRef.current = undefined;
    setActive(null);
  }, []);

  return (
    <CreationModalsContext.Provider value={{ open }}>
      {children}
      {active === "newCloset" && (
        <NewClosetItemModal
          key="newCloset"
          onDismiss={dismiss}
          onSuccessComplete={dismissQuiet}
          options={newClosetOptionsRef.current}
        />
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
