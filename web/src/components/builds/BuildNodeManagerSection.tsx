"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useOfflineQuery } from "@/lib/offline";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

import { formatNodeStatus } from "@kyarafit/design-system/domain";
import { BuildExplorerBreadcrumb } from "./explorer/BuildExplorerBreadcrumb";
import { BuildExplorerTree } from "./explorer/BuildExplorerTree";
import { BuildExplorerToolbar } from "./explorer/BuildExplorerToolbar";
import { BuildNodeDetailSheet } from "./explorer/BuildNodeDetailSheet";
import { DragPreviewRow } from "./explorer/BuildExplorerRow";
import { useExplorerDrag } from "./explorer/useExplorerDrag";
import { useNodeInspector } from "./explorer/useNodeInspector";
import type {
  CosplayNodeId,
  ExplorerLinkedNode,
  NodeSelectionMeta,
  PathSegment,
} from "./explorer/types";

export type BuildNodeManagerLinkedNode = ExplorerLinkedNode;

type BuildNodeManagerSectionProps = {
  buildId: Id<"builds">;
  buildName: string;
  userId: string | null;
  linkedNodes: ExplorerLinkedNode[];
  linkedNodeIds: CosplayNodeId[];
  onOpenLinkNodes: () => void;
  onCreateRoot: () => void;
  onCreateChild: (parentId: CosplayNodeId, initialNodeType: "element" | "material") => void;
};

export function BuildNodeManagerSection({
  buildId,
  buildName,
  userId,
  linkedNodes,
  linkedNodeIds,
  onOpenLinkNodes,
  onCreateRoot,
  onCreateChild,
}: BuildNodeManagerSectionProps) {
  const allNodes = (useOfflineQuery(
    api.cosplayNodes.list,
    userId ? { userId, sortBy: "name" } : "skip"
  ) ?? []) as ExplorerLinkedNode[];

  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  const inspector = useNodeInspector({ buildId, userId });
  const {
    selected,
    selectedPath,
    setSelectedPath,
    selectedDetail,
    persistStatus,
    inspectorForm,
    setInspectorForm,
    commitSelection,
    flushSave,
    unlinkSelected,
  } = inspector;

  const dragHook = useExplorerDrag({
    buildId,
    userId,
    linkedNodeIds,
    allNodes,
    commitSelection,
  });
  const { drag, graphError, setDragState } = dragHook;

  const searchNeedle = search.trim().toLowerCase();
  const roots = useMemo(
    () =>
      linkedNodes
        .map((node) => ({
          node,
          rootIndex: linkedNodeIds.findIndex((id) => id === node._id),
        }))
        .filter(({ node }) =>
          !searchNeedle
            ? true
            : `${node.name} ${node.category ?? ""} ${node.nodeType} ${formatNodeStatus(node)}`
                .toLowerCase()
                .includes(searchNeedle)
        ),
    [linkedNodes, linkedNodeIds, searchNeedle]
  );

  // Auto-select first root when list changes
  useEffect(() => {
    if (roots.length === 0) return;
    if (selected && roots.some(({ node }) => node._id === selected.nodeId)) return;
    // Don't auto-select on mobile (let user navigate explicitly)
  }, [roots, selected]);

  const handleSelectNode = useCallback(
    (meta: NodeSelectionMeta, path: PathSegment[]) => {
      void commitSelection(meta, path);
      setSheetOpen(true);
    },
    [commitSelection]
  );

  const handleBreadcrumbNavigate = useCallback(
    (index: number) => {
      const path = selectedPath.slice(0, index + 1);
      const seg = path[path.length - 1];
      if (!seg) return;
      void commitSelection(seg.meta, path);
    },
    [selectedPath, commitSelection]
  );

  const handleNavigateToRoot = useCallback(() => {
    const first = roots[0];
    if (!first) return;
    const meta: NodeSelectionMeta = {
      nodeId: first.node._id,
      isRoot: true,
      rootIndex: first.rootIndex,
    };
    void commitSelection(meta, [{ meta, label: first.node.name }]);
  }, [roots, commitSelection]);

  const handleDragStart = useCallback(
    (meta: NodeSelectionMeta, x: number, y: number) => {
      if (!userId) return;
      setDragState({
        draggingNodeId: meta.nodeId,
        draggingMeta: meta,
        dragOverNodeId: null,
        dragOverZone: null,
        pointerX: x,
        pointerY: y,
      });
    },
    [userId, setDragState]
  );

  const handleCloseSheet = useCallback(() => {
    setSheetOpen(false);
  }, []);

  const handleUnlink = useCallback(async () => {
    await unlinkSelected();
    setSheetOpen(false);
  }, [unlinkSelected]);

  if (roots.length === 0 && !searchNeedle) {
    return (
      <div className="space-y-4">
        <div className="rounded-glass border border-dashed border-kyar-media-ring px-5 py-12 text-center text-kyar-media-fg">
          <span className="material-symbols-outlined mb-3 block text-3xl text-media-fg-45">
            account_tree
          </span>
          <p className="text-sm text-media-fg-70">
            No linked elements yet. Add a main element or link an existing element to start
            building.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onCreateRoot}
              className="inline-flex items-center gap-1.5 rounded-full bg-glass-solid px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-base">add</span>
              New main element
            </button>
            <button
              type="button"
              onClick={onOpenLinkNodes}
              className="inline-flex items-center gap-1.5 rounded-full border border-glass-border-strong bg-glass-bar px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg hover:bg-glass-active transition-colors"
            >
              <span className="material-symbols-outlined text-base">link</span>
              Link existing
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col text-kyar-media-fg">
        {/* Toolbar */}
        <BuildExplorerToolbar
          search={search}
          onSearchChange={setSearch}
          onCreateRoot={onCreateRoot}
          onOpenLinkNodes={onOpenLinkNodes}
          rootCount={roots.length}
          matchCount={searchNeedle ? roots.length : undefined}
        />

        {/* Breadcrumb */}
        <BuildExplorerBreadcrumb
          buildName={buildName}
          path={selectedPath}
          onNavigateToRoot={handleNavigateToRoot}
          onNavigateToSegment={handleBreadcrumbNavigate}
        />

        {/* Single-pane recursive tree; detail opens as the 8b overlay sheet */}
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {/* Root drop zone during drag */}
            {drag.draggingNodeId ? (
              <div className="px-3 pt-2">
                <button
                  type="button"
                  data-root-drop-zone="true"
                  className={[
                    "flex w-full items-center justify-center rounded-lg border px-3 py-2.5 text-[10px] uppercase tracking-[0.16em] transition-colors",
                    drag.dragOverNodeId === "__root__"
                      ? "border-glass-border-strong bg-glass-active text-kyar-media-fg"
                      : "border-glass-border text-media-fg-55",
                  ].join(" ")}
                >
                  {drag.dragOverNodeId === "__root__"
                    ? "Release to make main element"
                    : "Drop here to make this a main element"}
                </button>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              <BuildExplorerTree
                buildId={buildId}
                userId={userId}
                roots={roots}
                selectedNodeId={selected?.nodeId ?? null}
                drag={drag}
                onSelect={handleSelectNode}
                onDragStart={handleDragStart}
              />
            </div>

            {/* Status footer */}
            <div className="font-explorer-mono hidden shrink-0 items-center gap-4 border-t border-glass-divider px-4 py-2 text-[10px] tabular-nums text-media-fg-55 md:flex">
              <span>
                {searchNeedle
                  ? `${roots.length} match${roots.length === 1 ? "" : "es"}`
                  : `${roots.length} root${roots.length === 1 ? "" : "s"}`}
              </span>
              {selected && selectedDetail ? (
                <span className="truncate">Selected: {selectedDetail.name}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Detail sheet — bottom sheet on mobile, right sheet on desktop (8b overlay) */}
      {sheetOpen ? (
        <BuildNodeDetailSheet
          detail={selectedDetail}
          selected={selected}
          inspectorForm={inspectorForm}
          persistStatus={persistStatus}
          onFormChange={setInspectorForm}
          onFlushSave={() => void flushSave()}
          onCreateChild={onCreateChild}
          onUnlink={handleUnlink}
          onClose={handleCloseSheet}
        />
      ) : null}

      {/* Floating drag preview */}
      {drag.draggingMeta &&
      drag.draggingNodeId &&
      drag.pointerX != null &&
      drag.pointerY != null ? (
        <div
          className="pointer-events-none fixed left-0 top-0 z-[80] w-[min(380px,calc(100vw-32px))]"
          style={{
            transform: `translate(${Math.min(drag.pointerX + 16, (typeof window !== "undefined" ? window.innerWidth : 1200) - 400)}px, ${Math.min(
              drag.pointerY + 16,
              (typeof window !== "undefined" ? window.innerHeight : 800) - 100
            )}px)`,
          }}
        >
          <DragPreviewRow
            node={allNodes.find((n) => n._id === drag.draggingMeta!.nodeId) ?? linkedNodes[0]}
            label={
              drag.dragOverNodeId === "__root__"
                ? "Make main element"
                : drag.dragOverZone === "before"
                  ? "Move before"
                  : drag.dragOverZone === "after"
                    ? "Move after"
                    : drag.dragOverZone === "into"
                      ? "Place inside"
                      : "Move element"
            }
          />
        </div>
      ) : null}

      {/* Graph constraint error */}
      {graphError ? (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {graphError}
        </p>
      ) : null}
    </div>
  );
}
