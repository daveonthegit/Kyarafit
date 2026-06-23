import { useCallback, useMemo, useState } from "react";
import { Alert, ScrollView, Share, Text, View } from "react-native";
import { Stack } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import {
  buildExport,
  buildPortableRows,
  importData,
  type EntityDoc,
  type PortableCollections,
  type PortableTable,
} from "@/lib/dataPortability";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

/**
 * Settings → Data export / import (Wave 7, REQ-012 / REQ-D101 / REQ-D102). FREE for everyone:
 * nothing on this screen gates on subscription tier.
 *
 * Export gathers the user's local-first entities via the offline queries, serializes them with the
 * shared `buildExport` (→ `exportBundle`), writes a JSON bundle to the app document directory, and
 * offers the OS share sheet. Import reads that bundle back and recreates missing rows idempotently.
 *
 * File picking: no document picker is installed (and we must not add a native dependency), so import
 * reads the known export file written by Export on this device — enough for an on-device round-trip
 * and for the orchestration logic to be fully exercised. See `dataPortability.ts`.
 */
const EXPORT_FILE_NAME = "kyarafit-export.json";

function exportFilePath(): string | null {
  const dir = FileSystem.documentDirectory;
  return dir ? `${dir}${EXPORT_FILE_NAME}` : null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

/** Adapt offline query results (Convex docs) to the table-agnostic `EntityDoc` shape. */
function toDocs(rows: readonly { _id: string }[] | undefined): EntityDoc[] {
  return (rows ?? []).map((row) => row as EntityDoc);
}

export default function SettingsDataScreen() {
  const { t } = useTranslation();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const builds = useOfflineQuery(api.builds.list, userId ? { userId } : "skip");
  const elements = useOfflineQuery(api.cosplayNodes.list, userId ? { userId } : "skip");
  const conventions = useOfflineQuery(api.conventions.list, userId ? { userId } : "skip");

  const createBuild = useOfflineMutation(api.builds.create);
  const createElement = useOfflineMutation(api.cosplayNodes.create);
  const createConvention = useOfflineMutation(api.conventions.create);

  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);

  const collections = useMemo<PortableCollections>(
    () => ({
      builds: toDocs(builds),
      elements: toDocs(elements),
      conventions: toDocs(conventions),
    }),
    [builds, elements, conventions]
  );

  const itemCount = useMemo(() => buildPortableRows(collections).length, [collections]);

  const createRow = useCallback(
    async (table: PortableTable, doc: EntityDoc): Promise<void> => {
      const owner = asString(doc.userId) ?? userId;
      if (!owner) return;
      if (table === "builds") {
        await createBuild({
          userId: owner,
          name: asString(doc.name) ?? "Untitled",
          status: asString(doc.status) ?? "idea",
          character: asString(doc.character),
          notes: asString(doc.notes),
          imageUrl: asString(doc.imageUrl),
          budgetCents: asNumber(doc.budgetCents),
          targetDate: asString(doc.targetDate),
          visibility: asString(doc.visibility),
        });
      } else if (table === "elements") {
        await createElement({
          userId: owner,
          nodeType: asString(doc.nodeType) ?? "element",
          name: asString(doc.name) ?? "Untitled",
          category: asString(doc.category),
          tags: asStringArray(doc.tags),
          notes: asString(doc.notes),
          imageUrl: asString(doc.imageUrl),
          sourceUrl: asString(doc.sourceUrl),
          pricingMode: asString(doc.pricingMode),
          directCostCents: asNumber(doc.directCostCents),
          unitCostCents: asNumber(doc.unitCostCents),
          quantity: asNumber(doc.quantity),
          unit: asString(doc.unit),
          purchaseStatus: asString(doc.purchaseStatus),
          buildStatus: asString(doc.buildStatus),
          materialStatus: asString(doc.materialStatus),
          manualOverallBucket: asString(doc.manualOverallBucket),
          buildInstructions: asString(doc.buildInstructions),
          finishedPhotoUrls: asStringArray(doc.finishedPhotoUrls),
          consumable: asBoolean(doc.consumable),
        });
      } else {
        await createConvention({
          userId: owner,
          name: asString(doc.name) ?? "Untitled",
          location: asString(doc.location),
          imageUrl: asString(doc.imageUrl),
          startDate: asString(doc.startDate) ?? "",
          endDate: asString(doc.endDate) ?? "",
        });
      }
    },
    [createBuild, createConvention, createElement, userId]
  );

  const handleExport = useCallback(async () => {
    if (!userId) {
      Alert.alert(t("settings.dataErrorTitle"), t("settings.dataSignInRequired"));
      return;
    }
    if (itemCount === 0) {
      Alert.alert(t("settings.dataErrorTitle"), t("settings.dataExportEmpty"));
      return;
    }
    const path = exportFilePath();
    if (!path) {
      Alert.alert(t("settings.dataErrorTitle"), t("settings.dataExportEmpty"));
      return;
    }
    setExporting(true);
    try {
      const serialized = buildExport(collections);
      await FileSystem.writeAsStringAsync(path, serialized);
      try {
        await Share.share({
          url: path,
          title: t("settings.dataExportTitle"),
          message: t("settings.dataExportShareMessage", { path }),
        });
      } catch {
        // User dismissed or the platform has no share sheet — the file is still saved.
      }
      Alert.alert(
        t("settings.dataExportSuccessTitle"),
        t("settings.dataExportSuccessBody", { count: itemCount })
      );
    } catch {
      Alert.alert(t("settings.dataErrorTitle"), t("settings.dataExportEmpty"));
    } finally {
      setExporting(false);
    }
  }, [collections, itemCount, t, userId]);

  const handleImport = useCallback(async () => {
    if (!userId) {
      Alert.alert(t("settings.dataErrorTitle"), t("settings.dataSignInRequired"));
      return;
    }
    const path = exportFilePath();
    if (!path) {
      Alert.alert(t("settings.dataErrorTitle"), t("settings.dataImportNoFile"));
      return;
    }
    setImporting(true);
    try {
      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        Alert.alert(t("settings.dataErrorTitle"), t("settings.dataImportNoFile"));
        return;
      }
      const serialized = await FileSystem.readAsStringAsync(path);
      const summary = await importData({ serialized, existing: collections, create: createRow });
      if (!summary.ok) {
        Alert.alert(t("settings.dataErrorTitle"), t("settings.dataImportMalformed"));
        return;
      }
      Alert.alert(
        t("settings.dataImportSuccessTitle"),
        t("settings.dataImportSuccessBody", {
          created: summary.created,
          skipped: summary.skipped,
        })
      );
    } catch {
      Alert.alert(t("settings.dataErrorTitle"), t("settings.dataImportNoFile"));
    } finally {
      setImporting(false);
    }
  }, [collections, createRow, t, userId]);

  const status = identity === undefined ? "loading" : "ready";

  return (
    <>
      <Stack.Screen options={{ title: t("settings.dataPortability"), headerLargeTitle: false }} />
      <DataBoundary status={status} data={{ ready: true as const }}>
        {() => (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerClassName="px-5 pb-12 pt-4"
          >
            <SectionHeading
              eyebrow={t("settings.dataPortabilityEyebrow")}
              title={t("settings.dataPortability")}
            />
            <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("settings.dataPortabilityIntro")}
            </Text>

            <SurfaceCard className="mt-5 px-4 py-4">
              <MetaLabel>{t("settings.dataExportTitle")}</MetaLabel>
              <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("settings.dataExportDescription")}
              </Text>
              <Text className="mt-3 font-serif text-3xl italic text-kyar-text dark:text-kyar-dark-text">
                {itemCount}
              </Text>
              <Button
                className="mt-4"
                title={t("settings.dataExportButton")}
                loading={exporting}
                accessibilityLabel={t("settings.dataExportButton")}
                onPress={() => void handleExport()}
              />
            </SurfaceCard>

            <SurfaceCard className="mt-4 px-4 py-4">
              <MetaLabel>{t("settings.dataImportTitle")}</MetaLabel>
              <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("settings.dataImportDescription")}
              </Text>
              <Button
                className="mt-4"
                variant="secondary"
                title={t("settings.dataImportButton")}
                loading={importing}
                accessibilityLabel={t("settings.dataImportButton")}
                onPress={() => void handleImport()}
              />
            </SurfaceCard>

            <View className="mt-5 rounded-2xl bg-kyar-panel px-4 py-4 dark:bg-kyar-dark-panel">
              <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("settings.dataPortabilityFootnote")}
              </Text>
            </View>
          </ScrollView>
        )}
      </DataBoundary>
    </>
  );
}
