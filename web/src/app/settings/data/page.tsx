"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useConvex } from "convex/react";
import { createImportIdentityStore } from "@/lib/importIdentityStore";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { importKey } from "@/lib/importKey";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { offlineRuntime, useOfflineMutation } from "@/lib/offline";
import { SettingsGlassShell } from "@/components/settings/SettingsGlassShell";
import { SyncStatus } from "@/components/SyncStatus";
import { readLocalCollections } from "@/lib/localFirstData";
import { getIsOnline } from "@/lib/offline/connectivity";
import {
  buildDataBundle,
  countRows,
  MalformedBundleError,
  parseDataBundle,
  runImport,
  summarizeTotals,
  type CreateRowFn,
  type ImportIdentityStore,
} from "@/lib/dataPortability";

type ImportStatus =
  | { kind: "idle" }
  | { kind: "importing" }
  | { kind: "done"; added: number; skipped: number }
  | { kind: "error"; reason: string };

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

/** Trigger a browser download of `contents` as `filename`. No-op safe outside a DOM. */
function downloadFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function flattenGeneratedTasks(rows: readonly unknown[]): { id: string; dedupeKey: unknown }[] {
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object" || !("_id" in row) || typeof row._id !== "string") {
      throw new Error("Invalid generated workflow item");
    }
    return [
      { id: row._id, dedupeKey: "dedupeKey" in row ? row.dedupeKey : undefined },
      ...("children" in row && Array.isArray(row.children) ? flattenGeneratedTasks(row.children) : []),
    ];
  });
}

export default function SettingsDataPage() {
  const convex = useConvex();
  const t = useTranslations("DataPortability");
  const { userId, isLoading: authLoading } = useCurrentUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<ImportStatus>({ kind: "idle" });

  // Existing-data read: source every local-first collection from the LOCAL STORE via the offline
  // runtime (DATA_AND_SYNC.md §11, invariant #2), not `sync.listChangedSince` (cloud). This includes
  // a FREE user's locally-created rows — which never reach Convex — so their export is not empty
  // (REQ-D100). Subscribing to the runtime version re-renders (and re-reads) after each offline write.
  const version = useSyncExternalStore(
    offlineRuntime.subscribe,
    offlineRuntime.getVersion,
    offlineRuntime.getVersion
  );

  const createBuild = useOfflineMutation(api.builds.create);
  const createConvention = useOfflineMutation(api.conventions.create);
  const createNode = useOfflineMutation(api.cosplayNodes.create);
  const addChildNode = useOfflineMutation(api.cosplayNodes.addChildLink);
  const addBuildNodes = useOfflineMutation(api.builds.addNodesToBuild);
  const createWorkflowItem = useOfflineMutation(api.workflow.create);
  const updateWorkflowItem = useOfflineMutation(api.workflow.update);
  const moveWorkflowItem = useOfflineMutation(api.workflow.move);
  const createPackingItem = useOfflineMutation(api.conventions.addManualPackingItem);

  const collections = useMemo(() => readLocalCollections(userId), [version, userId]);

  const totalRows = countRows(collections);
  const isLoading = authLoading;

  const handleExport = useCallback(() => {
    const bundle = buildDataBundle(collections);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`kyarafit-export-${stamp}.json`, bundle);
  }, [collections]);

  const createRow = useCallback(
    (identities: ImportIdentityStore): CreateRowFn => async (collection, row, existingId) => {
      if (!userId) throw new Error("Sign in to import data");
      const idempotencyKey = importKey(userId, collection, row);
      switch (collection) {
        case "builds":
          return createBuild({
            userId,
            name: readString(row.name) ?? "Untitled build",
            status: readString(row.status) ?? "idea",
            character: readString(row.character),
            notes: readString(row.notes),
            budgetCents: readNumber(row.budgetCents),
            targetDate: readString(row.targetDate),
            visibility: readString(row.visibility),
            idempotencyKey,
          });
        case "conventions":
          return createConvention({
            userId,
            name: readString(row.name) ?? "Untitled event",
            location: readString(row.location),
            startDate: readString(row.startDate) ?? new Date().toISOString().slice(0, 10),
            endDate: readString(row.endDate) ?? new Date().toISOString().slice(0, 10),
            idempotencyKey,
          });
        case "cosplayNodes": {
          const created = existingId ? { _id: existingId as Id<"cosplayNodes"> } : await createNode({
            userId,
            nodeType: readString(row.nodeType)!,
            name: readString(row.name) ?? "Untitled element",
            tags: (row.tags ?? []) as string[],
            category: readString(row.category),
            notes: readString(row.notes),
            sourceUrl: readString(row.sourceUrl),
            pricingMode: readString(row.pricingMode),
            directCostCents: readNumber(row.directCostCents),
            unitCostCents: readNumber(row.unitCostCents),
            quantity: readNumber(row.quantity),
            unit: readString(row.unit),
            purchaseStatus: readString(row.purchaseStatus),
            buildStatus: readString(row.buildStatus),
            materialStatus: readString(row.materialStatus),
            manualOverallBucket: readString(row.manualOverallBucket),
            buildInstructions: readString(row.buildInstructions),
            consumable: typeof row.consumable === "boolean" ? row.consumable : undefined,
          });
          if (!created?._id) throw new Error("Element restore did not return an identity");
          await identities.write("cosplayNodes", row.id, {
            id: created._id, complete: false, row,
          });
          if (row.parentNodeId) {
            await addChildNode({
              userId,
              parentNodeId: row.parentNodeId as Id<"cosplayNodes">,
              childNodeId: created._id,
              sortOrder: readNumber(row.sortOrder),
            });
          } else if (row.buildId) {
            await addBuildNodes({
              userId,
              buildId: row.buildId as Id<"builds">,
              cosplayNodeIds: [created._id],
              idempotencyKey,
            });
          }
          return created;
        }
        case "workflowItems": {
          const fields = {
            userId,
            title: readString(row.title) ?? "Untitled task",
            parentId: readString(row.parentId) as Id<"workflowItems"> | undefined,
            attachments: row.attachments as Parameters<typeof createWorkflowItem>[0]["attachments"],
            notes: readString(row.notes),
            kind: readString(row.kind),
            category: readString(row.category),
            status: readString(row.status),
            sortOrder: readNumber(row.sortOrder),
            priority: readNumber(row.priority),
            dueDate: readString(row.dueDate),
            targetDate: readString(row.targetDate),
            startDate: readString(row.startDate),
            idempotencyKey,
          };
          if (existingId) {
            const { parentId, ...updateFields } = fields;
            await updateWorkflowItem({ ...updateFields, id: existingId as Id<"workflowItems"> });
            await moveWorkflowItem({
              id: existingId as Id<"workflowItems">,
              parentId: parentId ?? null,
              idempotencyKey,
            });
            return existingId;
          }
          return createWorkflowItem(fields);
        }
        case "packingListItems": {
          const conventionId = readString(row.conventionId);
          if (!conventionId) throw new Error("Packing item has no restored convention");
          return createPackingItem({
            userId,
            conventionId: conventionId as Id<"conventions">,
            label: readString(row.label) ?? "Item",
            date: readString(row.date),
            notes: readString(row.notes),
            buildId: readString(row.buildId) as Id<"builds"> | undefined,
            idempotencyKey,
          });
        }
        default:
          return;
      }
    },
    [
      userId,
      createBuild,
      createConvention,
      createNode,
      addChildNode,
      addBuildNodes,
      createWorkflowItem,
      updateWorkflowItem,
      moveWorkflowItem,
      createPackingItem,
    ]
  );

  const handleFile = useCallback(
    async (file: File) => {
      setImportStatus({ kind: "importing" });
      try {
        const text = await file.text();
        const imported = parseDataBundle(text);
        if (imported.cosplayNodes.length && !getIsOnline()) {
          throw new MalformedBundleError("Element backups must be restored while online.");
        }
        if (!userId) throw new Error("Sign in to import data");
        const identities = createImportIdentityStore(userId);
        const assertCurrent = offlineRuntime.sessionGuard();
        const summary = await runImport({
          imported,
          existing: collections,
          createRow: createRow(identities),
          identities,
          generatedWorkflow: async (nodeId, buildId) => {
            assertCurrent();
            const result = await convex.query(api.workflow.listNodeWorkflow, {
              cosplayNodeId: nodeId as Id<"cosplayNodes">,
              buildId: buildId as Id<"builds"> | undefined,
            });
            assertCurrent();
            if (!result) throw new Error("Generated element tasks could not be loaded");
            return flattenGeneratedTasks([...result.shared, ...result.buildSpecific]);
          },
        });
        const { added, skipped } = summarizeTotals(summary);
        setImportStatus({ kind: "done", added, skipped });
      } catch (error) {
        const reason =
          error instanceof MalformedBundleError ? error.message : t("importErrorGeneric");
        setImportStatus({ kind: "error", reason });
      }
    },
    [collections, createRow, t, userId, convex]
  );

  const onFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      // Reset so selecting the same file again re-triggers change (re-import is idempotent anyway).
      event.target.value = "";
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  return (
    <SettingsGlassShell eyebrow={t("subtitle")} title={t("title")} backLabel={t("backToSettings")}>
      <div className="space-y-8">
        <SyncStatus />
        <section className="[&:not(:first-child)]:border-t [&:not(:first-child)]:border-glass-divider-strong [&:not(:first-child)]:pt-6">
          <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-3">
            {t("exportTitle")}
          </span>
          <p className="text-sm leading-6 text-media-fg-70">{t("exportDescription")}</p>
          <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
            {isLoading ? t("loading") : t("itemCount", { count: totalRows })}
          </p>
          <button
            type="button"
            onClick={handleExport}
            disabled={isLoading}
            className="mt-4 min-h-[44px] inline-flex items-center rounded-full bg-glass-solid px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("exportButton")}
          </button>
        </section>

        <section className="border-t border-glass-divider-strong pt-6">
          <span className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-3">
            {t("importTitle")}
          </span>
          <p className="text-sm leading-6 text-media-fg-70">{t("importDescription")}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={onFileChange}
            className="sr-only"
            aria-label={t("importButton")}
            data-testid="import-file-input"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={importStatus.kind === "importing"}
            className="mt-4 min-h-[44px] inline-flex items-center rounded-full border border-glass-border-strong bg-glass-bar px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importStatus.kind === "importing" ? t("importing") : t("importButton")}
          </button>

          <div aria-live="polite" className="mt-4 min-h-[1.25rem]">
            {importStatus.kind === "done" && (
              <p className="text-sm" data-testid="import-summary">
                {t("importSummary", {
                  added: importStatus.added,
                  skipped: importStatus.skipped,
                })}
              </p>
            )}
            {importStatus.kind === "error" && (
              <p className="text-sm text-on-glass-danger" role="alert" data-testid="import-error">
                {importStatus.reason}
              </p>
            )}
          </div>
        </section>
      </div>
    </SettingsGlassShell>
  );
}
