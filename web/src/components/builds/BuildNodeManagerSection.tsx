"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

import { formatNodeStatus } from "@kyarafit/design-system/domain";
import { BuildExplorerBreadcrumb } from "./explorer/BuildExplorerBreadcrumb";
import { BuildExplorerDrillDown } from "./explorer/BuildExplorerDrillDown";
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
  const allNodes = (useQuery(
    api.cosplayNodes.list,
    userId ? { userId, sortBy: "name" } : "skip"
  ) ?? []) as ExplorerLinkedNode[];

  const [search, setSearch] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [drillStack, setDrillStack] = useState<PathSegment[]>([]);

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

  const handleDrillInto = useCallback(
    (meta: NodeSelectionMeta, path: PathSegment[]) => {
      setDrillStack(path);
      void commitSelection(meta, path);
    },
    [commitSelection]
  );

  const handleDrillBack = useCallback(() => {
    if (drillStack.length <= 1) {
      setDrillStack([]);
      return;
    }
    const newStack = drillStack.slice(0, -1);
    setDrillStack(newStack);
    const last = newStack[newStack.length - 1];
    if (last) {
      void commitSelection(last.meta, newStack);
    }
  }, [drillStack, commitSelection]);

  const handleBreadcrumbNavigate = useCallback(
    (index: number) => {
      const path = selectedPath.slice(0, index + 1);
      const seg = path[path.length - 1];
      if (!seg) return;
      setDrillStack(path);
      void commitSelection(seg.meta, path);
    },
    [selectedPath, commitSelection]
  );

  const handleNavigateToRoot = useCallback(() => {
    setDrillStack([]);
    const first = roots[0];
    if (!first) return;
    const meta: NodeSelectionMeta = { nodeId: first.node._id, isRoot: true, rootIndex: first.rootIndex };
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
        <div className="rounded-xl border border-dashed border-kyar-borderSubtle bg-kyar-surface px-5 py-12 text-center">
          <span className="material-symbols-outlined mb-3 block text-3xl text-kyar-textTertiary">
            account_tree
          </span>
          <p className="text-sm text-kyar-textSecondary">
            No linked nodes yet. Create a root node or link an existing element to start building.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={onCreateRoot}
              className="inline-flex items-center gap-1.5 rounded-lg bg-kyar-text px-4 py-2.5 text-[11px] font-medium uppercase tracking-widest text-kyar-bg"
            >
              <span className="material-symbols-outlined text-base">add</span>
              New root
            </button>
            <button
              type="button"
              onClick={onOpenLinkNodes}
              className="inline-flex items-center gap-1.5 rounded-lg border border-kyar-borderSubtle px-4 py-2.5 text-[11px] font-medium uppercase tracking-widest text-kyar-text"
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
    <div className="space-y-0">
      <div className="overflow-hidden rounded-xl border border-kyar-borderSubtle bg-kyar-surface shadow-soft">
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
          onDrillBack={drillStack.length > 0 ? handleDrillBack : undefined}
        />

        {/* Layout: tree/drill-down + optional desktop panel */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px] lg:divide-x lg:divide-kyar-borderSubtle">
          {/* Main content area */}
          <div className="min-w-0">
            {/* Root drop zone during drag */}
            {drag.draggingNodeId ? (
              <div className="px-3 pt-2">
                <button
                  type="button"
                  data-root-drop-zone="true"
                  className={[
                    "flex w-full items-center justify-center rounded-lg border border-dashed px-3 py-2.5 text-[10px] uppercase tracking-widest transition-colors",
                    drag.dragOverNodeId === "__root__"
                      ? "border-kyar-text bg-kyar-text text-kyar-bg"
                      : "border-kyar-borderSubtle text-kyar-textTertiary",
                  ].join(" ")}
                >
                  {drag.dragOverNodeId === "__root__"
                    ? "Release to promote to root"
                    : "Drop to promote to root"}
                </button>
              </div>
            ) : null}

            <div className="max-h-[min(640px,78vh)] overflow-y-auto">
              {/* Desktop: collapsible tree */}
              <div className="hidden md:block">
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

              {/* Mobile: drill-down */}
              <div className="block md:hidden">
                <BuildExplorerDrillDown
                  buildId={buildId}
                  userId={userId}
                  roots={roots}
                  drillStack={drillStack}
                  selectedNodeId={selected?.nodeId ?? null}
                  drag={drag}
                  onDrillInto={handleDrillInto}
                  onSelectLeaf={handleSelectNode}
                  onDragStart={handleDragStart}
                />
              </div>
            </div>

            {/* Status footer */}
            <div className="hidden items-center gap-4 border-t border-kyar-borderSubtle bg-kyar-bg px-4 py-2 text-[10px] tabular-nums text-kyar-textTertiary md:flex">
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

          {/* Desktop side panel (persistent detail sheet) */}
          <div className="hidden min-w-0 lg:block">
            {sheetOpen && selectedDetail && selected ? (
              <div className="h-full overflow-y-auto bg-kyar-surface">
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
                  inline
                />
              </div>
            ) : (
              <div className="flex min-h-[320px] items-center justify-center p-5 text-center text-sm text-kyar-textTertiary">
                Tap a node to view details
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile bottom sheet */}
      <div className="lg:hidden">
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
      </div>

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
            node={
              allNodes.find((n) => n._id === drag.draggingMeta!.nodeId) ?? linkedNodes[0]
            }
            label={
              drag.dragOverNodeId === "__root__"
                ? "Promote to root"
                : drag.dragOverZone === "before"
                  ? "Reorder before"
                  : drag.dragOverZone === "after"
                    ? "Reorder after"
                    : drag.dragOverZone === "into"
                      ? "Nest inside"
                      : "Move node"
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
