import { useState } from "react";
import { View } from "react-native";
import { useTranslation } from "react-i18next";
import { glass } from "@kyarafit/design-system/rn";
import { GlassEmptyState, PhotoPill } from "@/ui";
import { bootVault } from "@/vault/activeVault";
import { signOut } from "@/lib/auth/client";

/**
 * Shown when this account's vault exists but cannot be opened (device storage error, damaged
 * file). The data is never wiped from here: the user can retry, or sign out and come back.
 */
export function VaultErrorScreen({ message }: { message: string }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function retry() {
    setBusy(true);
    try {
      await bootVault();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        paddingHorizontal: 24,
        backgroundColor: glass.scrim.studioWall.stops[1].color,
      }}
    >
      <GlassEmptyState
        icon="alert-circle-outline"
        message={t("vault.openErrorTitle")}
        secondary={t("vault.openErrorBody", { detail: message })}
        action={
          <View style={{ gap: 12, alignItems: "center" }}>
            <PhotoPill
              label={t("offline.retry")}
              icon="refresh"
              disabled={busy}
              onPress={() => void retry()}
            />
            <PhotoPill variant="text" label={t("common.signOut")} onPress={() => void signOut()} />
          </View>
        }
      />
    </View>
  );
}
