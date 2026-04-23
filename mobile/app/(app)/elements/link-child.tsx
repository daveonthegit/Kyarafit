import { useLayoutEffect, useMemo } from "react";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { CosplayNodeType } from "@kyarafit/design-system/types";
import { DataBoundary } from "@/ui";
import { isAllowedCosplayLink } from "@/lib/canLinkCosplay";
import { NodeLinkPicker, type NodeLinkCandidate } from "@/screens/elements/NodeLinkPicker";

type Ready = {
  userId: string;
  parentNodeId: Id<"cosplayNodes">;
  candidates: NodeLinkCandidate[];
};

export default function ElementLinkChildScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("elements.linkChildTitle") });
  }, [navigation, t]);

  const raw = useLocalSearchParams<{ parentNodeId: string | string[] }>().parentNodeId;
  const param = Array.isArray(raw) ? raw[0] : raw;
  const parentNodeId = param ? (param as Id<"cosplayNodes">) : undefined;

  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const parent = useQuery(api.cosplayNodes.get, parentNodeId ? { id: parentNodeId } : "skip");
  const catalog = useQuery(
    api.cosplayNodes.list,
    userId ? { userId, sortBy: "name", order: "asc" } : "skip"
  );

  const loading =
    identity === undefined ||
    (userId != null && parentNodeId != null && (parent === undefined || catalog === undefined));
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!parentNodeId || !userId || parent === undefined || parent === null) status = "empty";
  else status = "ready";

  const candidates = useMemo(() => {
    if (status !== "ready" || !parent || !catalog) return [];
    const parentType = parent.nodeType as CosplayNodeType;
    const childIds = new Set(parent.children.map((child) => child._id as string));
    return catalog
      .filter((node) => {
        if ((node._id as string) === (parentNodeId as string)) return false;
        if (childIds.has(node._id as string)) return false;
        return isAllowedCosplayLink(parentType, node.nodeType as CosplayNodeType);
      })
      .map((node) => ({
        _id: node._id,
        name: node.name,
        nodeType: node.nodeType as CosplayNodeType,
        category: node.category,
        imageStorageId: node.imageStorageId,
        imageUrl: node.imageUrl,
        overallBucket: node.overallBucket,
        progressPercent: node.progressPercent,
        childCount: node.childCount,
      }));
  }, [catalog, parent, parentNodeId, status]);

  const data: Ready | undefined =
    status === "ready" && parentNodeId && userId ? { userId, parentNodeId, candidates } : undefined;

  return (
    <DataBoundary<Ready> status={status} data={data} error={error}>
      {(loaded) => <LinkChildBody loaded={loaded} onDone={() => router.back()} />}
    </DataBoundary>
  );
}

function LinkChildBody({ loaded, onDone }: { loaded: Ready; onDone: () => void }) {
  const { t } = useTranslation();
  const addChildLink = useMutation(api.cosplayNodes.addChildLink);

  return (
    <NodeLinkPicker
      title={t("elements.linkChildTitle")}
      subtitle={t("elements.linkChildSubtitle")}
      candidates={loaded.candidates}
      emptyLabel={t("elements.linkPickerEmpty")}
      searchPlaceholder={t("elements.linkNodeSearchPlaceholder")}
      addLabel={t("elements.linkAddAction")}
      onPick={async (childNodeId) => {
        await addChildLink({
          userId: loaded.userId,
          parentNodeId: loaded.parentNodeId,
          childNodeId,
        });
        onDone();
      }}
    />
  );
}
