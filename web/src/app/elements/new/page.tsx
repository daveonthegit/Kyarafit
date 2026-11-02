"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCreationModals } from "@/contexts/CreationModalsContext";
import { CreationRoutePlaceholder } from "@/components/creation/CreationRoutePlaceholder";

export default function NewElementPage() {
  const router = useRouter();
  const t = useTranslations("Creation");
  const { open } = useCreationModals();

  useEffect(() => {
    open("newCloset", { dismissTo: "/elements" });
  }, [open]);

  return (
    <CreationRoutePlaceholder
      message={t("openingElement")}
      cancelLabel={t("backToElements")}
      onCancel={() => router.replace("/elements")}
    />
  );
}
