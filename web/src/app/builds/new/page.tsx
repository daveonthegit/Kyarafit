"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { CreationRoutePlaceholder } from "@/components/creation/CreationRoutePlaceholder";

/**
 * Deep link: opens the global “new build” modal; closing returns to builds list.
 */
export default function NewBuildPage() {
  const router = useRouter();
  const t = useTranslations("Creation");
  const { open } = useCreationModals();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    open("newBuild", { dismissTo: "/builds" });
  }, [open]);

  return (
    <CreationRoutePlaceholder
      message={t("openingBuild")}
      cancelLabel={t("cancel")}
      onCancel={() => router.replace("/builds")}
    />
  );
}
