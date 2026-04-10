"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { BuildExplorerRow } from "./BuildExplorerRow";
import type {
  CosplayNodeId,
  DragState,
  DetailedLinkedNode,
  ExplorerLinkedNode,
  NodeSelectionMeta,
  PathSegment,
} from "./types";

type RootEntry = { node: ExplorerLinkedNode; rootIndex: number };

type BuildExplorerDrillDownProps = {
  buildId: Id<"builds">;
  userId: string | null;
  roots: RootEntry[];
  drillStack: PathSegment[];
  selectedNodeId: CosplayNodeId | null;
  drag: DragState;
  onDrillInto: (meta: NodeSelectionMeta, path: PathSegment[]) => void;
  onSelectLeaf: (meta: NodeSelectionMeta, path: PathSegment[]) => void;
  onDragStart: (meta: NodeSelectionMeta, x: number, y: number) => void;
  onOverflowMenu?: (meta: NodeSelectionMeta) => void;
};

export function BuildExplorerDrillDown({
  buildId,
  userId,
  roots,
  drillStack,
  selectedNodeId,
  drag,
  onDrillInto,
  onSelectLeaf,
  onDragStart,
  onOverflowMenu,
}: BuildExplorerDrillDownProps) {
  const currentLevel = drillStack.length > 0 ? drillStack[drillStack.length - 1] : null;

  if (!currentLevel) {
    return (
      <RootLevelList
        roots={roots}
        buildId={buildId}
        selectedNodeId={selectedNodeId}
        drag={drag}
        onDrillInto={onDrillInto}
        onSelectLeaf={onSelectLeaf}
        onDragStart={onDragStart}
        onOverflowMenu={onOverflowMenu}
        drillStack={drillStack}
      />
    );
  }

  return (
    <ChildLevelList
      buildId={buildId}
      parentId={currentLevel.meta.nodeId}
      parentMeta={currentLevel.meta}
      drillStack={drillStack}
      selectedNodeId={selectedNodeId}
      drag={drag}
      onDrillInto={onDrillInto}
      onSelectLeaf={onSelectLeaf}
      onDragStart={onDragStart}
      onOverflowMenu={onOverflowMenu}
    />
  );
}

function RootLevelList({
  roots,
  buildId,
  selectedNodeId,
  drag,
  onDrillInto,
  onSelectLeaf,
  onDragStart,
  onOverflowMenu,
  drillStack,
}: {
  roots: RootEntry[];
  buildId: Id<"builds">;
  selectedNodeId: CosplayNodeId | null;
  drag: DragState;
  onDrillInto: (meta: NodeSelectionMeta, path: PathSegment[]) => void;
  onSelectLeaf: (meta: NodeSelectionMeta, path: PathSegment[]) => void;
  onDragStart: (meta: NodeSelectionMeta, x: number, y: number) => void;
  onOverflowMenu?: (meta: NodeSelectionMeta) => void;
  drillStack: PathSegment[];
}) {
  return (
    <div className="space-y-0.5 px-1 py-2">
      {roots.map(({ node, rootIndex }) => {
        const meta: NodeSelectionMeta = { nodeId: node._id, isRoot: true, rootIndex };
        const path: PathSegment[] = [...drillStack, { meta, label: node.name }];
        const hasChildren = (node.childCount ?? 0) > 0;
        return (
          <BuildExplorerRow
            key={node._id}
            node={node}
            selectionMeta={meta}
            isSelected={selectedNodeId === node._id}
            isDragging={drag.draggingNodeId === node._id}
            activeDropZone={drag.dragOverNodeId === node._id ? drag.dragOverZone : null}
            hasChildren={hasChildren}
            showDrillChevron
            showDragHandle
            showExpandToggle={false}
            onTap={() => {
              if (hasChildren) {
                onDrillInto(meta, path);
              } else {
                onSelectLeaf(meta, path);
              }
            }}
            onDragStart={onDragStart}
            onOverflowMenu={onOverflowMenu}
          />
        );
      })}
    </div>
  );
}

function ChildLevelList({
  buildId,
  parentId,
  parentMeta,
  drillStack,
  selectedNodeId,
  drag,
  onDrillInto,
  onSelectLeaf,
  onDragStart,
  onOverflowMenu,
}: {
  buildId: Id<"builds">;
  parentId: CosplayNodeId;
  parentMeta: NodeSelectionMeta;
  drillStack: PathSegment[];
  selectedNodeId: CosplayNodeId | null;
  drag: DragState;
  onDrillInto: (meta: NodeSelectionMeta, path: PathSegment[]) => void;
  onSelectLeaf: (meta: NodeSelectionMeta, path: PathSegment[]) => void;
  onDragStart: (meta: NodeSelectionMeta, x: number, y: number) => void;
  onOverflowMenu?: (meta: NodeSelectionMeta) => void;
}) {
  const detail = useQuery(api.cosplayNodes.get, { id: parentId, buildId }) as
    | DetailedLinkedNode
    | null
    | undefined;

  const children = detail?.children ?? [];

  if (!detail) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-kyar-textTertiary">
        Loading…
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-kyar-textTertiary">
        No children yet
      </div>
    );
  }

  return (
    <div className="space-y-0.5 px-1 py-2">
      {children.map((child, index) => {
        const meta: NodeSelectionMeta = {
          nodeId: child._id,
          isRoot: false,
          parentNodeId: parentId,
          siblingLinkIds: children.map((c) => c.linkId),
          siblingIndex: index,
        };
        const path: PathSegment[] = [...drillStack, { meta, label: child.name }];
        const hasChildren = (child.childCount ?? 0) > 0;
        return (
          <BuildExplorerRow
            key={child._id}
            node={child}
            selectionMeta={meta}
            isSelected={selectedNodeId === child._id}
            isDragging={drag.draggingNodeId === child._id}
            activeDropZone={drag.dragOverNodeId === child._id ? drag.dragOverZone : null}
            hasChildren={hasChildren}
            showDrillChevron
            showDragHandle
            showExpandToggle={false}
            onTap={() => {
              if (hasChildren) {
                onDrillInto(meta, path);
              } else {
                onSelectLeaf(meta, path);
              }
            }}
            onDragStart={onDragStart}
            onOverflowMenu={onOverflowMenu}
          />
        );
      })}
    </div>
  );
}
