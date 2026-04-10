"use client";

import { useState } from "react";
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

type BuildExplorerTreeProps = {
  buildId: Id<"builds">;
  userId: string | null;
  roots: RootEntry[];
  selectedNodeId: CosplayNodeId | null;
  drag: DragState;
  onSelect: (meta: NodeSelectionMeta, path: PathSegment[]) => void;
  onDragStart: (meta: NodeSelectionMeta, x: number, y: number) => void;
  onOverflowMenu?: (meta: NodeSelectionMeta) => void;
};

export function BuildExplorerTree({
  buildId,
  userId,
  roots,
  selectedNodeId,
  drag,
  onSelect,
  onDragStart,
  onOverflowMenu,
}: BuildExplorerTreeProps) {
  return (
    <div className="space-y-0.5 px-1 py-2">
      {roots.map(({ node, rootIndex }) => {
        const meta: NodeSelectionMeta = { nodeId: node._id, isRoot: true, rootIndex };
        return (
          <TreeNode
            key={node._id}
            buildId={buildId}
            node={node}
            selectionMeta={meta}
            pathPrefix={[]}
            selectedNodeId={selectedNodeId}
            drag={drag}
            onSelect={onSelect}
            onDragStart={onDragStart}
            onOverflowMenu={onOverflowMenu}
            defaultExpanded
          />
        );
      })}
    </div>
  );
}

function TreeNode({
  buildId,
  node,
  selectionMeta,
  pathPrefix,
  selectedNodeId,
  drag,
  onSelect,
  onDragStart,
  onOverflowMenu,
  defaultExpanded = false,
}: {
  buildId: Id<"builds">;
  node: ExplorerLinkedNode;
  selectionMeta: NodeSelectionMeta;
  pathPrefix: PathSegment[];
  selectedNodeId: CosplayNodeId | null;
  drag: DragState;
  onSelect: (meta: NodeSelectionMeta, path: PathSegment[]) => void;
  onDragStart: (meta: NodeSelectionMeta, x: number, y: number) => void;
  onOverflowMenu?: (meta: NodeSelectionMeta) => void;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const detail = useQuery(api.cosplayNodes.get, { id: node._id, buildId }) as
    | DetailedLinkedNode
    | null
    | undefined;

  const children = detail?.children ?? [];
  const displayName = detail?.name ?? node.name;
  const nodePath: PathSegment[] = [
    ...pathPrefix,
    { meta: selectionMeta, label: displayName },
  ];
  const hasChildren = children.length > 0;

  return (
    <div>
      <BuildExplorerRow
        node={{ ...node, name: displayName }}
        selectionMeta={selectionMeta}
        isSelected={selectedNodeId === node._id}
        isDragging={drag.draggingNodeId === node._id}
        activeDropZone={drag.dragOverNodeId === node._id ? drag.dragOverZone : null}
        hasChildren={hasChildren}
        expanded={expanded}
        showExpandToggle
        showDragHandle
        showDrillChevron={false}
        onTap={() => onSelect(selectionMeta, nodePath)}
        onToggleExpand={() => setExpanded((v) => !v)}
        onDragStart={onDragStart}
        onOverflowMenu={onOverflowMenu}
      />
      {expanded && hasChildren ? (
        <div className="ml-5 border-l border-kyar-borderSubtle pl-1">
          {children.map((child, index) => {
            const childMeta: NodeSelectionMeta = {
              nodeId: child._id,
              isRoot: false,
              parentNodeId: node._id,
              siblingLinkIds: children.map((c) => c.linkId),
              siblingIndex: index,
            };
            return (
              <TreeNode
                key={child._id}
                buildId={buildId}
                node={child}
                selectionMeta={childMeta}
                pathPrefix={nodePath}
                selectedNodeId={selectedNodeId}
                drag={drag}
                onSelect={onSelect}
                onDragStart={onDragStart}
                onOverflowMenu={onOverflowMenu}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
