import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { formatNodeTypeLabel } from "@kyarafit/design-system/domain";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { useOfflineQuery } from "@/offline";
import type { NodeSelectionMeta } from "./useNodeInspector";

type BranchNode = {
  _id: Id<"cosplayNodes">;
  name: string;
  nodeType?: "element" | "material" | string;
  progressPercent: number;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  childCount?: number;
};

export type ExplorerPathSegment = {
  label: string;
  meta: NodeSelectionMeta;
};

type Props = {
  node: BranchNode;
  buildId: Id<"builds">;
  depth: number;
  isRoot?: boolean;
  rootIndex?: number;
  parentNodeId?: Id<"cosplayNodes">;
  siblingLinkIds?: Id<"cosplayNodeLinks">[];
  siblingIndex?: number;
  selectedNodeId?: Id<"cosplayNodes"> | null;
  pathPrefix?: ExplorerPathSegment[];
  onSelect: (meta: NodeSelectionMeta, path: ExplorerPathSegment[]) => void;
  onStartMove: (
    meta: NodeSelectionMeta & { name: string; nodeType: "element" | "material" },
    point: { x: number; y: number }
  ) => void;
  onMovePointer: (point: { x: number; y: number }) => void;
  onEndMove: (point?: { x: number; y: number }) => void;
  registerRow: (
    nodeId: Id<"cosplayNodes">,
    ref: View | null,
    meta: NodeSelectionMeta & { name: string; nodeType: "element" | "material" }
  ) => void;
  unregisterRow: (nodeId: Id<"cosplayNodes">) => void;
  draggingNodeId?: Id<"cosplayNodes"> | null;
  dragOverNodeId?: Id<"cosplayNodes"> | "__root__" | null;
  dragOverZone?: "before" | "into" | "after" | null;
};

function ExplorerBranchImpl({
  node,
  buildId,
  depth,
  isRoot = false,
  rootIndex,
  parentNodeId,
  siblingLinkIds,
  siblingIndex,
  selectedNodeId,
  pathPrefix = [],
  onSelect,
  onStartMove,
  onMovePointer,
  onEndMove,
  registerRow,
  unregisterRow,
  draggingNodeId,
  dragOverNodeId,
  dragOverZone,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasChildren = (node.childCount ?? 0) > 0;
  const rowRef = useRef<View>(null);

  const detail = useOfflineQuery(
    api.cosplayNodes.get,
    expanded || selectedNodeId === node._id ? { id: node._id, buildId } : "skip"
  );

  const displayName = detail?.name ?? node.name;
  const childLinkIds = detail?.children?.map((c) => c.linkId) ?? [];
  const selectionMeta = useMemo<NodeSelectionMeta>(
    () => ({
      nodeId: node._id,
      isRoot,
      rootIndex,
      parentNodeId,
      siblingLinkIds,
      siblingIndex,
    }),
    [isRoot, node._id, parentNodeId, rootIndex, siblingIndex, siblingLinkIds]
  );
  const path = [...pathPrefix, { label: displayName, meta: selectionMeta }];
  const selected = selectedNodeId === node._id;
  const dragging = draggingNodeId === node._id;
  const dropInto = dragOverNodeId === node._id && dragOverZone === "into";
  const dropBefore = dragOverNodeId === node._id && dragOverZone === "before";
  const dropAfter = dragOverNodeId === node._id && dragOverZone === "after";

  useEffect(() => {
    registerRow(node._id, rowRef.current, {
      ...selectionMeta,
      name: displayName,
      nodeType: node.nodeType === "material" ? "material" : "element",
    });
    return () => unregisterRow(node._id);
  }, [displayName, node._id, node.nodeType, registerRow, selectionMeta, unregisterRow]);

  return (
    <View>
      <Pressable
        ref={rowRef}
        onPress={() => {
          if (hasChildren) {
            setExpanded(true);
          }
          onSelect(selectionMeta, path);
        }}
        onLongPress={(event) =>
          onStartMove(
            {
              ...selectionMeta,
              name: displayName,
              nodeType: node.nodeType === "material" ? "material" : "element",
            },
            {
              x: event.nativeEvent.pageX,
              y: event.nativeEvent.pageY,
            }
          )
        }
        onTouchMove={(event) => {
          if (!dragging) return;
          onMovePointer({
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          });
        }}
        onTouchEnd={(event) => {
          if (!dragging) return;
          onEndMove({
            x: event.nativeEvent.pageX,
            y: event.nativeEvent.pageY,
          });
        }}
        onTouchCancel={() => {
          if (!dragging) return;
          onEndMove();
        }}
        delayLongPress={220}
        style={{ marginLeft: depth * 14 }}
        className={`mb-2 rounded-2xl border px-3 py-3 ${
          dropInto
            ? "border-kyar-text bg-kyar-panelRaised dark:border-kyar-dark-text dark:bg-kyar-dark-panelRaised"
            : selected
              ? "border-kyar-border bg-kyar-panel dark:border-kyar-dark-border dark:bg-kyar-dark-panel"
              : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
        } ${dragging ? "opacity-55" : ""}`}
      >
        {dropBefore ? (
          <View className="absolute inset-x-4 top-0 h-1 rounded-full bg-kyar-text dark:bg-kyar-dark-text" />
        ) : null}
        {dropAfter ? (
          <View className="absolute inset-x-4 bottom-0 h-1 rounded-full bg-kyar-text dark:bg-kyar-dark-text" />
        ) : null}

        <View className="flex-row items-center gap-2.5">
          {hasChildren ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                setExpanded((value) => !value);
              }}
              hitSlop={8}
              className="h-8 w-8 items-center justify-center rounded-full"
              accessibilityRole="button"
              accessibilityLabel={
                expanded
                  ? t("common.collapse", { defaultValue: "Collapse" })
                  : t("common.expand", { defaultValue: "Expand" })
              }
            >
              <Text className="text-base text-kyar-meta dark:text-kyar-dark-meta">
                {expanded ? "▾" : "▸"}
              </Text>
            </Pressable>
          ) : (
            <View className="w-8" />
          )}

          <View className="h-11 w-11 overflow-hidden rounded-2xl bg-kyar-panel dark:bg-kyar-dark-panel">
            {node.imageStorageId || node.imageUrl ? (
              <ConvexStorageImage
                storageId={node.imageStorageId}
                imageUrl={node.imageUrl}
                className="h-full w-full"
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="text-base text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {node.nodeType === "material" ? "◧" : "◇"}
                </Text>
              </View>
            )}
          </View>

          <View className="min-w-0 flex-1">
            <Text
              style={{
                fontFamily: isRoot
                  ? APP_FONT_FAMILIES.displayItalic
                  : APP_FONT_FAMILIES.sansSemiBold,
              }}
              className={`${isRoot ? "text-[22px] italic leading-[26px]" : "text-sm"} text-kyar-text dark:text-kyar-dark-text`}
              numberOfLines={2}
            >
              {displayName}
            </Text>
            {dropInto ? (
              <Text className="mt-2 text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                {t("buildDetail.dropIntoLabel", { defaultValue: "Drop to nest inside" })}
              </Text>
            ) : null}
            <View className="mt-1 flex-row flex-wrap items-center gap-2">
              <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                {formatNodeTypeLabel(
                  node.nodeType === "element" || node.nodeType === "material"
                    ? node.nodeType
                    : undefined
                )}
              </Text>
              <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                {Math.round(node.progressPercent)}%
              </Text>
            </View>
          </View>
        </View>
      </Pressable>

      {expanded && detail?.children
        ? detail.children.map((child, idx) => (
            <ExplorerBranch
              key={child._id as string}
              node={{
                _id: child._id,
                name: child.name,
                nodeType: child.nodeType,
                progressPercent: child.progressPercent,
                imageUrl: child.imageUrl,
                imageStorageId: child.imageStorageId,
                childCount: child.childCount,
              }}
              buildId={buildId}
              depth={depth + 1}
              parentNodeId={node._id}
              siblingLinkIds={childLinkIds}
              siblingIndex={idx}
              selectedNodeId={selectedNodeId}
              pathPrefix={path}
              onSelect={onSelect}
              onStartMove={onStartMove}
              onMovePointer={onMovePointer}
              onEndMove={onEndMove}
              registerRow={registerRow}
              unregisterRow={unregisterRow}
              draggingNodeId={draggingNodeId}
              dragOverNodeId={dragOverNodeId}
              dragOverZone={dragOverZone}
            />
          ))
        : null}
    </View>
  );
}

export const ExplorerBranch = memo(ExplorerBranchImpl);
