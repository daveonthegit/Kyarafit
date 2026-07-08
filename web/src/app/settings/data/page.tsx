"use client";

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { ExportableRow } from "@kyarafit/design-system/domain/importExport";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { offlineRuntime, useOfflineMutation } from "@/lib/offline";
import { SettingsGlassShell } from "@/components/settings/SettingsGlassShell";
import { readLocalCollections } from "@/lib/localFirstData";
import {
  buildDataBundle,
  countRows,
  MalformedBundleError,
  parseDataBundle,
  runImport,
  summarizeTotals,
  type CreateRowFn,
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

/** Stable key so the backend create mutations dedupe a re-import server-side too (REQ-D62). */
function importKey(collection: string, row: ExportableRow): string {
  return `import:${collection}:${row.id}`;
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

export default function SettingsDataPage() {
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
  const createWorkflowItem = useOfflineMutation(api.workflow.create);
  const createPackingItem = useOfflineMutation(api.conventions.addManualPackingItem);

  const collections = useMemo(() => readLocalCollections(), [version]);

  const totalRows = countRows(collections);
  const isLoading = authLoading;

  const handleExport = useCallback(() => {
    const bundle = buildDataBundle(collections);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`kyarafit-export-${stamp}.json`, bundle);
  }, [collections]);

  const createRow = useCallback<CreateRowFn>(
    async (collection, row) => {
      if (!userId) return;
      const idempotencyKey = importKey(collection, row);
      switch (collection) {
        case "builds":
          await createBuild({
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
          return;
        case "conventions":
          await createConvention({
            userId,
            name: readString(row.name) ?? "Untitled event",
            location: readString(row.location),
            startDate: readString(row.startDate) ?? new Date().toISOString().slice(0, 10),
            endDate: readString(row.endDate) ?? new Date().toISOString().slice(0, 10),
            idempotencyKey,
          });
          return;
        case "workflowItems":
          await createWorkflowItem({
            userId,
            title: readString(row.title) ?? "Untitled task",
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
          });
          return;
        case "packingListItems": {
          const conventionId = readString(row.conventionId);
          if (!conventionId) return;
          await createPackingItem({
            userId,
            conventionId: conventionId as Id<"conventions">,
            label: readString(row.label) ?? "Item",
            date: readString(row.date),
            notes: readString(row.notes),
            buildId: readString(row.buildId) as Id<"builds"> | undefined,
            idempotencyKey,
          });
          return;
        }
        default:
          return;
      }
    },
    [userId, createBuild, createConvention, createWorkflowItem, createPackingItem]
  );

  const handleFile = useCallback(
    async (file: File) => {
      setImportStatus({ kind: "importing" });
      try {
        const text = await file.text();
        const imported = parseDataBundle(text);
        const summary = await runImport({ imported, existing: collections, createRow });
        const { added, skipped } = summarizeTotals(summary);
        setImportStatus({ kind: "done", added, skipped });
      } catch (error) {
        const reason =
          error instanceof MalformedBundleError ? error.message : t("importErrorGeneric");
        setImportStatus({ kind: "error", reason });
      }
    },
    [collections, createRow, t]
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
        <section>
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
