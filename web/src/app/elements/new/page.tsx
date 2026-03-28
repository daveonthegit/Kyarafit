"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreationModals } from "@/contexts/CreationModalsContext";

export default function NewElementPage() {
  const router = useRouter();
  const { open } = useCreationModals();

  useEffect(() => {
    open("newCloset", { dismissTo: "/elements" });
  }, [open]);

  return (
    <main className="p-6">
      <button
        type="button"
        onClick={() => router.replace("/elements")}
        className="text-sm underline"
      >
        Back to Elements
      </button>
    </main>
  );
}
