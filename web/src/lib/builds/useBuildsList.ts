"use client";

import { useMemo } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "convex/_generated/api";
import {
  filterAndSortBuilds,
  type BuildListItem,
  type BuildListView,
} from "@kyarafit/design-system/domain/buildsList";
import { deriveBuildBlendedProgress } from "@kyarafit/design-system/domain/workflowProgress";
import { useOfflineQuery, useOfflineMutation } from "@/lib/offline";

/**
 * Wave 3 migrated slice: the Builds list reads/writes through the local-first offline bridge instead
 * of `convex/react`. The full build docs come from `useOfflineQuery(api.builds.list)` (SWR + pending
 * overlay), then filtering/sorting happens LOCALLY via the shared `filterAndSortBuilds` domain helper
 * (PRODUCT_SPEC §4.3 / DATA_AND_SYNC §5) — not via server query args. Writes go through
 * `useOfflineMutation`, so offline creates/edits/deletes are queued + shown optimistically.
 *
 * All OTHER web screens still use their existing `convex/react` hooks; only this slice is migrated.
 */
export type BuildListRow = FunctionReturnType<typeof api.builds.list>[number];

function toListItem(row: BuildListRow): BuildListItem {
  return {
    _id: row._id,
    name: row.name,
    status: row.status,
    // Reproduce the server's blended progress locally (the `list` query strips `progress`, but the
    // component percentages it derives from are present), so local sort-by-progress matches.
    progressPercent: deriveBuildBlendedProgress({
      manualProgressPercent: row.manualProgressPercent,
      workflowProgressPercent: row.workflowProgressPercent,
      nodeProgressPercent: row.nodeProgressPercent,
      packingProgressPercent: row.packingProgressPercent,
    }),
    targetDate: row.targetDate ?? null,
    budgetCents: row.budgetCents ?? null,
    character: row.character ?? null,
  };
}

export interface UseBuildsListParams {
  userId: string | null;
  view: BuildListView;
}

export interface UseBuildsListResult {
  /** Full build docs after local filter + sort; ready to render. */
  builds: BuildListRow[];
  isLoading: boolean;
  createBuild: ReturnType<typeof useOfflineMutation<typeof api.builds.create>>;
  removeMany: ReturnType<typeof useOfflineMutation<typeof api.builds.removeMany>>;
  updateStatusMany: ReturnType<typeof useOfflineMutation<typeof api.builds.updateStatusMany>>;
}

export function useBuildsList({ userId, view }: UseBuildsListParams): UseBuildsListResult {
  // Fetch all of the user's builds; filter/sort locally (spec: builds are local-first). `sortBy` /
  // `order` are still passed so the online server result is pre-ordered, but local ordering is the
  // source of truth so offline-created rows sort correctly too.
  const raw = useOfflineQuery(
    api.builds.list,
    userId ? { userId, sortBy: view.sortBy, order: view.order } : "skip"
  );

  const createBuild = useOfflineMutation(api.builds.create);
  const removeMany = useOfflineMutation(api.builds.removeMany);
  const updateStatusMany = useOfflineMutation(api.builds.updateStatusMany);

  const builds = useMemo(() => {
    const rows = raw ?? [];
    const byId = new Map<string, BuildListRow>(rows.map((row) => [row._id, row]));
    const ordered = filterAndSortBuilds(rows.map(toListItem), view);
    return ordered
      .map((item) => byId.get(item._id))
      .filter((row): row is BuildListRow => row !== undefined);
  }, [raw, view]);

  return {
    builds,
    isLoading: userId !== null && raw === undefined,
    createBuild,
    removeMany,
    updateStatusMany,
  };
}
