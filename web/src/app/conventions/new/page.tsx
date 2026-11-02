"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { CreationRoutePlaceholder } from "@/components/creation/CreationRoutePlaceholder";

/**
 * Deep link: opens the global “new event” modal; closing returns to events list.
 */
export default function NewConventionPage() {
  const router = useRouter();
  const t = useTranslations("Creation");
  const { open } = useCreationModals();
  const opened = useRef(false);

  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    open("newConvention", { dismissTo: "/conventions" });
  }, [open]);

  return (
    <CreationRoutePlaceholder
      message={t("openingEvent")}
      cancelLabel={t("cancel")}
      onCancel={() => router.replace("/conventions")}
    />
  );
}
