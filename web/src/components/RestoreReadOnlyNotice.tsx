"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { offlineRuntime } from "@/lib/offline/runtime";

export function RestoreReadOnlyNotice() {
  const t = useTranslations("DataPortability");
  const readOnly = useSyncExternalStore(
    offlineRuntime.subscribe,
    () => offlineRuntime.getRestoreInProgress(),
    () => false
  );
  if (!readOnly) return null;
  return (
    <p role="status" className="px-6 py-3 text-sm">
      {t("restoreReadOnly")}
    </p>
  );
}
