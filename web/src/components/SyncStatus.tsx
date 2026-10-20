"use client";

import { useTranslations } from "next-intl";

export function SyncStatus() {
  const t = useTranslations("Sync");
  return (
    <p role="status" className="px-4 py-3 text-sm">
      {t("publishedReadOnly")}
    </p>
  );
}
