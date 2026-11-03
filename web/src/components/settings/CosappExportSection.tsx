"use client";

import { useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useConvex } from "convex/react";
import { useTranslations } from "next-intl";
import type { CosappReceipt } from "@kyarafit/design-system/domain/cosappExport";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  readLocalAccount,
  readOnline,
  subscribeConnectivity,
  subscribeLocalAccount,
} from "@/lib/auth/localAccount";
import { buildCosappDownload } from "@/lib/cosappArchive";

const COUNTED = ["builds", "pieces", "tasks", "conventions", "photos"] as const;

function saveFile(fileName: string, bytes: Uint8Array): void {
  const blob = new Blob([bytes as BlobPart], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Settings → Backup & data → "Download for Cosapp.si": the account's data as a Cosapp.si backup
 * file, to import there with Merge. Built from the server copy, so it needs a connection and a
 * signed-in account; afterwards it shows what came over and what was left out, and why.
 */
export function CosappExportSection() {
  const t = useTranslations("CosappExport");
  const convex = useConvex();
  const { userId, isLoading, isAuthenticated } = useCurrentUser();
  const online = useSyncExternalStore(subscribeConnectivity, readOnline, () => true);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<{ fileName: string; receipt: CosappReceipt } | null>(null);

  const controller = useRef<AbortController | null>(null);
  useLayoutEffect(() => {
    const unsubscribe = subscribeLocalAccount(() => controller.current?.abort());
    return () => {
      unsubscribe();
      controller.current?.abort();
    };
  }, [userId, isAuthenticated]);

  const available = online && isAuthenticated && !isLoading;

  const handleDownload = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    const { signal } = current;
    if (readLocalAccount() !== userId) return;
    setFailed(false);
    setDone(null);
    setBusy(true);
    try {
      const download = await buildCosappDownload(convex, {
        signal,
        onProgress: (doneBatches, total) => setProgress({ done: doneBatches, total }),
      });
      if (signal.aborted || readLocalAccount() !== userId) return;
      saveFile(download.fileName, download.bytes);
      setDone({ fileName: download.fileName, receipt: download.receipt });
    } catch {
      if (!signal.aborted) setFailed(true);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }, [convex, userId]);

  return (
    <section
      className="border-t border-glass-divider-strong pt-6"
      data-testid="cosapp-export"
      aria-labelledby="cosapp-export-title"
    >
      <span
        id="cosapp-export-title"
        className="block text-[10px] font-bold uppercase tracking-[0.22em] opacity-60 mb-3"
      >
        {t("title")}
      </span>
      <p className="text-sm leading-6 text-media-fg-70">{t("description")}</p>
      {!available && !isLoading && (
        <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-media-fg-55">
          {t("needsConnection")}
        </p>
      )}
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={!available || busy}
        aria-busy={busy}
        className="mt-4 min-h-[44px] inline-flex items-center rounded-full bg-glass-solid px-6 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {!busy
          ? t("button")
          : progress && progress.total > 0
            ? t("photosProgress", progress)
            : t("preparing")}
      </button>
      {failed && (
        <p
          role="alert"
          className="mt-4 rounded-2xl border border-glass-border-strong bg-glass-active px-4 py-3 text-sm leading-6 text-on-glass-danger"
        >
          {t("failed")}
        </p>
      )}
      {done && (
        <div aria-live="polite" className="mt-4 space-y-3 text-sm leading-6 text-media-fg-70">
          <p>{t("downloaded", { fileName: done.fileName })}</p>
          <ul className="flex flex-wrap gap-x-4 gap-y-1" data-testid="cosapp-receipt-counts">
            {COUNTED.map((table) => (
              <li key={table}>{t(`counts.${table}`, { count: done.receipt.counts[table] })}</li>
            ))}
          </ul>
          {done.receipt.reshaped.length > 0 && (
            <ul className="list-disc space-y-1 pl-5" data-testid="cosapp-receipt-reshaped">
              {done.receipt.reshaped.map((entry) => (
                <li key={entry.kind}>{t(`reshaped.${entry.kind}`, { count: entry.count })}</li>
              ))}
            </ul>
          )}
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] opacity-60">
            {t("leftOutTitle")}
          </p>
          <ul className="list-disc space-y-1 pl-5" data-testid="cosapp-receipt-dropped">
            {done.receipt.dropped.map((entry) => (
              <li key={entry.kind}>{t(`dropped.${entry.kind}`, { count: entry.count ?? 0 })}</li>
            ))}
          </ul>
          <p>{t("nextStep")}</p>
        </div>
      )}
    </section>
  );
}
