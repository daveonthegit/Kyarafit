import { useLayoutEffect, useMemo } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { CosplayNodeType } from "@kyarafit/design-system/types";
import { formatNodeTypeLabel } from "@kyarafit/design-system/domain";
import { DataBoundary } from "@/ui";
import { isAllowedCosplayLink } from "@/lib/canLinkCosplay";

type Ready = {
  userId: string;
  childNodeId: Id<"cosplayNodes">;
  candidates: {
    _id: Id<"cosplayNodes">;
    name: string;
    nodeType: CosplayNodeType;
  }[];
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
    const parentIds = new Set(child.parents.map((p) => p._id as string));
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
      }));
  }, [status, child, catalog, childNodeId]);

  const data: Ready | undefined =
    status === "ready" && childNodeId && userId ? { userId, childNodeId, candidates } : undefined;

  return (
    <DataBoundary<Ready> status={status} data={data} error={error}>
      {(loaded) => (
        <LinkParentBody loaded={loaded} onDone={() => router.back()} t={t} />
      )}
    </DataBoundary>
  );
}

function LinkParentBody({
  loaded,
  onDone,
  t,
}: {
  loaded: Ready;
  onDone: () => void;
  t: (key: string, opts?: Record<string, string>) => string;
}) {
  const addChildLink = useMutation(api.cosplayNodes.addChildLink);

  return (
    <View className="flex-1 bg-white px-4 pt-2">
      <Text className="text-sm text-neutral-500">{t("elements.linkParentSubtitle")}</Text>
      <FlatList
        className="mt-4"
        data={loaded.candidates}
        keyExtractor={(item) => item._id as string}
        ItemSeparatorComponent={() => <View className="h-px bg-neutral-100" />}
        renderItem={({ item }) => (
          <Pressable
            className="py-4"
            onPress={() => {
              void (async () => {
                try {
                  await addChildLink({
                    userId: loaded.userId,
                    parentNodeId: item._id,
                    childNodeId: loaded.childNodeId,
                  });
                  onDone();
                } catch (e) {
                  Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
                }
              })();
            }}
          >
            <Text className="text-base font-medium text-neutral-900">{item.name}</Text>
            <Text className="mt-0.5 text-sm text-neutral-500">
              {formatNodeTypeLabel(item.nodeType)}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="py-8 text-center text-neutral-500">{t("elements.linkPickerEmpty")}</Text>
        }
      />
    </View>
  );
}
