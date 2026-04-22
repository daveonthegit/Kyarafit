import { memo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import type { NodeSelectionMeta } from "./useNodeInspector";

type BranchNode = {
  _id: Id<"cosplayNodes">;
  name: string;
  nodeType: "element" | "material" | string;
  progressPercent: number;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  childCount?: number;
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
  onSelect: (meta: NodeSelectionMeta) => void;
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
  onSelect,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasChildren = (node.childCount ?? 0) > 0;

  const detail = useQuery(
    api.cosplayNodes.get,
    expanded && hasChildren ? { id: node._id, buildId } : "skip"
  );

  const childLinkIds = detail?.children?.map((c) => c.linkId) ?? [];

  const rowContent = (
    <View className="flex-row items-center gap-2">
      {hasChildren ? (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            setExpanded((v) => !v);
          }}
          hitSlop={8}
          className="h-7 w-7 items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel={expanded ? t("common.collapse", { defaultValue: "Collapse" }) : t("common.expand", { defaultValue: "Expand" })}
        >
          <Text className="text-base text-neutral-500">{expanded ? "▾" : "▸"}</Text>
        </Pressable>
      ) : (
        <View className="w-7" />
      )}
      <View className="h-10 w-10 overflow-hidden rounded-lg bg-neutral-100">
        {node.imageStorageId || node.imageUrl ? (
          <ConvexStorageImage
            storageId={node.imageStorageId}
            imageUrl={node.imageUrl}
            className="h-full w-full"
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Text className="text-base text-neutral-300">
              {node.nodeType === "material" ? "◧" : "◇"}
            </Text>
          </View>
        )}
      </View>
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-medium text-neutral-900" numberOfLines={2}>
          {node.name}
        </Text>
        <Text className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
          {Math.round(node.progressPercent)}%
        </Text>
      </View>
    </View>
  );

  return (
    <View>
      <Pressable
        onPress={() =>
          onSelect({
            nodeId: node._id,
            isRoot,
            rootIndex,
            parentNodeId,
            siblingLinkIds,
            siblingIndex,
          })
        }
        style={{ marginLeft: depth * 14 }}
        className="mb-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-2"
      >
        {rowContent}
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
              onSelect={onSelect}
            />
          ))
        : null}
    </View>
  );
}

export const ExplorerBranch = memo(ExplorerBranchImpl);
