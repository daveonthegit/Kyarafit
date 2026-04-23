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
  childNodeId: Id<"cosplayNodes">;
  candidates: NodeLinkCandidate[];
};

export default function ElementLinkParentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("elements.linkParentTitle") });
  }, [navigation, t]);

  const raw = useLocalSearchParams<{ childNodeId: string | string[] }>().childNodeId;
  const param = Array.isArray(raw) ? raw[0] : raw;
  const childNodeId = param ? (param as Id<"cosplayNodes">) : undefined;

  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const child = useQuery(api.cosplayNodes.get, childNodeId ? { id: childNodeId } : "skip");
  const catalog = useQuery(
    api.cosplayNodes.list,
    userId ? { userId, sortBy: "name", order: "asc" } : "skip"
  );

  const loading =
    identity === undefined ||
    (userId != null && childNodeId != null && (child === undefined || catalog === undefined));
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!childNodeId || !userId || child === undefined || child === null) status = "empty";
  else status = "ready";

  const candidates = useMemo(() => {
    if (status !== "ready" || !child || !catalog) return [];
    const childType = child.nodeType as CosplayNodeType;
    const parentIds = new Set(child.parents.map((parent) => parent._id as string));
    return catalog
      .filter((node) => {
        if ((node._id as string) === (childNodeId as string)) return false;
        if (parentIds.has(node._id as string)) return false;
        return isAllowedCosplayLink(node.nodeType as CosplayNodeType, childType);
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
  }, [catalog, child, childNodeId, status]);

  const data: Ready | undefined =
    status === "ready" && childNodeId && userId ? { userId, childNodeId, candidates } : undefined;

  return (
    <DataBoundary<Ready> status={status} data={data} error={error}>
      {(loaded) => <LinkParentBody loaded={loaded} onDone={() => router.back()} />}
    </DataBoundary>
  );
}

function LinkParentBody({ loaded, onDone }: { loaded: Ready; onDone: () => void }) {
  const { t } = useTranslation();
  const addChildLink = useMutation(api.cosplayNodes.addChildLink);

  return (
    <NodeLinkPicker
      title={t("elements.linkParentTitle")}
      subtitle={t("elements.linkParentSubtitle")}
      candidates={loaded.candidates}
      emptyLabel={t("elements.linkPickerEmpty")}
      searchPlaceholder={t("elements.linkNodeSearchPlaceholder")}
      addLabel={t("elements.linkAddAction")}
      onPick={async (parentNodeId) => {
        await addChildLink({
          userId: loaded.userId,
          parentNodeId,
          childNodeId: loaded.childNodeId,
        });
        onDone();
      }}
    />
  );
}
