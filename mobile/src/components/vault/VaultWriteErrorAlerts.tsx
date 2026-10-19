import { useEffect, useRef } from "react";
import { Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { onVaultWriteError } from "@/vault/functions";

/**
 * One system alert per failed local save (disk full, storage error). The write was NOT applied and
 * the calling screen keeps its draft, so the user can free space and try again. Repeats within a
 * couple of seconds collapse into one alert.
 */
export function VaultWriteErrorAlerts() {
  const { t } = useTranslation();
  const lastShownAt = useRef(0);

  useEffect(
    () =>
      onVaultWriteError((error) => {
        const now = Date.now();
        if (now - lastShownAt.current < 2000) return;
        lastShownAt.current = now;
        const detail = error.cause instanceof Error ? error.cause.message : String(error.cause);
        Alert.alert(t("vault.saveFailedTitle"), t("vault.saveFailedBody", { detail }));
      }),
    [t]
  );

  return null;
}
