import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, Alert, Text } from "react-native";
import { glass } from "@kyarafit/design-system/rn";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { useConvex } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { useActiveVault, useVaultState } from "@/vault/hooks";
import { deleteVaultDatabase } from "@/offline/db";
import { signOut } from "@/lib/auth/client";
import {
  getActiveVault,
  getVaultDataVersion,
  requireActiveVault,
  subscribeVault,
} from "@/vault/activeVault";
import { collectVaultImageKeys } from "@/vault/images";
import {
  deliverVaultBackup,
  discardVaultBackup,
  pickAndImportVaultBackup,
  writeVaultBackup,
} from "@/vault/portabilityDevice";
import { DataBoundary } from "@/ui";
import { PhotoPill } from "@/ui/glass";
import {
  SettingsGlassFrame,
  SettingsGlassSection,
  settingsGlassStyles as styles,
} from "@/screens/settings/glassSettings";

/**
 * Settings → Backup & restore (REQ-012). FREE for everyone.
 *
 * - **Back up** writes the whole unlocked vault — every planner row plus the original bytes of every
 *   photo — to one `.kyarafit` file and hands it to the OS (share sheet / folder picker).
 * - **Restore** merges a picked backup into this vault: missing items are added, newer copies win,
 *   anything changed here since is kept. Photos that could not be restored are reported.
 * - **Remove from this device** is the only destructive path: an explicit, confirmed delete of this
 *   account's vault, followed by sign-out. Sign-out alone never deletes anything.
 */

function useVaultCounts(): { items: number; photos: number } {
  const version = useSyncExternalStore(subscribeVault, getVaultDataVersion, getVaultDataVersion);
  return useMemo(() => {
    void version;
    const store = getActiveVault();
    if (!store) return { items: 0, photos: 0 };
    const rows = store.exportRows().filter((row) => row.table !== "vaultSettings");
    return {
      items: rows.length,
      photos: collectVaultImageKeys(rows.map((row) => row.doc)).size,
    };
  }, [version]);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function SettingsDataScreen() {
  const { t } = useTranslation();
  const convex = useConvex();
  const vault = useActiveVault();
  // The acting account is the unlocked vault's, so backup, restore and removal work offline and
  // after the remote session has expired.
  const vaultState = useVaultState();
  const subject = vaultState.status === "unlocked" ? vaultState.account.subject : undefined;
  const counts = useVaultCounts();
  const [busy, setBusy] = useState<"export" | "import" | "remove" | null>(null);

  const handleExport = useCallback(async () => {
    if (counts.items === 0) {
      Alert.alert(t("settings.dataErrorTitle"), t("settings.dataExportEmpty"));
      return;
    }
    setBusy("export");
    try {
      requireActiveVault(vault);
      const { uri, summary } = await writeVaultBackup((storageId) =>
        convex.query(api.files.getUrl, { storageId: storageId as Id<"_storage"> })
      );
      requireActiveVault(vault);
      let delivered: boolean;
      try {
        delivered = await deliverVaultBackup(uri, t("settings.dataExportTitle"));
      } finally {
        discardVaultBackup(uri);
      }
      requireActiveVault(vault);
      if (!delivered) return;
      const lines = [
        t("settings.dataExportSuccessBody", { items: summary.rows, photos: summary.images }),
      ];
      if (summary.missingImages.length > 0) {
        lines.push(t("settings.dataExportMissingPhotos", { count: summary.missingImages.length }));
      }
      if (summary.rowsOmitted > 0) {
        lines.push(t("settings.dataExportOmittedRows", { count: summary.rowsOmitted }));
      }
      Alert.alert(
        t(summary.rowsOmitted > 0 || summary.missingImages.length > 0
          ? "settings.dataExportPartialTitle" : "settings.dataExportSuccessTitle"),
        lines.join("\n\n")
      );
    } catch (error) {
      Alert.alert(t("settings.dataErrorTitle"), errorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [counts.items, t, convex, vault]);

  const handleImport = useCallback(async () => {
    setBusy("import");
    try {
      requireActiveVault(vault);
      const summary = await pickAndImportVaultBackup();
      requireActiveVault(vault);
      if (!summary) return;
      const lines = [
        t("settings.dataImportSuccessBody", {
          added: summary.rows.inserted,
          updated: summary.rows.updated,
          kept: summary.rows.skipped,
        }),
      ];
      if (summary.photosMissing.length > 0) {
        lines.push(t("settings.dataImportMissingPhotos", { count: summary.photosMissing.length }));
      }
      if (summary.rowsOmitted > 0) {
        lines.push(t("settings.dataImportOmittedRows", { count: summary.rowsOmitted }));
      }
      if (summary.rows.conflicts > 0) {
        lines.push(t("settings.dataImportConflicts", { count: summary.rows.conflicts }));
      }
      Alert.alert(
        summary.photosMissing.length > 0 || summary.rowsOmitted > 0 || summary.rows.conflicts > 0
          ? t("settings.dataImportPartialTitle")
          : t("settings.dataImportSuccessTitle"),
        lines.join("\n\n")
      );
    } catch (error) {
      Alert.alert(t("settings.dataErrorTitle"), errorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [t, vault]);

  const removeDeviceData = useCallback(async () => {
    if (!subject) return;
    setBusy("remove");
    try {
      // Lock first (sign-out closes the vault), then delete the closed files.
      await signOut();
      await deleteVaultDatabase(subject);
    } catch (error) {
      Alert.alert(t("settings.dataErrorTitle"), errorMessage(error));
      setBusy(null);
    }
  }, [subject, t]);

  const confirmRemove = useCallback(() => {
    Alert.alert(t("settings.dataRemoveConfirmTitle"), t("settings.dataRemoveConfirmBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.dataRemoveConfirmAction"),
        style: "destructive",
        onPress: () => void removeDeviceData(),
      },
    ]);
  }, [removeDeviceData, t]);

  const status = vaultState.status === "booting" ? "loading" : "ready";

  return (
    <SettingsGlassFrame
      eyebrow={t("settings.dataPortabilityEyebrow")}
      title={t("settings.dataPortability")}
      description={t("settings.dataPortabilityIntro")}
    >
      <DataBoundary status={status} data={{ ready: true as const }}>
        {() => (
          <>
            <SettingsGlassSection label={t("settings.dataExportTitle")}>
              <Text style={styles.body}>{t("settings.dataExportDescription")}</Text>
              <Text style={styles.count}>
                {t("settings.dataExportSummary", { items: counts.items, photos: counts.photos })}
              </Text>
              <PhotoPill
                style={styles.action}
                label={t("settings.dataExportButton")}
                disabled={busy !== null}
                accessibilityState={{ busy: busy === "export" }}
                onPress={() => void handleExport()}
              />
              {busy === "export" ? (
                <ActivityIndicator color={glass.text.fg} accessibilityLabel={t("common.loading")} />
              ) : null}
            </SettingsGlassSection>
            <SettingsGlassSection label={t("settings.dataImportTitle")}>
              <Text style={styles.body}>{t("settings.dataImportDescription")}</Text>
              <PhotoPill
                style={styles.action}
                variant="outline"
                label={t("settings.dataImportButton")}
                disabled={busy !== null}
                accessibilityState={{ busy: busy === "import" }}
                onPress={() => void handleImport()}
              />
              {busy === "import" ? (
                <ActivityIndicator color={glass.text.fg} accessibilityLabel={t("common.loading")} />
              ) : null}
            </SettingsGlassSection>
            <SettingsGlassSection label={t("settings.dataRemoveTitle")}>
              <Text style={styles.body}>{t("settings.dataRemoveDescription")}</Text>
              <PhotoPill
                style={styles.action}
                variant="text"
                label={t("settings.dataRemoveButton")}
                disabled={busy !== null}
                accessibilityState={{ busy: busy === "remove" }}
                onPress={confirmRemove}
              />
            </SettingsGlassSection>
            <SettingsGlassSection>
              <Text style={styles.body}>{t("settings.dataPortabilityFootnote")}</Text>
            </SettingsGlassSection>
          </>
        )}
      </DataBoundary>
    </SettingsGlassFrame>
  );
}
