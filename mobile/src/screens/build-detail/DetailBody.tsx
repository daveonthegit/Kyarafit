import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  Text,
  TextInput,
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
import { TaskSwipeRow } from "./TaskSwipeRow";

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
};

type TaskRow = {
  _id: Id<"workflowItems">;
  label: string;
  checked: boolean;
};

type CommentRow = {
  _id: Id<"buildComments">;
  body: string;
  authorName: string;
  authorUsername: string | null;
  createdAt: number;
};

type CollaboratorRow = {
  userId: string;
  role: string;
  email: string | null;
  name: string | null;
  username: string | null;
};

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
  tasks: TaskRow[] | undefined;
  refImages: Doc<"buildReferenceImages">[] | undefined;
  processPics: Doc<"buildProcessPictures">[] | undefined;
  likeCount: number;
  liked: boolean;
  comments: CommentRow[];
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
    tasks,
    refImages,
    processPics,
    likeCount,
    liked,
    comments,
    collaborators,
  } = props;

  const [tab, setTab] = useState<"overview" | "outline" | "tasks">("overview");
  const [commentDraft, setCommentDraft] = useState("");
  const [focalOpen, setFocalOpen] = useState(false);
  const [taskOptimistic, setTaskOptimistic] = useState<Record<string, boolean>>({});
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [rootOrderIds, setRootOrderIds] = useState<Id<"cosplayNodes">[]>([]);

  const updateBuild = useMutation(api.builds.update);
  const reorderRoots = useMutation(api.builds.reorderRootLinks);
  const updateTask = useMutation(api.buildTasks.update);
  const createTask = useMutation(api.buildTasks.create);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const addRef = useMutation(api.buildReferenceImages.add);
  const removeRef = useMutation(api.buildReferenceImages.remove);
  const addProcess = useMutation(api.buildProcessPictures.add);
  const removeProcess = useMutation(api.buildProcessPictures.remove);
  const likeBuild = useMutation(api.buildLikes.like);
  const unlikeBuild = useMutation(api.buildLikes.unlike);
  const addComment = useMutation(api.buildComments.add);

  const roots = useMemo(
    () => (outlineNodes ?? []).filter((n) => n.isRoot),
    [outlineNodes]
  );

  const rootsMembershipSig = useMemo(
    () =>
      [...roots.map((r) => r._id as string)].sort().join("|"),
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

  const toggleTask = useCallback(
    async (taskId: Id<"workflowItems">, next: boolean) => {
      setTaskOptimistic((m) => ({ ...m, [taskId as string]: next }));
      try {
        await updateTask({ id: taskId, userId, checked: next });
      } catch (e) {
        setTaskOptimistic((m) => {
          const c = { ...m };
          delete c[taskId as string];
          return c;
        });
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      }
    },
    [updateTask, userId, t]
  );

  const effectiveChecked = useCallback(
    (taskId: Id<"workflowItems">, server: boolean) => {
      const k = taskId as string;
      return k in taskOptimistic ? taskOptimistic[k]! : server;
    },
    [taskOptimistic]
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

  const addTask = useCallback(async () => {
    const label = newTaskLabel.trim();
    if (!label) return;
    try {
      await createTask({ userId, buildId, label });
      setNewTaskLabel("");
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    }
  }, [buildId, createTask, newTaskLabel, userId, t]);

  const toggleLike = useCallback(async () => {
    try {
      if (liked) {
        await unlikeBuild({ userId, buildId });
      } else {
        await likeBuild({ userId, buildId });
      }
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    }
  }, [buildId, liked, likeBuild, unlikeBuild, userId, t]);

  const submitComment = useCallback(async () => {
    const body = commentDraft.trim();
    if (!body) return;
    try {
      await addComment({ userId, buildId, body });
      setCommentDraft("");
    } catch (e) {
      Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
    }
  }, [addComment, buildId, commentDraft, userId, t]);

  const renderRoot = useCallback(
    ({ item, drag, isActive }: RenderItemParams<OutlineNode>) => (
      <ScaleDecorator>
        <Pressable
          onLongPress={drag}
          disabled={isActive}
          className={`mb-2 flex-row items-center rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 ${
            isActive ? "opacity-80" : ""
          }`}
        >
          <Text className="flex-1 text-neutral-900" numberOfLines={2}>
            {item.name}
          </Text>
          <Text className="text-xs text-neutral-500">{Math.round(item.progressPercent)}%</Text>
        </Pressable>
      </ScaleDecorator>
    ),
    []
  );

  const TabBtn = ({
    id,
    label,
  }: {
    id: "overview" | "outline" | "tasks";
    label: string;
  }) => (
    <Pressable
      onPress={() => setTab(id)}
      className={`flex-1 items-center rounded-lg py-2 ${
        tab === id ? "bg-neutral-900" : "bg-neutral-100"
      }`}
    >
      <Text className={`text-xs font-semibold ${tab === id ? "text-white" : "text-neutral-700"}`}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row gap-2 px-4 pb-2 pt-1">
        <TabBtn id="overview" label={t("buildDetail.tabOverview")} />
        <TabBtn id="outline" label={t("buildDetail.tabOutline")} />
        <TabBtn id="tasks" label={t("buildDetail.tabTasks")} />
      </View>

      {tab === "overview" ? (
        <ScrollView className="flex-1" contentContainerClassName="pb-12">
          <View className="relative aspect-[4/5] w-full bg-neutral-200">
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

          <View className="px-4 pt-4">
            {build.character ? (
              <Text className="text-sm font-medium uppercase tracking-wide text-neutral-500">
                {build.character}
              </Text>
            ) : null}
            <Text className="mt-1 text-2xl font-semibold text-neutral-900">{build.name}</Text>

            {summary ? (
              <View className="mt-4 gap-1 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
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
            ) : null}

            {build.notes ? (
              <Text className="mt-4 text-sm leading-relaxed text-neutral-700">{build.notes}</Text>
            ) : null}

            <Text className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {t("buildDetail.sectionSocial")}
            </Text>
            <View className="mt-3 flex-row items-center gap-4">
              <Pressable
                onPress={() => void toggleLike()}
                className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 active:opacity-90"
              >
                <Text className="font-semibold text-neutral-900">
                  {liked ? "♥ " : "♡ "}
                  {t("buildDetail.likesCount", { count: likeCount })}
                </Text>
              </Pressable>
            </View>

            {comments.length > 0 ? (
              <View className="mt-4 gap-3">
                {comments.map((c) => (
                  <View key={c._id as string} className="rounded-xl border border-neutral-200 bg-white px-3 py-2">
                    <Text className="text-xs font-semibold text-neutral-500">
                      {c.authorUsername ? `@${c.authorUsername}` : c.authorName}
                    </Text>
                    <Text className="mt-1 text-sm text-neutral-900">{c.body}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text className="mt-2 text-sm text-neutral-500">{t("buildDetail.noCommentsYet")}</Text>
            )}

            <TextInput
              value={commentDraft}
              onChangeText={setCommentDraft}
              placeholder={t("buildDetail.addCommentPlaceholder")}
              placeholderTextColor="#a3a3a3"
              className="mt-4 rounded-xl border border-neutral-200 px-3 py-2.5 text-neutral-900"
              multiline
            />
            <Pressable
              onPress={() => void submitComment()}
              className="mt-2 items-center rounded-xl bg-neutral-200 py-2.5 active:opacity-90"
            >
              <Text className="font-semibold text-neutral-900">{t("buildDetail.postComment")}</Text>
            </Pressable>

            {collaborators && collaborators.length > 0 ? (
              <View className="mt-6">
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
            ) : null}

            <Pressable
              onPress={() => router.push(APP_HREF.buildLinkElements(buildId))}
              className="mt-6 items-center rounded-xl bg-neutral-900 py-3 active:opacity-90"
            >
              <Text className="font-semibold text-white">{t("buildDetail.linkElements")}</Text>
            </Pressable>

            <Text className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {t("buildDetail.referenceImages")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
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

            <Text className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">
              {t("buildDetail.processPictures")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
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
          </View>
        </ScrollView>
      ) : null}

      {tab === "outline" ? (
        <ScrollView className="flex-1 px-4 pt-2" contentContainerClassName="pb-8">
          <Text className="mb-2 text-xs text-neutral-500">{t("buildDetail.outlineDragHint")}</Text>
          {orderedRoots.length > 0 ? (
            <DraggableFlatList
              data={orderedRoots}
              keyExtractor={(item) => item._id as string}
              onDragEnd={onDragEnd}
              renderItem={renderRoot}
              style={{ flexGrow: 0 }}
              scrollEnabled={false}
            />
          ) : (
            <Text className="text-neutral-600">{t("buildDetail.outlineEmpty")}</Text>
          )}
          {nonRoots.length > 0 ? (
            <>
              <Text className="mb-2 mt-6 text-sm font-semibold uppercase text-neutral-500">
                {t("buildDetail.subElements")}
              </Text>
              <FlatList
                data={nonRoots}
                scrollEnabled={false}
                keyExtractor={(item) => item._id as string}
                renderItem={({ item }) => (
                  <View
                    style={{ paddingLeft: 12 + item.depth * 14 }}
                    className="border-b border-neutral-100 py-2"
                  >
                    <Text className="text-neutral-900">{item.name}</Text>
                  </View>
                )}
              />
            </>
          ) : null}
        </ScrollView>
      ) : null}

      {tab === "tasks" ? (
        <ScrollView className="flex-1 px-4 pt-2" contentContainerClassName="pb-10">
          {(tasks ?? []).map((task) => {
            const checked = effectiveChecked(task._id, task.checked);
            return (
              <View key={task._id} className="mb-2">
                <TaskSwipeRow checked={checked} onToggle={() => void toggleTask(task._id, !checked)}>
                  <Pressable
                    onPress={() => void toggleTask(task._id, !checked)}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-base ${checked ? "text-neutral-400 line-through" : "text-neutral-900"}`}
                    >
                      {task.label}
                    </Text>
                  </Pressable>
                </TaskSwipeRow>
              </View>
            );
          })}
          {(tasks ?? []).length === 0 ? (
            <Text className="text-neutral-600">{t("buildDetail.noTasks")}</Text>
          ) : null}

          <Text className="mt-6 text-sm font-semibold text-neutral-700">{t("buildDetail.addTask")}</Text>
          <TextInput
            value={newTaskLabel}
            onChangeText={setNewTaskLabel}
            placeholder={t("buildDetail.addTaskPlaceholder")}
            className="mt-2 rounded-xl border border-neutral-200 px-3 py-2 text-neutral-900"
            onSubmitEditing={() => void addTask()}
          />
          <Pressable
            onPress={() => void addTask()}
            className="mt-2 items-center rounded-xl bg-neutral-900 py-3 active:opacity-90"
          >
            <Text className="font-semibold text-white">{t("buildDetail.addTaskButton")}</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      <HeroFocalModal
        visible={focalOpen && !!heroUri}
        imageUri={heroUri ?? ""}
        initialFocalX={build.imageFocalX}
        initialFocalY={build.imageFocalY}
        onClose={() => setFocalOpen(false)}
        onSave={saveFocal}
      />
    </View>
  );
}
