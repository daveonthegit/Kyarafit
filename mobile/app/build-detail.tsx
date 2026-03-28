import { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Image, Alert } from "react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { EditorialProgressDonut } from "../src/components/ui/EditorialProgressDonut";
import { ImageCard } from "../src/components/ui/ImageCard";
import type { Build, BuildTask } from "@kyarafit/design-system/types";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import {
  getBuild,
  getLinkedClosetItemIds,
  updateBuild as updateBuildLocal,
} from "../src/storage/buildsRepo";
import {
  listTasks,
  createTask,
  toggleTaskChecked,
  deleteTask,
  updateTask,
} from "../src/storage/buildTasksRepo";
import { listItems } from "../src/storage/closetRepo";
import type { ClosetItem } from "@kyarafit/design-system/types";
import * as ImagePicker from "expo-image-picker";
import { StorageImage } from "../src/components/shared";
import { BuildDetailCloudSections } from "../src/components/build/BuildDetailCloudSections";
import { BuildSocialSection } from "../src/components/build/BuildSocialSection";
import { BuildVisualBoardMobile } from "../src/components/build/BuildVisualBoardMobile";
import { postToConvexUpload } from "../src/lib/convexUpload";
import { useTranslation } from "react-i18next";

const STATUSES = ["idea", "wip", "ready"] as const;
type ClosetEntityId = Id<"closetItems"> | Id<"cosplayNodes">;

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function BuildDetailScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const id =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const router = useRouter();
  const { userId } = useCurrentUser();

  const buildId = id as Id<"builds"> | undefined;
  const convexBuild = useQuery(api.builds.get, userId && buildId ? { id: buildId } : "skip");
  const convexItemIds = (useQuery(api.builds.getItems, userId && buildId ? { buildId } : "skip") ??
    []) as ClosetEntityId[];
  const convexClosetItems =
    (useQuery(api.closetItems.list, userId ? { userId } : "skip") ?? []) as Array<{
      _id: ClosetEntityId;
      name: string;
      category?: ClosetItem["category"];
      imageUrl?: string;
      imageStorageId?: Id<"_storage">;
      costCents?: number;
    }>;
  const convexTasks = useQuery(
    api.buildTasks.listByBuild,
    userId && buildId ? { buildId } : "skip"
  );
  const updateBuildMut = useMutation(api.builds.update);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createTaskMut = useMutation(api.buildTasks.create);
  const updateTaskMut = useMutation(api.buildTasks.update);
  const deleteTaskMut = useMutation(api.buildTasks.remove);
  const toggleTaskMut = useMutation(api.buildTasks.update);

  const [localBuild, setLocalBuild] = useState<Build | null>(null);
  const [linkedIds, setLinkedIds] = useState<string[]>([]);
  const [closetItems, setClosetItems] = useState<ClosetItem[]>([]);
  const [localTasks, setLocalTasks] = useState<BuildTask[]>([]);
  const [localLoaded, setLocalLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!id || userId) {
      if (!userId) setLocalLoaded(true);
      return;
    }
    const [b, ids, items, taskList] = await Promise.all([
      getBuild(id),
      getLinkedClosetItemIds(id),
      listItems(),
      listTasks(id),
    ]);
    setLocalBuild(b ?? null);
    setLinkedIds(ids);
    setClosetItems(items);
    setLocalTasks(taskList);
    setLocalLoaded(true);
  }, [id, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!userId) setLocalLoaded(false);
      load();
    }, [load, userId])
  );

  const isCloud = !!userId;
  const build: Build | null = isCloud
    ? convexBuild
      ? {
          id: convexBuild._id,
          name: convexBuild.name,
          character: convexBuild.character,
          status: convexBuild.status as Build["status"],
          imageUrl: convexBuild.imageUrl,
          budgetCents: convexBuild.budgetCents,
          targetDate: convexBuild.targetDate,
          tasksTotal: convexBuild.tasksTotal ?? 0,
          tasksChecked: convexBuild.tasksChecked ?? 0,
          createdAt: "",
          updatedAt: "",
        }
      : null
    : localBuild;

  const linkedItems: ClosetItem[] = isCloud
    ? convexClosetItems
        .filter((c) => convexItemIds.some((itemId) => itemId === c._id))
        .map((c) => ({
          id: c._id as string,
          name: c.name,
          category: c.category ?? "other",
          tags: [],
          imageUrl: c.imageUrl,
          costCents: c.costCents,
          createdAt: "",
          updatedAt: "",
        }))
    : closetItems.filter((c) => linkedIds.includes(c.id));

  const visualLinked = useMemo(() => {
    if (!isCloud) return [];
    return convexClosetItems
      .filter((c) => convexItemIds.some((itemId) => itemId === c._id))
      .map((c) => ({
        _id: c._id,
        name: c.name,
        category: c.category,
        imageUrl: c.imageUrl,
        imageStorageId: c.imageStorageId,
        costCents: c.costCents,
      }));
  }, [isCloud, convexClosetItems, convexItemIds]);

  const tasks: BuildTask[] = isCloud
    ? (convexTasks ?? []).map((t) => ({
        id: t._id,
        buildId: t.buildId,
        label: t.label,
        cosplayNodeId: (t.cosplayNodeId ?? t.closetItemId) as string | undefined,
        closetItemId: (t.cosplayNodeId ?? t.closetItemId) as string | undefined,
        sortOrder: t.sortOrder,
        checked: t.checked,
        createdAt: "",
        updatedAt: "",
      }))
    : localTasks;

  const [newTaskLabel, setNewTaskLabel] = useState("");
  const assignSheetRef = useRef<BottomSheetModal>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCharacter, setEditCharacter] = useState("");
  const [editStatus, setEditStatus] = useState<string>("wip");
  const [editBudgetCents, setEditBudgetCents] = useState("");
  const [editTargetDate, setEditTargetDate] = useState("");
  const [editImageStorageId, setEditImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [heroUploading, setHeroUploading] = useState(false);
  const [savePending, setSavePending] = useState(false);

  useEffect(() => {
    if (build && isEditing) {
      setEditName(build.name);
      setEditCharacter(build.character ?? "");
      setEditStatus(build.status ?? "wip");
      setEditBudgetCents(build.budgetCents != null ? (build.budgetCents / 100).toFixed(2) : "");
      setEditTargetDate(build.targetDate ?? "");
      if (convexBuild && isCloud) {
        setEditImageStorageId(convexBuild.imageStorageId ?? null);
      } else {
        setEditImageStorageId(null);
      }
    }
  }, [build, isEditing, convexBuild, isCloud]);

  const loaded = isCloud ? convexBuild !== undefined : localLoaded;

  if (!id) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-row items-center gap-4 px-6 pt-14 pb-4 border-b border-black/5">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
            Build
          </Text>
        </View>
        <Text className="text-xs text-black/40 mt-2 px-6">Missing build id.</Text>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View className="flex-1 bg-white">
        <Text className="text-xs text-black/40 mt-8 px-6">{t("Common.loading")}</Text>
      </View>
    );
  }

  if (!build) {
    return (
      <View className="flex-1 bg-white">
        <View className="flex-row items-center gap-4 px-6 pt-14 pb-4 border-b border-black/5">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
            {t("BuildDetail.meta")}
          </Text>
        </View>
        <Text className="text-xs text-black/40 mt-2 px-6">{t("BuildDetail.notFound")}</Text>
      </View>
    );
  }

  const totalCostCents = linkedItems.reduce((sum, i) => sum + (i.costCents ?? 0), 0);

  const tasksChecked = tasks.filter((t) => t.checked).length;
  const tasksTotal = tasks.length;
  const completionPercent = tasksTotal > 0 ? Math.round((tasksChecked / tasksTotal) * 100) : 0;

  const getDaysRemaining = (targetDate: string | null | undefined) => {
    if (!targetDate) return null;
    const target = new Date(targetDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getDaysRemaining(build.targetDate);

  const onAddTask = async () => {
    if (!newTaskLabel.trim() || !id) return;
    if (isCloud && userId) {
      await createTaskMut({
        userId,
        buildId: buildId!,
        label: newTaskLabel.trim(),
        sortOrder: tasks.length,
      });
    } else if (!isCloud) {
      await createTask(id, {
        label: newTaskLabel.trim(),
        sortOrder: tasks.length,
      });
      const next = await listTasks(id);
      setLocalTasks(next);
    }
    setNewTaskLabel("");
  };

  const onToggleTask = async (taskId: string) => {
    if (!id) return;
    const task = tasks.find((t) => t.id === taskId);
    const newChecked = task ? !task.checked : false;
    if (isCloud && userId) {
      await toggleTaskMut({
        id: taskId as Id<"workflowItems">,
        userId,
        checked: newChecked,
      });
    } else {
      setLocalTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, checked: newChecked } : t))
      );
      try {
        await toggleTaskChecked(taskId, id);
      } catch (error) {
        setLocalTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, checked: !newChecked } : t))
        );
      }
    }
  };

  const onDeleteTask = async (taskId: string) => {
    if (!id) return;
    Alert.alert(t("BuildDetail.deleteTaskConfirmTitle"), t("BuildDetail.deleteTaskConfirmBody"), [
      { text: t("Common.cancel"), style: "cancel" },
      {
        text: t("Common.delete"),
        style: "destructive",
        onPress: async () => {
          if (isCloud && userId) {
            await deleteTaskMut({ id: taskId as Id<"workflowItems">, userId });
          } else {
            setLocalTasks((prev) => prev.filter((t) => t.id !== taskId));
            try {
              await deleteTask(taskId, id);
            } catch (error) {
              const reloaded = await listTasks(id);
              setLocalTasks(reloaded);
            }
          }
        },
      },
    ]);
  };

  const onLongPressTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    assignSheetRef.current?.present();
  };

  const onAssignTask = async (closetItemId: string | null) => {
    if (!id || !selectedTaskId) return;
    assignSheetRef.current?.dismiss();
    setSelectedTaskId(null);
    if (isCloud && userId) {
      await updateTaskMut({
        id: selectedTaskId as Id<"workflowItems">,
        userId,
        closetItemId: closetItemId ? (closetItemId as Id<"closetItems">) : undefined,
      });
    } else {
      setLocalTasks((prev) =>
        prev.map((t) =>
          t.id === selectedTaskId ? { ...t, closetItemId: closetItemId ?? undefined } : t
        )
      );
      try {
        await updateTask(selectedTaskId, id, { closetItemId });
      } catch (error) {
        const reloaded = await listTasks(id);
        setLocalTasks(reloaded);
      }
    }
  };

  const pickHeroImage = async () => {
    if (!userId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t("Common.permissionTitle"), t("Common.permissionPhotos"));
      return;
    }
    setHeroUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const res = await fetch(asset.uri);
      const buf = await res.arrayBuffer();
      const uploadUrl = await generateUploadUrl();
      const storageId = await postToConvexUpload(uploadUrl, buf, asset.mimeType ?? "image/jpeg");
      setEditImageStorageId(storageId);
    } catch (e) {
      Alert.alert(
        t("Common.uploadFailed"),
        e instanceof Error ? e.message : t("Common.unknownError")
      );
    } finally {
      setHeroUploading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!build || !editName.trim()) return;
    setSavePending(true);
    try {
      if (isCloud && userId) {
        await updateBuildMut({
          id: build.id as Id<"builds">,
          userId,
          name: editName.trim(),
          character: editCharacter.trim() || undefined,
          status: editStatus as Build["status"],
          budgetCents: editBudgetCents.trim()
            ? Math.round(parseFloat(editBudgetCents) * 100)
            : undefined,
          targetDate: editTargetDate.trim() || undefined,
          imageStorageId: editImageStorageId ?? undefined,
        });
      } else {
        await updateBuildLocal(build.id, {
          name: editName.trim(),
          character: editCharacter.trim() || undefined,
          status: editStatus as Build["status"],
          budgetCents: editBudgetCents.trim()
            ? Math.round(parseFloat(editBudgetCents) * 100)
            : undefined,
          targetDate: editTargetDate.trim() || undefined,
        });
        setLocalBuild((prev) =>
          prev
            ? {
                ...prev,
                name: editName.trim(),
                character: editCharacter.trim() || undefined,
                status: editStatus as Build["status"],
                budgetCents: editBudgetCents.trim()
                  ? Math.round(parseFloat(editBudgetCents) * 100)
                  : undefined,
                targetDate: editTargetDate.trim() || undefined,
              }
            : null
        );
      }
      setIsEditing(false);
    } finally {
      setSavePending(false);
    }
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center justify-between px-6 pt-14 pb-4 border-b border-black/5">
        <View className="flex-row items-center gap-4 flex-1">
          <Pressable onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
          <Text
            className="flex-1 text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50"
            numberOfLines={1}
          >
            {build.name}
          </Text>
        </View>
        {!isEditing ? (
          <Pressable onPress={() => setIsEditing(true)} hitSlop={12}>
            <Ionicons name="pencil-outline" size={22} color="#000" />
          </Pressable>
        ) : (
          <Pressable onPress={() => setIsEditing(false)} disabled={savePending}>
            <Text className="text-[10px] uppercase tracking-[0.2em] font-semibold text-black/40">
              Cancel
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
        {isEditing ? (
          <View className="px-6 mb-8 mt-6">
            <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-4">
              {t("BuildDetail.editBuild")}
            </Text>

            {isCloud && userId && convexBuild ? (
              <View className="mb-6">
                <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2">
                  Hero image
                </Text>
                <View className="aspect-[3/4] rounded-2xl overflow-hidden bg-[#F9F9F9] mb-3">
                  <StorageImage
                    imageStorageId={editImageStorageId ?? convexBuild.imageStorageId}
                    imageUrl={convexBuild.imageUrl}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                </View>
                <Pressable
                  className="border border-black py-2.5 items-center rounded-full"
                  onPress={pickHeroImage}
                  disabled={heroUploading}
                >
                  <Text className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black">
                    {heroUploading ? t("BuildDetail.uploading") : t("BuildDetail.changeHero")}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View className="mb-5">
              <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2">
                Name
              </Text>
              <TextInput
                className="border-b border-black/10 py-2.5 text-sm text-black"
                value={editName}
                onChangeText={setEditName}
                placeholder={t("BuildDetail.namePlaceholder")}
                placeholderTextColor="rgba(0,0,0,0.4)"
              />
            </View>

            <View className="mb-5">
              <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2">
                {t("BuildDetail.character")}
              </Text>
              <TextInput
                className="border-b border-black/10 py-2.5 text-sm text-black"
                value={editCharacter}
                onChangeText={setEditCharacter}
                placeholder={t("BuildDetail.characterPlaceholder")}
                placeholderTextColor="rgba(0,0,0,0.4)"
              />
            </View>

            <View className="mb-5">
              <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2">
                {t("BuildDetail.status")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <Pressable
                    key={s}
                    className={`py-2.5 px-3.5 border rounded-full ${editStatus === s ? "border-black bg-[#F9F9F9]" : "border-black/10"}`}
                    onPress={() => setEditStatus(s)}
                  >
                    <Text
                      className={`text-xs font-semibold ${editStatus === s ? "text-black" : "text-black/40"}`}
                    >
                      {s}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View className="mb-5">
              <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2">
                Budget $ (optional)
              </Text>
              <TextInput
                className="border-b border-black/10 py-2.5 text-sm text-black"
                value={editBudgetCents}
                onChangeText={setEditBudgetCents}
                placeholder="0.00"
                placeholderTextColor="rgba(0,0,0,0.4)"
                keyboardType="decimal-pad"
              />
            </View>

            <View className="mb-5">
              <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2">
                {t("BuildDetail.deadline")}
              </Text>
              <TextInput
                className="border-b border-black/10 py-2.5 text-sm text-black"
                value={editTargetDate}
                onChangeText={setEditTargetDate}
                placeholder={t("BuildDetail.deadlinePlaceholder")}
                placeholderTextColor="rgba(0,0,0,0.4)"
              />
            </View>

            <View className="gap-3 mt-6">
              <Pressable
                className={`bg-black py-3.5 items-center rounded-full ${savePending ? "opacity-50" : ""}`}
                onPress={handleSaveEdit}
                disabled={savePending || !editName.trim()}
              >
                <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
                  {savePending ? t("Common.saving") : t("BuildDetail.saveChanges")}
                </Text>
              </Pressable>
              <Pressable
                className="border border-black py-3.5 items-center rounded-full"
                onPress={() => setIsEditing(false)}
                disabled={savePending}
              >
                <Text className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black">
                  {t("Common.cancel")}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <>
            {isCloud && convexBuild && (convexBuild.imageUrl || convexBuild.imageStorageId) ? (
              <View className="mx-6 mt-6 aspect-[3/4] bg-[#F9F9F9] mb-6 rounded-3xl overflow-hidden">
                <StorageImage
                  imageStorageId={convexBuild.imageStorageId}
                  imageUrl={convexBuild.imageUrl}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              </View>
            ) : build.imageUrl ? (
              <View className="mx-6 mt-6 aspect-[3/4] bg-[#F9F9F9] mb-6 rounded-3xl overflow-hidden">
                <Image
                  source={{ uri: build.imageUrl }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
            ) : null}

            <View
              className={`px-6 mb-6 ${!build.imageUrl && !(isCloud && convexBuild && (convexBuild.imageUrl || convexBuild.imageStorageId)) ? "mt-6" : ""}`}
            >
              <Text className="text-[10px] uppercase tracking-[0.15em] text-black/40 mb-2">
                {build.status.toUpperCase()}
              </Text>
              <Text className="font-serif text-[32px] font-bold italic text-black tracking-tight leading-none mb-2">
                {build.name}
              </Text>
              {build.character && (
                <Text className="text-sm text-black/40">Character: {build.character}</Text>
              )}
            </View>

            <View className="px-6 gap-6 mb-6">
              <View className="gap-2">
                <Text className="text-[10px] uppercase tracking-[0.2em] font-medium text-black/40">
                  {t("BuildDetail.completion")}
                </Text>
                <View className="items-center my-4">
                  <EditorialProgressDonut progress={completionPercent} size={100} strokeWidth={3} />
                </View>
                <Text className="text-xs text-black/40 mt-1">
                  {tasksChecked} of {tasksTotal} tasks complete
                </Text>
              </View>

              {build.targetDate && daysRemaining !== null && (
                <View className="gap-2">
                  <Text className="text-[10px] uppercase tracking-[0.2em] font-medium text-black/40">
                    {t("BuildDetail.deadlineLabel")}
                  </Text>
                  <View className="flex-row items-start gap-3 mt-2">
                    <Ionicons name="calendar-outline" size={18} color="#000" />
                    <View className="flex-1 gap-1">
                      <Text className="text-sm font-medium text-black">
                        {new Date(build.targetDate).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </Text>
                      <Text
                        className={`text-xs ${
                          daysRemaining < 0
                            ? "text-red-600"
                            : daysRemaining <= 7
                              ? "text-orange-600"
                              : "text-black/40"
                        }`}
                      >
                        {daysRemaining < 0
                          ? `${Math.abs(daysRemaining)} days overdue`
                          : daysRemaining === 0
                            ? "Due today!"
                            : `${daysRemaining} days remaining`}
                      </Text>
                    </View>
                  </View>
                </View>
              )}
            </View>

            {isCloud && buildId && convexBuild ? (
              <BuildVisualBoardMobile
                buildId={buildId}
                userId={userId}
                linkedItems={visualLinked}
                onPressLinkCloset={() =>
                  router.push({
                    pathname: "/build-link-items",
                    params: { buildId: id! },
                  } as unknown as Parameters<typeof router.push>[0])
                }
              />
            ) : null}

            {(build.budgetCents != null || linkedItems.length > 0) && (
              <View className="px-6 mb-8 mt-2">
                <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-4">
                  {build.budgetCents != null
                    ? t("BuildDetail.budgetTracker")
                    : t("BuildDetail.linkedItemsCostTitle")}
                </Text>
                {build.budgetCents != null ? (
                  <View className="gap-2">
                    <View className="flex-row justify-between">
                      <Text className="text-sm font-medium text-black">
                        {t("BuildDetail.spent")} {formatCents(totalCostCents)}
                      </Text>
                      <Text className="text-sm font-medium text-black">
                        {t("BuildDetail.budgetLabel")} {formatCents(build.budgetCents)}
                      </Text>
                    </View>
                    <View className="h-0.5 bg-[#eeeeee] w-full">
                      <View
                        className="h-full bg-black"
                        style={{
                          width: `${Math.min(100, (totalCostCents / (build.budgetCents || 1)) * 100)}%`,
                        }}
                      />
                    </View>
                    {totalCostCents > (build.budgetCents || 0) && (
                      <Text className="text-xs text-red-600 mt-1">
                        {t("BuildDetail.overBudget", {
                          amount: formatCents(totalCostCents - (build.budgetCents || 0)),
                        })}
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text className="text-sm font-medium text-black">
                    {t("BuildDetail.itemsTotal")} {formatCents(totalCostCents)}
                  </Text>
                )}
              </View>
            )}

            {convexBuild && buildId && (convexBuild.visibility ?? "private") !== "private" ? (
              <BuildSocialSection
                buildId={buildId}
                userId={userId}
                visibility={convexBuild.visibility as string | undefined}
              />
            ) : null}

            <BuildDetailCloudSections
              buildId={buildId}
              userId={userId}
              convexBuild={convexBuild ?? undefined}
              isOwner={!!userId && !!convexBuild && convexBuild.userId === userId}
            />

            <View className="px-6 mb-8">
              <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-4">
                {t("BuildDetail.tasksSection")}
              </Text>
              <View className="flex-row gap-3 mb-4">
                <TextInput
                  className="flex-1 border-b border-black/10 py-2.5 text-sm text-black"
                  value={newTaskLabel}
                  onChangeText={setNewTaskLabel}
                  placeholder={t("BuildDetail.taskPlaceholder")}
                  placeholderTextColor="rgba(0,0,0,0.4)"
                />
                <Pressable
                  className="border border-black py-2.5 px-4 justify-center"
                  onPress={onAddTask}
                >
                  <Text className="text-[10px] font-semibold tracking-[0.2em] text-black">
                    {t("BuildDetail.add")}
                  </Text>
                </Pressable>
              </View>
              {tasks.map((t) => {
                const linkedItem = linkedItems.find((item) => item.id === t.closetItemId);
                return (
                  <View key={t.id} className="flex-row items-center border-b border-black/5">
                    <Pressable
                      className="flex-1 flex-row items-center gap-3 py-3"
                      onPress={() => onToggleTask(t.id)}
                    >
                      <View
                        className={`w-[18px] h-[18px] border items-center justify-center ${t.checked ? "bg-black border-black" : "border-black/10"}`}
                      >
                        {t.checked && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                      <View className="flex-1">
                        <Text
                          className={`text-sm text-black ${t.checked ? "line-through text-black/40" : ""}`}
                        >
                          {t.label}
                        </Text>
                        {linkedItem && (
                          <Text className="text-xs text-black/40 italic mt-0.5">
                            → {linkedItem.name}
                          </Text>
                        )}
                      </View>
                    </Pressable>
                    <Pressable className="p-3" onPress={() => onLongPressTask(t.id)}>
                      <Ionicons name="link-outline" size={18} color="rgba(0,0,0,0.6)" />
                    </Pressable>
                    <Pressable className="p-3" onPress={() => onDeleteTask(t.id)}>
                      <Ionicons name="trash-outline" size={18} color="rgba(0,0,0,0.6)" />
                    </Pressable>
                  </View>
                );
              })}
            </View>

            <View className="px-6 mb-8">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
                  {t("BuildDetail.associatedCloset", { count: linkedItems.length })}
                </Text>
                <Pressable
                  className="border border-black py-2.5 px-3 rounded-full"
                  onPress={() =>
                    router.push({
                      pathname: "/build-link-items",
                      params: { buildId: id! },
                    })
                  }
                >
                  <Text className="text-[10px] font-semibold uppercase tracking-[0.2em] text-black">
                    LINK ITEMS
                  </Text>
                </Pressable>
              </View>
              {linkedItems.length === 0 && (
                <Text className="text-xs text-black/40 mt-2">{t("BuildDetail.noLinkedItems")}</Text>
              )}
              <View className="flex-row flex-wrap justify-between mt-4">
                {linkedItems.map((item) => (
                  <View key={item.id} className="w-[48%] mb-4 gap-2">
                    <ImageCard
                      imageUrl={item.imageUrl}
                      title={item.name}
                      subtitle={`${item.category}${item.costCents != null ? ` · ${formatCents(item.costCents)}` : ""}`}
                      aspectRatio={1}
                    />
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <BottomSheetModal
        ref={assignSheetRef}
        index={0}
        snapPoints={["50%"]}
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: "#FFFFFF", borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: "rgba(0,0,0,0.1)", width: 40, height: 4 }}
      >
        <View className="bg-white rounded-t-2xl pb-10 max-h-[70%]">
          <View className="flex-row justify-between items-center p-5 border-b border-black/5">
            <Text className="text-lg font-semibold text-black">
              {t("BuildDetail.assignTaskTitle")}
            </Text>
            <Pressable onPress={() => assignSheetRef.current?.dismiss()}>
              <Ionicons name="close" size={24} color="#000" />
            </Pressable>
          </View>
          <BottomSheetScrollView contentContainerStyle={{ padding: 20 }}>
            {selectedTaskId && (
              <Pressable
                className="flex-row items-center gap-3 py-3 border-b border-black/5"
                onPress={() => onAssignTask(null)}
              >
                <Ionicons name="close-circle-outline" size={20} color="rgba(0,0,0,0.6)" />
                <Text className="text-base text-black flex-1">{t("BuildDetail.unassign")}</Text>
              </Pressable>
            )}
            {linkedItems.map((item) => (
              <Pressable
                key={item.id}
                className="flex-row items-center gap-3 py-3 border-b border-black/5"
                onPress={() => onAssignTask(item.id)}
              >
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    className="w-10 h-10 rounded"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-10 h-10 rounded bg-[#F9F9F9] justify-center items-center">
                    <Ionicons name="image-outline" size={16} color="rgba(0,0,0,0.4)" />
                  </View>
                )}
                <Text className="text-base text-black flex-1">{item.name}</Text>
              </Pressable>
            ))}
            {linkedItems.length === 0 && (
              <Text className="text-sm text-black/40 text-center py-5">
                {t("BuildDetail.assignTaskEmpty")}
              </Text>
            )}
          </BottomSheetScrollView>
        </View>
      </BottomSheetModal>
    </View>
  );
}
