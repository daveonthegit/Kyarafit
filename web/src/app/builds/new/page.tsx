"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCreationModals } from "@/contexts/CreationModalsContext";

/**
 * Deep link: opens the global “new build” modal; closing returns to builds list.
 */
export default function NewBuildPage() {
  const router = useRouter();
  const { open } = useCreationModals();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    open("newBuild", { dismissTo: "/builds" });
  }, [open]);

  return (
    <WebAppShell>
      <div className="flex flex-1 flex-col items-center justify-center py-24">
        <p className="text-sm text-kyar-textTertiary">Opening new build…</p>
        <button
          type="button"
          onClick={() => router.replace("/builds")}
          className="mt-4 text-xs uppercase tracking-widest text-kyar-text underline"
        >
          Cancel
        </button>
      </div>
    </WebAppShell>
  );
}
