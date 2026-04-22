import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation } from "convex/react";
import DraggableFlatList, { RenderItemParams, ScaleDecorator } from "react-native-draggable-flatlist";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { FocalCoverImage } from "@/components/FocalCoverImage";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";
import { APP_HREF } from "@/lib/appRoutes";
import { HeroFocalModal } from "./HeroFocalModal";
import { BuildWorkflowTasks } from "./BuildWorkflowTasks";
import { NodeDetailSheet, type NodeDetailSheetRef } from "./NodeDetailSheet";
import { useNodeInspector, type NodeSelectionMeta } from "./useNodeInspector";

type BuildRow = Doc<"builds"> & {
  tasksTotal: number;
  tasksChecked: number;
  progress: number;
  workflowProgressPercent: number;
};

type OutlineNode = {
  _id: Id<"cosplayNodes">;
  name: string;
  depth: number;
  isRoot: boolean;
  progressPercent: number;
  nodeType?: string;
  imageUrl?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  childCount?: number;
};

type CollaboratorRow = {
  userId: string;
  role: string;
  email: string | null;
  name: string | null;
  username: string | null;
};

type TabId = "explorer" | "tasks" | "board" | "summary";

type Props = {
  buildId: Id<"builds">;
  userId: string;
  build: BuildRow;
  heroUri: string | null;
  summary:
    | {
        progressPercent: number;
        tasksChecked: number;
        tasksTotal: number;
        linkedItemCount: number;
        linkedItemsCompleteCount: number;
        remainingDays: number | null;
        budgetDifferenceCents: number | null;
      }
    | null
    | undefined;
  outlineNodes: OutlineNode[] | undefined;
  refImages: Doc<"buildReferenceImages">[] | undefined;
  processPics: Doc<"buildProcessPictures">[] | undefined;
  collaborators?: CollaboratorRow[];
};

export function BuildDetailBody(props: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    buildId,
    userId,
    build,
    heroUri,
    summary,
    outlineNodes,
    refImages,
    processPics,
    collaborators,
  } = props;

  const [tab, setTab] = useState<TabId>("explorer");
  const [focalOpen, setFocalOpen] = useState(false);
  const [rootOrderIds, setRootOrderIds] = useState<Id<"cosplayNodes">[]>([]);

  const detailSheetRef = useRef<NodeDetailSheetRef>(null);
  const inspector = useNodeInspector({ buildId, userId });

  const openNodeSheet = useCallback(
    (meta: NodeSelectionMeta) => {
      void inspector.commitSelection(meta);
      detailSheetRef.current?.present();
    },
    [inspector]
  );

  const handleSheetDismiss = useCallback(() => {
    void inspector.commitSelection(null);
  }, [inspector]);

  const handleSheetUnlink = useCallback(async () => {
    await inspector.unlinkSelected();
    detailSheetRef.current?.dismiss();
  }, [inspector]);

  const windowW = Dimensions.get("window").width;
  const boardGap = 12;
  const boardPad = 16 * 2;
  const boardCardW = Math.max(140, (windowW - boardPad - boardGap) / 2);

  const updateBuild = useMutation(api.builds.update);
  const reorderRoots = useMutation(api.builds.reorderRootLinks);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addRef = useMutation(api.buildReferenceImages.add);
  const removeRef = useMutation(api.buildReferenceImages.remove);
  const addProcess = useMutation(api.buildProcessPictures.add);
  const removeProcess = useMutation(api.buildProcessPictures.remove);

  const roots = useMemo(
    () => (outlineNodes ?? []).filter((n) => n.isRoot),
    [outlineNodes]
  );

  const rootsMembershipSig = useMemo(
    () => [...roots.map((r) => r._id as string)].sort().join("|"),
    [roots]
  );

  useEffect(() => {
    setRootOrderIds(roots.map((r) => r._id));
    // deps: `rootsMembershipSig` only — avoid resetting drag order when unrelated outline fields change.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional membership-only sync
  }, [rootsMembershipSig]);

  const nonRoots = useMemo(
    () => (outlineNodes ?? []).filter((n) => !n.isRoot),
    [outlineNodes]
  );

  const rootMap = useMemo(() => {
    const m = new Map<string, OutlineNode>();
    for (const r of roots) m.set(r._id as string, r);
    return m;
  }, [roots]);

  const orderedRoots = useMemo(() => {
    if (rootOrderIds.length === 0) return roots;
    return rootOrderIds.map((id) => rootMap.get(id as string)).filter(Boolean) as OutlineNode[];
  }, [rootOrderIds, rootMap, roots]);

  const onDragEnd = useCallback(
    async ({ data }: { data: OutlineNode[] }) => {
      const ids = data.map((r) => r._id);
      setRootOrderIds(ids);
      try {
        await reorderRoots({ userId, buildId, orderedCosplayNodeIds: ids });
      } catch (e) {
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      }
    },
    [buildId, reorderRoots, userId, t]
  );

  const pickAndUpload = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("buildDetail.needPhotoAccess"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const url = await generateUploadUrl();
    const storageId = await uploadUriToConvexStorage(asset.uri, url, asset.mimeType ?? "image/jpeg");
    return storageId;
  }, [generateUploadUrl, t]);

  const onAddReference = useCallback(async () => {
    try {
      const storageId = await pickAndUpload();
      if (!storageId) return;
      await addRef({ buildId, userId, imageStorageId: storageId });
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    }
  }, [addRef, buildId, pickAndUpload, userId, t]);

  const onAddProcess = useCallback(async () => {
    try {
      const storageId = await pickAndUpload();
      if (!storageId) return;
      await addProcess({ buildId, userId, imageStorageId: storageId });
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    }
  }, [addProcess, buildId, pickAndUpload, userId, t]);

  const saveFocal = useCallback(
    async (fx: number, fy: number) => {
      try {
        await updateBuild({ id: buildId, userId, imageFocalX: fx, imageFocalY: fy });
      } catch (e) {
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      }
    },
    [buildId, updateBuild, userId, t]
  );

  const renderRoot = useCallback(
    ({ item, drag, isActive }: RenderItemParams<OutlineNode>) => (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          disabled={isActive}
          onPress={() => {
            const idx = rootOrderIds.findIndex((id) => id === item._id);
            openNodeSheet({
              nodeId: item._id,
              isRoot: true,
              rootIndex: idx >= 0 ? idx : undefined,
            });
          }}
          className={`mb-3 overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm ${
            isActive ? "opacity-80" : ""
          }`}
        >
          <View className="flex-row items-stretch">
            <View className="h-[72px] w-[72px] bg-neutral-100">
              {item.imageStorageId || item.imageUrl ? (
                <ConvexStorageImage
                  storageId={item.imageStorageId}
                  imageUrl={item.imageUrl}
                  className="h-full w-full"
                />
              ) : (
                <View className="h-full w-full items-center justify-center">
                  <Text className="text-2xl text-neutral-300">◇</Text>
                </View>
              )}
            </View>
            <View className="min-w-0 flex-1 justify-center px-3 py-2">
              <Text className="text-base font-semibold text-neutral-900" numberOfLines={2}>
                {item.name}
              </Text>
              <Text className="mt-1 text-xs text-neutral-500">
                {t("elements.progressPercent", { pct: Math.round(item.progressPercent) })}
              </Text>
            </View>
            <View className="justify-center px-2">
              <Text className="text-xs font-semibold text-neutral-600">
                {Math.round(item.progressPercent)}%
              </Text>
            </View>
          </View>
        </Pressable>
      </ScaleDecorator>
    ),
    [openNodeSheet, rootOrderIds, t]
  );

  const TabBtn = ({ id, label }: { id: TabId; label: string }) => (
    <Pressable
      onPress={() => setTab(id)}
      className={`flex-1 min-w-[22%] items-center rounded-xl py-2.5 ${
        tab === id ? "bg-neutral-900" : "bg-neutral-100"
      }`}
    >
      <Text
        className={`text-[11px] font-semibold ${tab === id ? "text-white" : "text-neutral-700"}`}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );

  const heroBlock = (
    <>
      <View className="relative aspect-[16/10] w-full bg-neutral-200">
        {heroUri ? (
          <Pressable onPress={() => setFocalOpen(true)} className="absolute inset-0">
            <FocalCoverImage
              uri={heroUri}
              focalX={build.imageFocalX}
              focalY={build.imageFocalY}
              className="absolute inset-0"
            />
          </Pressable>
        ) : (
          <View className="absolute inset-0 items-center justify-center">
            <Text className="text-neutral-400">{t("home.heroFallback")}</Text>
          </View>
        )}
      </View>
      <Pressable onPress={() => setFocalOpen(true)} className="mx-4 mt-2 self-start">
        <Text className="text-sm font-semibold text-neutral-900 underline">
          {t("buildDetail.adjustFocal")}
        </Text>
      </Pressable>
      <View className="px-4 pb-2 pt-4">
        {build.character ? (
          <Text className="text-sm font-medium uppercase tracking-wide text-neutral-500">
            {build.character}
          </Text>
        ) : null}
        <Text className="mt-1 text-2xl font-semibold text-neutral-900">{build.name}</Text>
      </View>
    </>
  );

  const summaryStatsCard =
    summary != null ? (
      <View className="mx-4 mt-2 gap-1 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <Text className="text-sm text-neutral-700">
          {t("buildDetail.summaryProgress", { pct: Math.round(summary.progressPercent) })}
        </Text>
        <Text className="text-sm text-neutral-700">
          {t("buildDetail.summaryTasks", {
            checked: summary.tasksChecked,
            total: summary.tasksTotal,
          })}
        </Text>
        <Text className="text-sm text-neutral-700">
          {t("buildDetail.summaryLinked", {
            done: summary.linkedItemsCompleteCount,
            total: summary.linkedItemCount,
          })}
        </Text>
        {summary.remainingDays != null ? (
          <Text className="text-sm text-neutral-700">
            {t("buildDetail.summaryDue", { days: summary.remainingDays })}
          </Text>
        ) : null}
      </View>
    ) : null;

  const collaboratorsBlock =
    collaborators && collaborators.length > 0 ? (
      <View className="mx-4 mt-6">
        <Text className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
          {t("buildDetail.collaborators")}
        </Text>
        {collaborators.map((c) => (
          <View
            key={c.userId}
            className="mt-2 flex-row items-center justify-between border-b border-neutral-100 py-2"
          >
            <Text className="text-sm text-neutral-900">
              {c.name ?? c.username ?? c.email ?? c.userId}
            </Text>
            <Text className="text-xs uppercase text-neutral-500">
              {c.role === "editor"
                ? t("buildDetail.roleEditor")
                : c.role === "viewer"
                  ? t("buildDetail.roleViewer")
                  : c.role}
            </Text>
          </View>
        ))}
      </View>
    ) : null;

  const refsBlock = (
    <>
      <Text className="mx-4 mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {t("buildDetail.referenceImages")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2 px-4">
        <Pressable
          onPress={onAddReference}
          className="mr-3 h-24 w-24 items-center justify-center rounded-xl border border-dashed border-neutral-400 bg-neutral-50"
        >
          <Text className="text-2xl text-neutral-500">+</Text>
        </Pressable>
        {(refImages ?? []).map((r) => (
          <View key={r._id} className="mr-3 h-24 w-24 overflow-hidden rounded-xl">
            <ConvexStorageImage
              storageId={r.imageStorageId}
              imageUrl={r.imageUrl}
              className="h-full w-full"
            />
            <Pressable
              onPress={() =>
                Alert.alert(t("buildDetail.removePhotoTitle"), "", [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("buildDetail.removeConfirm"),
                    style: "destructive",
                    onPress: () => void removeRef({ id: r._id, userId }),
                  },
                ])
              }
              className="absolute right-1 top-1 rounded bg-black/50 px-1.5 py-0.5"
            >
              <Text className="text-[10px] font-bold text-white">×</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </>
  );

  const processBlock = (
    <>
      <Text className="mx-4 mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {t("buildDetail.processPictures")}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2 px-4">
        <Pressable
          onPress={onAddProcess}
          className="mr-3 h-24 w-24 items-center justify-center rounded-xl border border-dashed border-neutral-400 bg-neutral-50"
        >
          <Text className="text-2xl text-neutral-500">+</Text>
        </Pressable>
        {(processPics ?? []).map((r) => (
          <View key={r._id} className="mr-3 h-24 w-24 overflow-hidden rounded-xl">
            <ConvexStorageImage
              storageId={r.imageStorageId}
              imageUrl={r.imageUrl}
              className="h-full w-full"
            />
            <Pressable
              onPress={() =>
                Alert.alert(t("buildDetail.removePhotoTitle"), "", [
                  { text: t("common.cancel"), style: "cancel" },
                  {
                    text: t("buildDetail.removeConfirm"),
                    style: "destructive",
                    onPress: () => void removeProcess({ id: r._id, userId }),
                  },
                ])
              }
              className="absolute right-1 top-1 rounded bg-black/50 px-1.5 py-0.5"
            >
              <Text className="text-[10px] font-bold text-white">×</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </>
  );

  return (
    <View className="flex-1 bg-white">
      <View className="flex-shrink-0">{heroBlock}</View>

      <View className="flex-shrink-0 flex-row flex-wrap gap-2 bg-white px-4 py-3">
        <TabBtn id="explorer" label={t("buildDetail.tabExplorer")} />
        <TabBtn id="tasks" label={t("buildDetail.tabTasks")} />
        <TabBtn id="board" label={t("buildDetail.tabBoard")} />
        <TabBtn id="summary" label={t("buildDetail.tabSummary")} />
      </View>

      <View className="min-h-0 flex-1">
        {tab === "explorer" ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName="pb-16 pt-2"
            nestedScrollEnabled
          >
            {summaryStatsCard}

            {build.notes ? (
              <View className="mx-4 mt-4 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <Text className="text-xs font-semibold uppercase text-neutral-500">
                  {t("buildDetail.notesLabel")}
                </Text>
                <Text className="mt-2 text-sm leading-relaxed text-neutral-800">{build.notes}</Text>
              </View>
            ) : null}

            <Text className="mx-4 mb-2 mt-6 text-xs text-neutral-500">
              {t("buildDetail.outlineDragHint")}
            </Text>
            {orderedRoots.length > 0 ? (
              <View className="px-4">
                <DraggableFlatList
                  data={orderedRoots}
                  keyExtractor={(item) => item._id as string}
                  onDragEnd={onDragEnd}
                  renderItem={renderRoot}
                  style={{ flexGrow: 0 }}
                  scrollEnabled={false}
                />
              </View>
            ) : (
              <Text className="mx-4 text-neutral-600">{t("buildDetail.outlineEmpty")}</Text>
            )}

            {nonRoots.length > 0 ? (
              <>
                <Text className="mx-4 mb-3 mt-8 text-sm font-semibold uppercase text-neutral-500">
                  {t("buildDetail.subElements")}
                </Text>
                <FlatList
                  data={nonRoots}
                  scrollEnabled={false}
                  keyExtractor={(item) => item._id as string}
                  renderItem={({ item }) => (
                    <Pressable
                      onPress={() => openNodeSheet({ nodeId: item._id, isRoot: false })}
                      style={{ marginLeft: 16 + item.depth * 14 }}
                      className="mb-2 overflow-hidden rounded-xl border border-neutral-200 bg-white px-3 py-3 shadow-sm"
                    >
                      <Text className="text-base font-medium text-neutral-900">{item.name}</Text>
                      <Text className="mt-1 text-xs text-neutral-500">
                        {t("elements.progressPercent", { pct: Math.round(item.progressPercent) })}
                      </Text>
                    </Pressable>
                  )}
                />
              </>
            ) : null}

            <Pressable
              onPress={() => router.push(APP_HREF.buildLinkElements(buildId))}
              className="mx-4 mt-8 items-center rounded-xl bg-neutral-900 py-3 active:opacity-90"
            >
              <Text className="font-semibold text-white">{t("buildDetail.linkElements")}</Text>
            </Pressable>
          </ScrollView>
        ) : null}

        {tab === "tasks" ? (
          <View className="flex-1 pb-8">
            <BuildWorkflowTasks buildId={buildId} userId={userId} t={t} />
          </View>
        ) : null}

        {tab === "board" ? (
          <ScrollView className="flex-1" contentContainerClassName="pb-16 pt-2">
            <View className="flex-row flex-wrap gap-3 px-4">
              {(outlineNodes ?? []).length === 0 ? (
                <Text className="text-neutral-600">{t("buildDetail.boardEmpty")}</Text>
              ) : (
                (outlineNodes ?? []).map((node) => (
                  <Pressable
                    key={node._id as string}
                    onPress={() => router.push(APP_HREF.element(node._id as string))}
                    style={{ width: boardCardW }}
                    className="overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 shadow-sm"
                  >
                    <View className="aspect-square w-full bg-neutral-100">
                      {node.imageStorageId || node.imageUrl ? (
                        <ConvexStorageImage
                          storageId={node.imageStorageId}
                          imageUrl={node.imageUrl}
                          className="h-full w-full"
                        />
                      ) : (
                        <View className="h-full w-full items-center justify-center">
                          <Text className="text-4xl text-neutral-300">◇</Text>
                        </View>
                      )}
                    </View>
                    <View className="p-3">
                      <Text className="text-sm font-semibold text-neutral-900" numberOfLines={2}>
                        {node.name}
                      </Text>
                      <Text className="mt-1 text-xs text-neutral-500">
                        {t("elements.progressPercent", { pct: Math.round(node.progressPercent) })}
                      </Text>
                    </View>
                  </Pressable>
                ))
              )}
            </View>
          </ScrollView>
        ) : null}

        {tab === "summary" ? (
          <ScrollView className="flex-1" contentContainerClassName="pb-16" nestedScrollEnabled>
            {summaryStatsCard}
            {collaboratorsBlock}

            <Pressable
              onPress={() => router.push(APP_HREF.buildLinkElements(buildId))}
              className="mx-4 mt-6 items-center rounded-xl bg-neutral-900 py-3 active:opacity-90"
            >
              <Text className="font-semibold text-white">{t("buildDetail.linkElements")}</Text>
            </Pressable>

            {refsBlock}
            {processBlock}
          </ScrollView>
        ) : null}
      </View>

      <HeroFocalModal
        visible={focalOpen && !!heroUri}
        imageUri={heroUri ?? ""}
        initialFocalX={build.imageFocalX}
        initialFocalY={build.imageFocalY}
        onClose={() => setFocalOpen(false)}
        onSave={saveFocal}
      />

      <NodeDetailSheet
        ref={detailSheetRef}
        detail={inspector.selectedDetail}
        selected={inspector.selected}
        inspectorForm={inspector.inspectorForm}
        persistStatus={inspector.persistStatus}
        onFormChange={inspector.setInspectorForm}
        onFlushSave={() => void inspector.flushSave()}
        onUnlink={handleSheetUnlink}
        onDismiss={handleSheetDismiss}
      />
    </View>
  );
}
