import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { formatNodeTypeLabel } from "@kyarafit/design-system/domain";
import { borderWidth, glass } from "@kyarafit/design-system/rn";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { GlassStatusChip, type GlassStatusTone } from "@/ui/glass";
import { useOfflineQuery } from "@/offline";
import { GlassMeta } from "./glassAtoms";
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
  siblingLinkIds?: Id<"cosplayNodes">[];
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

function progressTone(percent: number): GlassStatusTone {
  if (percent >= 100) return "success";
  if (percent > 0) return "active";
  return "neutral";
}

/** 2.5px drop line + 8px dot at the drag insertion edge (glass.drop.line). */
function DropLine({ edge }: { edge: "top" | "bottom" }) {
  return (
    <View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 8,
          right: 8,
          height: 2.5,
          borderRadius: 1.25,
          backgroundColor: glass.drop.line,
        },
        edge === "top" ? { top: -1.5 } : { bottom: -1.5 },
      ]}
    >
      <View
        style={{
          position: "absolute",
          left: -4,
          top: -2.75,
          height: 8,
          width: 8,
          borderRadius: 4,
          backgroundColor: glass.drop.line,
        }}
      />
    </View>
  );
}

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

  const pct = Math.round(node.progressPercent);

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
        style={{
          minHeight: 44,
          marginBottom: 6,
          borderRadius: 10,
          paddingHorizontal: 10,
          paddingVertical: 7,
          backgroundColor: dropInto
            ? glass.surface.active
            : selected
              ? glass.surface.field
              : "transparent",
          borderWidth: dropInto ? 1.5 : borderWidth.hairline,
          borderColor: dropInto
            ? glass.drop.intoRing
            : selected
              ? glass.border.dividerStrong
              : glass.border.divider,
          opacity: dragging ? 0.35 : 1,
        }}
      >
        {dropBefore ? <DropLine edge="top" /> : null}
        {dropAfter ? <DropLine edge="bottom" /> : null}

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          {hasChildren ? (
            <Pressable
              onPress={(e) => {
                e.stopPropagation?.();
                setExpanded((value) => !value);
              }}
              hitSlop={10}
              style={{ height: 28, width: 22, alignItems: "center", justifyContent: "center" }}
              accessibilityRole="button"
              accessibilityLabel={
                expanded
                  ? t("common.collapse", { defaultValue: "Collapse" })
                  : t("common.expand", { defaultValue: "Expand" })
              }
            >
              <Text style={{ fontSize: 13, color: glass.text.fg55 }}>{expanded ? "▾" : "▸"}</Text>
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}

          <View
            style={{
              height: 40,
              width: 40,
              borderRadius: 8,
              overflow: "hidden",
              borderWidth: borderWidth.hairline,
              borderColor: glass.border.default,
              backgroundColor: glass.surface.field,
            }}
          >
            {node.imageStorageId || node.imageUrl ? (
              <ConvexStorageImage
                storageId={node.imageStorageId}
                imageUrl={node.imageUrl}
                className="h-full w-full"
              />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Ionicons
                  name={node.nodeType === "material" ? "cube-outline" : "diamond-outline"}
                  size={16}
                  color={glass.text.fg55}
                />
              </View>
            )}
          </View>

          <View style={{ minWidth: 0, flex: 1 }}>
            <Text
              style={
                isRoot
                  ? {
                      fontFamily: APP_FONT_FAMILIES.displayItalic,
                      fontStyle: "italic",
                      fontSize: 17,
                      lineHeight: 20,
                      color: glass.text.fg,
                    }
                  : {
                      fontFamily: APP_FONT_FAMILIES.sansMedium,
                      fontSize: 13,
                      lineHeight: 17,
                      color: glass.text.fg,
                    }
              }
              numberOfLines={2}
            >
              {displayName}
            </Text>
            {dropInto ? (
              <GlassMeta size={9} tone="fg70" style={{ marginTop: 3 }}>
                {t("buildDetail.dropIntoLabel", { defaultValue: "Drop to nest inside" })}
              </GlassMeta>
            ) : (
              <GlassMeta size={9} tone="fg55" style={{ marginTop: 3 }}>
                {formatNodeTypeLabel(
                  node.nodeType === "element" || node.nodeType === "material"
                    ? node.nodeType
                    : undefined
                )}
              </GlassMeta>
            )}
          </View>

          <GlassStatusChip tone={progressTone(pct)} label={`${pct}%`} />
        </View>
      </Pressable>

      {expanded && detail?.children ? (
        <View
          style={{
            marginLeft: 14,
            paddingLeft: 8,
            borderLeftWidth: 2,
            borderLeftColor: glass.border.divider,
          }}
        >
          {detail.children.map((child, idx) => (
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
          ))}
        </View>
      ) : null}
    </View>
  );
}

export const ExplorerBranch = memo(ExplorerBranchImpl);
