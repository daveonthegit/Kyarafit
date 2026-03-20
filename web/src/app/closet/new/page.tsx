"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCreationModals } from "@/contexts/CreationModalsContext";

/**
 * Deep link: opens the global “new item” modal; closing returns to closet.
 */
export default function NewClosetItemPage() {
  const router = useRouter();
  const { open } = useCreationModals();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    open("newCloset", { dismissTo: "/closet" });
  }, [open]);

  return (
    <WebAppShell>
      <div className="flex flex-1 flex-col items-center justify-center py-24">
        <p className="text-sm text-kyar-textTertiary">Opening new item…</p>
        <button
          type="button"
          onClick={() => router.replace("/closet")}
          className="mt-4 text-xs uppercase tracking-widest text-kyar-text underline"
        >
          Cancel
        </button>
      </div>
    </WebAppShell>
  );
}
