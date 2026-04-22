import { useCallback, useLayoutEffect, useMemo } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import type { CosplayNodeType } from "@kyarafit/design-system/types";
import {
  ELEMENT_BUILD_STATUSES,
  ELEMENT_PURCHASE_STATUSES,
  MATERIAL_STATUSES,
} from "@kyarafit/design-system/types";
import {
  formatCostSummary,
  formatNodeStatus,
  formatNodeTypeLabel,
  formatOverallBucket,
} from "@kyarafit/design-system/domain";
import { DataBoundary } from "@/ui";
import { APP_HREF } from "@/lib/appRoutes";

type ParentRef = {
  _id: Id<"cosplayNodes">;
  name: string;
  nodeType: string;
  linkId: Id<"cosplayNodeLinks">;
};

type ChildRow = Doc<"cosplayNodes"> & {
  linkId: Id<"cosplayNodeLinks">;
  linkMode: string;
  sortOrder: number;
  overallBucket: string;
  progressPercent: number;
  directCostCents: number;
  totalCostCents: number;
  childCount: number;
  hasIncompleteDescendants: boolean;
};

export type ElementDetailLoaded = {
  id: Id<"cosplayNodes">;
  userId: string;
  node: Doc<"cosplayNodes"> & {
    overallBucket: string;
    progressPercent: number;
    directCostCents: number;
    totalCostCents: number;
    childCount: number;
    hasIncompleteDescendants: boolean;
    children: ChildRow[];
    parents: ParentRef[];
  };
};

export default function ElementDetailScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();
  const raw = useLocalSearchParams<{ id: string | string[] }>().id;
  const param = Array.isArray(raw) ? raw[0] : raw;
  const id = param ? (param as Id<"cosplayNodes">) : undefined;

  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const node = useQuery(api.cosplayNodes.get, id ? { id } : "skip");
  const imageUrl = useQuery(
    api.files.getUrl,
    node?.imageStorageId ? { storageId: node.imageStorageId } : "skip"
  );

  const loading =
    identity === undefined || (id != null && node === undefined);
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!id || !userId || node === null) status = "empty";
  else status = "ready";

  const data: ElementDetailLoaded | undefined =
    status === "ready" && node && userId && id
      ? { id, userId, node: node as ElementDetailLoaded["node"] }
      : undefined;

  useLayoutEffect(() => {
    navigation.setOptions({
      title: node?.name ?? "",
      headerRight: () =>
        id ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(APP_HREF.elementEdit(id as string))}
            className="mr-3"
          >
            <Text className="text-base font-semibold text-neutral-900">{t("elements.editShort")}</Text>
          </Pressable>
        ) : null,
    });
  }, [navigation, node?.name, id, router, t]);

  return (
    <DataBoundary<ElementDetailLoaded> status={status} data={data} error={error}>
      {(loaded) => (
        <ElementDetailBody
          loaded={loaded}
          heroUri={imageUrl ?? null}
          onLinkBuild={() =>
            router.push(APP_HREF.elementLinkBuild(loaded.id as string))
          }
          t={t}
        />
      )}
    </DataBoundary>
  );
}

function ElementDetailBody({
  loaded,
  heroUri,
  onLinkBuild,
  t,
}: {
  loaded: ElementDetailLoaded;
  heroUri: string | null;
  onLinkBuild: () => void;
  t: TFunction;
}) {
  const update = useMutation(api.cosplayNodes.update);
  const removeChildLink = useMutation(api.cosplayNodes.removeChildLink);
  const reorderChildren = useMutation(api.cosplayNodes.reorderChildren);
  const router = useRouter();
  const { node, userId, id } = loaded;

  const statusLabel = useMemo(() => formatNodeStatus(node), [node]);
  const costLabel = useMemo(() => formatCostSummary(node), [node]);

  const applyUpdate = (patch: Parameters<typeof update>[0]) => {
    void update({ ...patch, id, userId });
  };

  const openPurchaseSheet = () => {
    const buttons = ELEMENT_PURCHASE_STATUSES.map((s) => ({
      text: s.replace("_", " "),
      onPress: () =>
        applyUpdate({
          id,
          userId,
          purchaseStatus: s,
        }),
    }));
    Alert.alert(t("elements.sheetPurchase"), undefined, [
      ...buttons,
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const openBuildSheet = () => {
    const buttons = ELEMENT_BUILD_STATUSES.map((s) => ({
      text: s.replace("_", " "),
      onPress: () =>
        applyUpdate({
          id,
          userId,
          buildStatus: s,
        }),
    }));
    Alert.alert(t("elements.sheetBuild"), undefined, [
      ...buttons,
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const confirmRemoveLink = useCallback(
    (linkId: Id<"cosplayNodeLinks">, label: string) => {
      Alert.alert(t("elements.unlinkConfirmTitle"), label, [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("elements.unlinkConfirmAction"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await removeChildLink({ id: linkId, userId });
              } catch (e) {
                Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
              }
            })();
          },
        },
      ]);
    },
    [removeChildLink, t, userId]
  );

  const onDragEnd = useCallback(
    async ({ data }: { data: ChildRow[] }) => {
      try {
        await reorderChildren({
          parentNodeId: id,
          userId,
          orderedLinkIds: data.map((c) => c.linkId),
        });
      } catch (e) {
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      }
    },
    [id, reorderChildren, userId, t]
  );

  const renderChild = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ChildRow>) => (
      <ScaleDecorator>
        <View
          className={`flex-row items-stretch border-b border-neutral-100 ${isActive ? "opacity-80" : ""}`}
        >
          <Pressable
            className="flex-1 py-4 pr-2"
            onPress={() => router.push(APP_HREF.element(item._id as string))}
          >
            <Text className="text-base font-medium text-neutral-900">{item.name}</Text>
            <Text className="mt-0.5 text-sm text-neutral-500">
              {formatNodeTypeLabel(item.nodeType as CosplayNodeType)} · {formatNodeStatus(item)}
            </Text>
          </Pressable>
          <Pressable
            onLongPress={drag}
            delayLongPress={120}
            className="justify-center px-2"
            accessibilityLabel={t("elements.dragToReorder")}
          >
            <Text className="text-lg text-neutral-400">☰</Text>
          </Pressable>
          <Pressable
            className="justify-center px-2"
            onPress={() => confirmRemoveLink(item.linkId, item.name)}
            accessibilityLabel={t("elements.unlinkChild")}
          >
            <Text className="text-base font-semibold text-red-600">×</Text>
          </Pressable>
        </View>
      </ScaleDecorator>
    ),
    [confirmRemoveLink, router, t]
  );

  const uri = heroUri ?? node.imageUrl ?? null;

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="aspect-[4/5] w-full bg-neutral-100">
        {uri ? (
          <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
        ) : (
          <View className="flex-1 items-center justify-center">
            <Text className="text-5xl text-neutral-300">
              {node.nodeType === "material" ? "◇" : "◆"}
            </Text>
          </View>
        )}
      </View>

      <View className="px-4 pb-10 pt-4">
        <Text className="text-xs uppercase tracking-wide text-neutral-500">
          {formatNodeTypeLabel(node.nodeType as CosplayNodeType)}
          {node.category ? ` · ${node.category}` : ""}
        </Text>
        <Text className="mt-1 text-2xl font-semibold text-neutral-900">{node.name}</Text>

        <View className="mt-4 flex-row flex-wrap gap-2">
          <MetaChip label={t("elements.progressPercent", { pct: node.progressPercent ?? 0 })} />
          <MetaChip label={formatOverallBucket(node.overallBucket)} />
          <MetaChip label={statusLabel} />
        </View>

        <Text className="mt-3 text-sm text-neutral-600">{costLabel}</Text>

        <Text className="mt-6 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {t("elements.adjustStatus")}
        </Text>
        {node.nodeType === "element" ? (
          <View className="mt-2 flex-row flex-wrap gap-2">
            <Pressable
              onPress={openPurchaseSheet}
              className="rounded-full border border-neutral-200 px-4 py-2"
            >
              <Text className="text-sm text-neutral-800">{t("elements.statusPurchase")}</Text>
            </Pressable>
            <Pressable
              onPress={openBuildSheet}
              className="rounded-full border border-neutral-200 px-4 py-2"
            >
              <Text className="text-sm text-neutral-800">{t("elements.statusBuild")}</Text>
            </Pressable>
          </View>
        ) : (
          <View className="mt-2 flex-row flex-wrap gap-2">
            {MATERIAL_STATUSES.map((s) => (
              <Pressable
                key={s}
                onPress={() =>
                  applyUpdate({
                    id,
                    userId,
                    materialStatus: s,
                  })
                }
                className={`rounded-full border px-3 py-1.5 ${
                  node.materialStatus === s ? "border-neutral-900 bg-neutral-900" : "border-neutral-200"
                }`}
              >
                <Text
                  className={`text-xs font-medium ${
                    node.materialStatus === s ? "text-white" : "text-neutral-800"
                  }`}
                >
                  {s.replace("_", " ")}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          onPress={onLinkBuild}
          className="mt-8 rounded-xl bg-neutral-900 py-4 active:opacity-90"
        >
          <Text className="text-center text-base font-semibold text-white">
            {t("elements.linkToOutfit")}
          </Text>
        </Pressable>

        <Text className="mt-10 text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {t("elements.graphLinks")}
        </Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          <Pressable
            onPress={() =>
              router.push(APP_HREF.elementLinkChild(id as string))
            }
            className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2"
          >
            <Text className="text-sm font-medium text-neutral-900">{t("elements.addChild")}</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              router.push(APP_HREF.elementLinkParent(id as string))
            }
            className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2"
          >
            <Text className="text-sm font-medium text-neutral-900">{t("elements.attachParent")}</Text>
          </Pressable>
        </View>

        {node.parents.length > 0 ? (
          <View className="mt-10">
            <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {t("elements.parents")}
            </Text>
            {node.parents.map((p: ParentRef) => (
              <View
                key={p._id}
                className="mt-2 flex-row items-center border-b border-neutral-100 py-3"
              >
                <Pressable
                  className="min-w-0 flex-1"
                  onPress={() => router.push(APP_HREF.element(p._id as string))}
                >
                  <Text className="text-base font-medium text-neutral-900">{p.name}</Text>
                  <Text className="mt-0.5 text-xs text-neutral-500">
                    {formatNodeTypeLabel(p.nodeType as CosplayNodeType)}
                  </Text>
                </Pressable>
                <Pressable
                  className="px-2 py-1"
                  onPress={() => confirmRemoveLink(p.linkId, p.name)}
                  accessibilityLabel={t("elements.unlinkParent")}
                >
                  <Text className="text-base font-semibold text-red-600">×</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {node.children.length > 0 ? (
          <View className="mt-8">
            <Text className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {t("elements.children")}
            </Text>
            <Text className="mt-1 text-xs text-neutral-500">{t("elements.childrenDragHint")}</Text>
            <DraggableFlatList
              className="mt-2"
              data={node.children}
              keyExtractor={(item) => item.linkId as string}
              onDragEnd={onDragEnd}
              renderItem={renderChild}
              scrollEnabled={false}
              style={{ flexGrow: 0 }}
            />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <View className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5">
      <Text className="text-xs font-medium text-neutral-800">{label}</Text>
    </View>
  );
}
