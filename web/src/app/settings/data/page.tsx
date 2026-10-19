"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { useConvex } from "convex/react";
import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { offlineRuntime } from "@/lib/offline";
import { readLocalAccount } from "@/lib/auth/localAccount";
import { importKey } from "@/lib/importKey";
import { SettingsGlassShell } from "@/components/settings/SettingsGlassShell";
import { SyncStatus } from "@/components/SyncStatus";
import { readLocalCollections } from "@/lib/localFirstData";
import { getIsOnline } from "@/lib/offline/connectivity";
import {
  buildDataBundle,
  countRows,
  MalformedBundleError,
  NonEmptyVaultError,
  parseDataBundle,
  PORTABLE_COLLECTIONS,
  runImport,
  summarizeTotals,
  validateImport,
  type CreateRowFn,
  type PortableCollectionKey,
} from "@/lib/dataPortability";
import {
  createRestoreSession,
  IncompleteRestoreError,
  readRestoreSession,
  undoRestoreSession,
  type RestoreSession,
} from "@/lib/restoreSession";

type ImportStatus =
  | { kind: "idle" }
  | { kind: "importing" }
  | { kind: "undoing" }
  | { kind: "done"; added: number; skipped: number }
  | { kind: "undone" }
  | { kind: "error"; reason: string };

class RestoreOfflineError extends Error {
  constructor() {
    super("Restore needs an internet connection");
    this.name = "RestoreOfflineError";
  }
}

/** The destination id of a created document; a restore cannot continue without one. */
function createdId<T extends { _id: string }>(created: T | null): T {
  if (!created?._id) throw new Error("Restore did not return a created identity");
  return created;
}

/** Rows in the account's durable store, including any the in-memory mirror has not loaded. */
async function hasDurablePersonalRows(userId: string): Promise<boolean> {
  const rows = await offlineRuntime.getStore().listEntityRows();
  return rows.some(
    (row) =>
      row.userId === userId &&
      !row.deleted &&
      (PORTABLE_COLLECTIONS as readonly string[]).includes(row.table)
  );
}

/** Convex reports a row that is already gone this way; undo treats it as deleted. */
function isAlreadyDeleted(error: unknown): boolean {
  return error instanceof Error && /not found/i.test(error.message);
}

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
      {
        id: row._id,
        dedupeKey: "dedupeKey" in row ? row.dedupeKey : undefined,
      },
      ...("children" in row && Array.isArray(row.children)
        ? flattenGeneratedTasks(row.children)
        : []),
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

  const vaultSubject = useSyncExternalStore(
    offlineRuntime.subscribe,
    () => offlineRuntime.getSubject(),
    () => null
  );
  const [incomplete, setIncomplete] = useState(false);

  /**
   * Restore talks to the server directly: it never queues offline writes, so a lost connection
   * fails the restore (leaving an incomplete session to undo) instead of replaying it later.
   */
  const call = useCallback(
    async <Mutation extends FunctionReference<"mutation">>(
      mutation: Mutation,
      args: FunctionArgs<Mutation>
    ): Promise<FunctionReturnType<Mutation>> => {
      if (!userId || offlineRuntime.getSubject() !== userId || readLocalAccount() !== userId) {
        throw new Error("Local account changed");
      }
      if (!getIsOnline()) throw new RestoreOfflineError();
      return convex.mutation(mutation, args);
    },
    [convex, userId]
  );

  useEffect(() => {
    setIncomplete(false);
    if (!userId || vaultSubject !== userId) return;
    let active = true;
    readRestoreSession(userId).then(
      (session) => {
        if (active) setIncomplete(session !== null);
      },
      () => {
        if (active && offlineRuntime.getSubject() === userId) setIncomplete(true);
      }
    );
    return () => {
      active = false;
    };
  }, [userId, vaultSubject]);

  const collections = useMemo(() => readLocalCollections(userId), [version, userId]);

  const totalRows = countRows(collections);
  const isLoading = authLoading;

  const handleExport = useCallback(() => {
    const bundle = buildDataBundle(collections);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`kyarafit-export-${stamp}.json`, bundle);
  }, [collections]);

  const createRow = useCallback(
    (session: RestoreSession): CreateRowFn =>
      async (collection, row, existingId) => {
        if (!userId) throw new Error("Sign in to import data");
        const idempotencyKey = `${importKey(userId, collection, row)}:${session.id}`;
        switch (collection) {
          case "builds": {
            const created = createdId(
              await call(api.builds.create, {
                userId,
                name: readString(row.name) ?? "Untitled build",
                status: readString(row.status) ?? "idea",
                character: readString(row.character),
                notes: readString(row.notes),
                budgetCents: readNumber(row.budgetCents),
                targetDate: readString(row.targetDate),
                visibility: readString(row.visibility),
                idempotencyKey,
              })
            );
            await session.record("builds", created._id);
            return created;
          }
          case "conventions": {
            const created = createdId(
              await call(api.conventions.create, {
                userId,
                name: readString(row.name) ?? "Untitled event",
                location: readString(row.location),
                startDate: readString(row.startDate) ?? new Date().toISOString().slice(0, 10),
                endDate: readString(row.endDate) ?? new Date().toISOString().slice(0, 10),
                idempotencyKey,
              })
            );
            await session.record("conventions", created._id);
            return created;
          }
          case "cosplayNodes": {
            const created = createdId(
              await call(api.cosplayNodes.create, {
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
              })
            );
            await session.record("cosplayNodes", created._id);
            const workflow = await convex.query(api.workflow.listNodeWorkflow, {
              cosplayNodeId: created._id,
            });
            if (!workflow) throw new Error("Generated element tasks could not be loaded");
            for (const task of flattenGeneratedTasks([
              ...workflow.shared,
              ...workflow.buildSpecific,
            ])) {
              if (
                typeof task.dedupeKey !== "string" ||
                !/^autogen:(buy|wip):/.test(task.dedupeKey) ||
                !task.dedupeKey.endsWith(`:${created._id}`)
              ) continue;
              await session.record("workflowItems", task.id);
            }
            if (row.parentNodeId) {
              await call(api.cosplayNodes.addChildLink, {
                userId,
                parentNodeId: row.parentNodeId as Id<"cosplayNodes">,
                childNodeId: created._id,
                sortOrder: readNumber(row.sortOrder),
              });
            } else if (row.buildId) {
              await call(api.builds.addNodesToBuild, {
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
              attachments: row.attachments as FunctionArgs<
                typeof api.workflow.create
              >["attachments"],
              notes: readString(row.notes),
              kind: readString(row.kind),
              category: readString(row.category),
              status: readString(row.status),
              scopeKind: readString(row.scopeKind),
              sourceKind: readString(row.sourceKind),
              sortOrder: readNumber(row.sortOrder),
              priority: readNumber(row.priority),
              dueDate: readString(row.dueDate),
              targetDate: readString(row.targetDate),
              startDate: readString(row.startDate),
              idempotencyKey,
            };
            if (existingId) {
              // A task the destination generated (element or packing): update it in place.
              await session.record("workflowItems", existingId);
              const { parentId, ...updateFields } = fields;
              await call(api.workflow.update, {
                ...updateFields,
                id: existingId as Id<"workflowItems">,
              });
              await call(api.workflow.move, {
                id: existingId as Id<"workflowItems">,
                parentId: parentId ?? null,
                idempotencyKey,
              });
              return existingId;
            }
            const created = createdId(
              await call(api.workflow.create, { ...fields, dedupeKey: readString(row.dedupeKey) })
            );
            await session.record("workflowItems", created._id);
            return created;
          }
          case "packingListItems": {
            const conventionId = readString(row.conventionId);
            if (!conventionId) throw new Error("Packing item has no restored convention");
            const created = createdId(
              await call(api.conventions.addManualPackingItem, {
                userId,
                conventionId: conventionId as Id<"conventions">,
                label: readString(row.label) ?? "Item",
                date: readString(row.date),
                notes: readString(row.notes),
                buildId: readString(row.buildId) as Id<"builds"> | undefined,
                idempotencyKey,
              })
            );
            await session.record("packingListItems", created._id);
            if (created.workflowItemId) {
              await session.record("workflowItems", created.workflowItemId);
            }
            return created;
          }
          default:
            return;
        }
      },
    [userId, call, convex]
  );

  const generatedTasks = useCallback(
    async (nodeId: string, buildId?: string) => {
      const result = await convex.query(api.workflow.listNodeWorkflow, {
        cosplayNodeId: nodeId as Id<"cosplayNodes">,
        buildId: buildId as Id<"builds"> | undefined,
      });
      if (!result) throw new Error("Generated element tasks could not be loaded");
      return flattenGeneratedTasks([...result.shared, ...result.buildSpecific]);
    },
    [convex]
  );

  const describeError = useCallback(
    (error: unknown) =>
      error instanceof NonEmptyVaultError
        ? t("importRequiresEmptyVault")
        : error instanceof IncompleteRestoreError
          ? t("importIncomplete")
          : error instanceof RestoreOfflineError
            ? t("importRequiresOnline")
            : error instanceof MalformedBundleError
              ? error.message
              : t("importErrorGeneric"),
    [t]
  );

  const handleFile = useCallback(
    async (file: File) => {
      setImportStatus({ kind: "importing" });
      try {
        if (!userId) throw new Error("Sign in to import data");
        if (await readRestoreSession(userId)) throw new IncompleteRestoreError();
        if (!getIsOnline()) throw new RestoreOfflineError();
        const imported = parseDataBundle(await file.text());
        validateImport(imported);
        const existing = readLocalCollections(userId);
        if (countRows(existing) > 0 || (await hasDurablePersonalRows(userId))) {
          throw new NonEmptyVaultError();
        }
        const session = createRestoreSession(userId);
        await session.start();
        const assertCurrent = offlineRuntime.sessionGuard();
        const summary = await runImport({
          imported,
          existing,
          createRow: createRow(session),
          generatedWorkflow: async (nodeId, buildId) => {
            assertCurrent();
            const tasks = await generatedTasks(nodeId, buildId);
            assertCurrent();
            return tasks;
          },
          onRestored: (collection, id, row) =>
            offlineRuntime.writeImportedEntityRow({
              table: collection,
              id,
              userId,
              json: JSON.stringify({ ...row, id, _id: id, userId }),
              updatedAt: Date.now(),
              deleted: false,
              synced: true,
            }),
        });
        await session.complete();
        const { added, skipped } = summarizeTotals(summary);
        setImportStatus({ kind: "done", added, skipped });
      } catch (error) {
        setImportStatus({ kind: "error", reason: describeError(error) });
      } finally {
        if (userId) setIncomplete((await readRestoreSession(userId).catch(() => null)) !== null);
      }
    },
    [createRow, describeError, generatedTasks, userId]
  );

  const handleUndo = useCallback(async () => {
    if (!userId) return;
    setImportStatus({ kind: "undoing" });
    const remove: Record<PortableCollectionKey, (id: string) => Promise<unknown>> = {
      builds: (id) => call(api.builds.remove, { id: id as Id<"builds"> }),
      conventions: (id) => call(api.conventions.remove, { id: id as Id<"conventions"> }),
      cosplayNodes: (id) => call(api.cosplayNodes.remove, { id: id as Id<"cosplayNodes"> }),
      workflowItems: (id) => call(api.workflow.remove, { id: id as Id<"workflowItems"> }),
      packingListItems: (id) =>
        call(api.conventions.deletePackingItem, { id: id as Id<"packingListItems"> }),
    };
    try {
      if (!getIsOnline()) throw new RestoreOfflineError();
      await undoRestoreSession({
        subject: userId,
        deleteRow: async (collection, id) => {
          try {
            await remove[collection](id);
          } catch (error) {
            if (!isAlreadyDeleted(error)) throw error;
          }
        },
      });
      setImportStatus({ kind: "undone" });
    } catch (error) {
      setImportStatus({ kind: "error", reason: describeError(error) });
    } finally {
      setIncomplete((await readRestoreSession(userId).catch(() => null)) !== null);
    }
  }, [call, describeError, userId]);

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
          {incomplete && (
            <div className="mt-4 space-y-3" data-testid="import-incomplete">
              <p className="text-sm text-on-glass-danger" role="alert">
                {t("importIncomplete")}
              </p>
              <button
                type="button"
                onClick={() => void handleUndo()}
                disabled={importStatus.kind === "importing" || importStatus.kind === "undoing"}
                className="min-h-[44px] inline-flex items-center rounded-full bg-glass-solid px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importStatus.kind === "undoing" ? t("undoingRestore") : t("undoRestoreButton")}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={
              incomplete || importStatus.kind === "importing" || importStatus.kind === "undoing"
            }
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
            {importStatus.kind === "undone" && (
              <p className="text-sm" data-testid="import-undone">
                {t("restoreUndone")}
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
