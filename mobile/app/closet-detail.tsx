import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useMutation } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import {
  CLOSET_CATEGORIES,
  CLOSET_ITEM_STATUSES,
  type ClosetCategory,
  type ClosetItemStatus,
} from "@kyarafit/design-system/types";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import { getById, upsertItem, deleteItem as deleteLocalItem } from "../src/storage/closetRepo";
import type { ClosetItem } from "@kyarafit/design-system/types";
import { ScreenHeader, SectionCard, StorageImage, KyarIcon } from "../src/components/shared";
import { Button } from "../src/components/ui/Button";
import { colors } from "@kyarafit/design-system/rn";
import { postToConvexUpload } from "../src/lib/convexUpload";
import { useTranslation } from "react-i18next";

function formatCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export default function ClosetDetailScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string }>();
  const id =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const router = useRouter();
  const { userId } = useCurrentUser();

  const itemId = id as Id<"closetItems"> | undefined;
  const cloudItem = useQuery(api.closetItems.get, userId && itemId ? { id: itemId } : "skip");
  const buildsUsing =
    useQuery(
      api.builds.getBuildsUsingClosetItem,
      userId && itemId ? { closetItemId: itemId } : "skip"
    ) ?? [];
  const tasksAssigned =
    useQuery(
      api.buildTasks.listByClosetItem,
      userId && itemId ? { closetItemId: itemId } : "skip"
    ) ?? [];
  const allBuilds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];

  const updateItem = useMutation(api.closetItems.update);
  const removeItem = useMutation(api.closetItems.remove);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const createTask = useMutation(api.buildTasks.create);
  const updateTask = useMutation(api.buildTasks.update);
  const deleteTask = useMutation(api.buildTasks.remove);
  const addItemsToBuild = useMutation(api.builds.addItemsToBuild);
  const removeItemFromBuild = useMutation(api.builds.removeItemFromBuild);

  const [localItem, setLocalItem] = useState<ClosetItem | null>(null);
  const [localLoaded, setLocalLoaded] = useState(false);

  const isCloud = !!userId;

  useFocusEffect(
    useCallback(() => {
      if (!id || isCloud) {
        if (!isCloud) setLocalLoaded(false);
        return;
      }
      (async () => {
        const row = await getById(id);
        setLocalItem(row);
        setLocalLoaded(true);
      })();
    }, [id, isCloud])
  );

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClosetCategory>("other");
  const [tagsStr, setTagsStr] = useState("");
  const [notes, setNotes] = useState("");
  const [costDollars, setCostDollars] = useState("");
  const [status, setStatus] = useState<ClosetItemStatus>("planned");
  const [itemLink, setItemLink] = useState("");
  const [savePending, setSavePending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newTaskLabel, setNewTaskLabel] = useState("");
  const [taskBusy, setTaskBusy] = useState(false);
  const [addToBuildOpen, setAddToBuildOpen] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);

  const item = isCloud ? cloudItem : localItem;

  useEffect(() => {
    if (item && editing && isCloud && cloudItem) {
      setName(cloudItem.name);
      setCategory((cloudItem.category as ClosetCategory) ?? "other");
      setTagsStr((cloudItem.tags ?? []).join(", "));
      setNotes(cloudItem.notes ?? "");
      setCostDollars(cloudItem.costCents != null ? (cloudItem.costCents / 100).toFixed(2) : "");
      setStatus(
        cloudItem.status && CLOSET_ITEM_STATUSES.includes(cloudItem.status as ClosetItemStatus)
          ? (cloudItem.status as ClosetItemStatus)
          : "planned"
      );
      setItemLink((cloudItem as { itemLink?: string | null }).itemLink ?? "");
    }
    if (item && editing && !isCloud && localItem) {
      setName(localItem.name);
      setCategory(localItem.category);
      setNotes(localItem.notes ?? "");
    }
  }, [item, editing, isCloud, cloudItem, localItem]);

  const loaded = isCloud ? cloudItem !== undefined : localLoaded;

  const pickImage = async () => {
    if (!userId || !itemId) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission", "Photo library access is needed.");
      return;
    }
    setUploading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const res = await fetch(asset.uri);
      const buf = await res.arrayBuffer();
      const uploadUrl = await generateUploadUrl();
      const storageId = await postToConvexUpload(uploadUrl, buf, asset.mimeType ?? "image/jpeg");
      await updateItem({
        id: itemId,
        userId,
        imageStorageId: storageId,
      });
    } catch (e) {
      Alert.alert(
        t("Common.uploadFailed"),
        e instanceof Error ? e.message : t("Common.unknownError")
      );
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!itemId || !name.trim()) return;
    if (isCloud && !userId) return;
    setSavePending(true);
    try {
      if (isCloud) {
        const tags = tagsStr
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        await updateItem({
          id: itemId,
          userId,
          name: name.trim(),
          category,
          tags,
          notes: notes.trim() || undefined,
          costCents: costDollars.trim() ? Math.round(parseFloat(costDollars) * 100) : undefined,
          status,
          itemLink: itemLink.trim() || null,
        });
      } else if (localItem) {
        const next: ClosetItem = {
          ...localItem,
          name: name.trim(),
          category,
          notes: notes.trim() || undefined,
          updatedAt: new Date().toISOString(),
        };
        await upsertItem(next);
        setLocalItem(next);
      }
      setEditing(false);
    } finally {
      setSavePending(false);
    }
  };

  const onDelete = () => {
    if (!itemId || !userId) return;
    Alert.alert("Remove item", "Remove this closet item?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          if (isCloud && userId) {
            await removeItem({ id: itemId, userId });
          } else if (id) {
            await deleteLocalItem(id);
          }
          router.back();
        },
      },
    ]);
  };

  const onAddTask = async () => {
    if (!newTaskLabel.trim() || !itemId || !userId) return;
    setTaskBusy(true);
    try {
      await createTask({
        userId,
        closetItemId: itemId,
        label: newTaskLabel.trim(),
      });
      setNewTaskLabel("");
    } finally {
      setTaskBusy(false);
    }
  };

  const onAddToBuild = async (buildId: Id<"builds">) => {
    if (!itemId || !userId) return;
    setLinkBusy(true);
    try {
      await addItemsToBuild({
        userId,
        buildId,
        closetItemIds: [itemId],
      });
      setAddToBuildOpen(false);
    } catch (e) {
      Alert.alert(t("Common.error"), e instanceof Error ? e.message : t("Common.couldNotLoad"));
    } finally {
      setLinkBusy(false);
    }
  };

  const onRemoveFromBuild = async (buildId: Id<"builds">) => {
    if (!itemId || !userId) return;
    Alert.alert("Remove from outfit?", "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await removeItemFromBuild({ userId, buildId, closetItemId: itemId });
        },
      },
    ]);
  };

  if (!id) {
    return (
      <View className="flex-1 bg-white justify-center px-6">
        <Text className="text-sm text-black/50">{t("ClosetDetail.missingId")}</Text>
      </View>
    );
  }

  if (!loaded) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (!item) {
    return (
      <View className="flex-1 bg-white">
        <ScreenHeader title="Not found" onBack={() => router.back()} />
        <Text className="px-6 mt-4 text-sm text-black/50">This item could not be loaded.</Text>
      </View>
    );
  }

  const imageStorageId = isCloud && cloudItem ? cloudItem.imageStorageId : undefined;
  const imageUrl = item.imageUrl ?? (isCloud && cloudItem ? cloudItem.imageUrl : undefined);
  const usingIds = new Set(buildsUsing.map((b) => b._id));
  const buildsToAdd = allBuilds.filter((b) => !usingIds.has(b._id));

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        meta={t("ClosetDetail.meta")}
        title={item.name}
        onBack={() => router.back()}
        trailing={
          isCloud && userId ? (
            <Pressable
              onPress={() => (editing ? setEditing(false) : setEditing(true))}
              hitSlop={12}
            >
              <Text className="text-[10px] uppercase tracking-[0.2em] font-semibold text-black">
                {editing ? t("Common.close") : t("Common.edit")}
              </Text>
            </Pressable>
          ) : null
        }
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
        <View className="px-6 mb-6">
          <View className="aspect-[3/4] rounded-2xl overflow-hidden bg-[#F9F9F9]">
            {isCloud ? (
              <StorageImage
                imageStorageId={imageStorageId ?? null}
                imageUrl={imageUrl ?? null}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : item.imageUrl || (item as ClosetItem).imageLocalUri ? (
              <Image
                source={{ uri: (item as ClosetItem).imageLocalUri || item.imageUrl }}
                className="w-full h-full"
                resizeMode="cover"
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <KyarIcon name="checkroom" size={48} color={colors.textTertiary} />
              </View>
            )}
          </View>
          {isCloud && userId && editing ? (
            <Pressable
              className="mt-3 border border-black py-2.5 items-center rounded-full"
              onPress={pickImage}
              disabled={uploading}
            >
              <Text className="text-[10px] uppercase tracking-widest font-semibold text-black">
                {uploading ? t("ClosetDetail.uploading") : t("ClosetDetail.changePhoto")}
              </Text>
            </Pressable>
          ) : null}
        </View>

        {editing && isCloud ? (
          <View className="px-6 gap-4 mb-6">
            <View>
              <Text className="text-[9px] uppercase tracking-[0.2em] text-black/50 mb-2">
                {t("ClosetDetail.name")}
              </Text>
              <TextInput
                className="border-b border-black/10 py-2 text-base text-black"
                value={name}
                onChangeText={setName}
              />
            </View>
            <View>
              <Text className="text-[9px] uppercase tracking-[0.2em] text-black/50 mb-2">
                {t("ClosetDetail.category")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-2">
                  {CLOSET_CATEGORIES.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCategory(c)}
                      className={`px-3 py-2 border rounded-full ${category === c ? "border-black bg-black/5" : "border-black/10"}`}
                    >
                      <Text className="text-xs capitalize text-black">{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View>
              <Text className="text-[9px] uppercase tracking-[0.2em] text-black/50 mb-2">
                {t("ClosetDetail.tags")}
              </Text>
              <TextInput
                className="border border-black/10 rounded-md p-3 text-sm text-black"
                value={tagsStr}
                onChangeText={setTagsStr}
                placeholder="comma, separated, tags"
                placeholderTextColor="rgba(0,0,0,0.35)"
              />
            </View>
            <View>
              <Text className="text-[9px] uppercase tracking-[0.2em] text-black/50 mb-2">
                Status
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {CLOSET_ITEM_STATUSES.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setStatus(s)}
                    className={`px-3 py-2 border rounded-full ${status === s ? "border-black bg-black/5" : "border-black/10"}`}
                  >
                    <Text className="text-xs text-black">{s.replace("_", " ")}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <View>
              <Text className="text-[9px] uppercase tracking-[0.2em] text-black/50 mb-2">
                {t("ClosetDetail.costUsd")}
              </Text>
              <TextInput
                className="border-b border-black/10 py-2 text-base text-black"
                value={costDollars}
                onChangeText={setCostDollars}
                keyboardType="decimal-pad"
                placeholder="0.00"
              />
            </View>
            <View>
              <Text className="text-[9px] uppercase tracking-[0.2em] text-black/50 mb-2">
                {t("ClosetDetail.itemLink")}
              </Text>
              <TextInput
                className="border-b border-black/10 py-2 text-sm text-black"
                value={itemLink}
                onChangeText={setItemLink}
                placeholder={t("ClosetDetail.linkPlaceholder")}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
            <View>
              <Text className="text-[9px] uppercase tracking-[0.2em] text-black/50 mb-2">
                {t("ClosetDetail.notes")}
              </Text>
              <TextInput
                className="border border-black/10 rounded-md p-3 text-sm text-black min-h-[100px]"
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>
            <Button variant="primary" onPress={onSave} disabled={savePending || !name.trim()}>
              {savePending ? t("Common.saving") : t("ClosetDetail.saveChanges")}
            </Button>
            <Pressable onPress={onDelete}>
              <Text className="text-center text-sm text-red-600">
                {t("ClosetDetail.removeFromCloset")}
              </Text>
            </Pressable>
          </View>
        ) : editing && !isCloud ? (
          <View className="px-6 gap-4 mb-6">
            <View>
              <Text className="text-[9px] uppercase tracking-[0.2em] text-black/50 mb-2">
                {t("ClosetDetail.name")}
              </Text>
              <TextInput
                className="border-b border-black/10 py-2 text-base text-black"
                value={name}
                onChangeText={setName}
              />
            </View>
            <View>
              <Text className="text-[9px] uppercase tracking-[0.2em] text-black/50 mb-2">
                {t("ClosetDetail.category")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row flex-wrap gap-2">
                  {CLOSET_CATEGORIES.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCategory(c)}
                      className={`px-3 py-2 border rounded-full ${category === c ? "border-black bg-black/5" : "border-black/10"}`}
                    >
                      <Text className="text-xs capitalize text-black">{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
            <View>
              <Text className="text-[9px] uppercase tracking-[0.2em] text-black/50 mb-2">
                {t("ClosetDetail.notes")}
              </Text>
              <TextInput
                className="border border-black/10 rounded-md p-3 text-sm text-black min-h-[100px]"
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>
            <Button variant="primary" onPress={onSave} disabled={savePending || !name.trim()}>
              {savePending ? t("Common.saving") : t("ClosetDetail.saveChanges")}
            </Button>
            <Pressable onPress={onDelete}>
              <Text className="text-center text-sm text-red-600">
                {t("ClosetDetail.removeFromCloset")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View className="px-6 mb-6">
              <Text className="text-[10px] uppercase tracking-widest text-black/40 mb-1">
                {String(cloudItem?.category ?? item.category)}
              </Text>
              {isCloud && cloudItem?.tags && cloudItem.tags.length > 0 ? (
                <Text className="text-sm text-black/60 mb-2">{cloudItem.tags.join(" · ")}</Text>
              ) : null}
              {isCloud && cloudItem?.status ? (
                <Text className="text-[10px] uppercase tracking-widest text-black/45 mb-2">
                  {String(cloudItem.status).replace("_", " ")}
                </Text>
              ) : null}
              {item.notes ? (
                <Text className="text-base text-black/80 leading-relaxed">{item.notes}</Text>
              ) : (
                <Text className="text-sm text-black/40">{t("ClosetDetail.noNotes")}</Text>
              )}
              {item.costCents != null ? (
                <Text className="mt-4 text-sm font-medium text-black">
                  {formatCents(item.costCents)}
                </Text>
              ) : null}
              {isCloud && (cloudItem as { itemLink?: string | null })?.itemLink ? (
                <Pressable
                  className="mt-4"
                  onPress={() => {
                    const u = (cloudItem as { itemLink?: string }).itemLink;
                    if (u) Linking.openURL(u.startsWith("http") ? u : `https://${u}`);
                  }}
                >
                  <Text className="text-sm text-black underline">
                    {t("ClosetDetail.openItemLink")}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {isCloud && userId && itemId ? (
              <View className="px-6 mb-6">
                <SectionCard title={t("ClosetDetail.tasksTitle")}>
                  <View className="flex-row gap-2 mb-3">
                    <TextInput
                      className="flex-1 border border-black/10 rounded-md px-3 py-2 text-sm text-black"
                      value={newTaskLabel}
                      onChangeText={setNewTaskLabel}
                      placeholder={t("ClosetDetail.newTaskPlaceholder")}
                      placeholderTextColor="rgba(0,0,0,0.35)"
                    />
                    <Pressable
                      className="border border-black px-3 justify-center rounded-md"
                      onPress={onAddTask}
                      disabled={taskBusy}
                    >
                      <Text className="text-[10px] uppercase font-bold text-black">
                        {t("Common.add")}
                      </Text>
                    </Pressable>
                  </View>
                  {tasksAssigned.map((task) => (
                    <View
                      key={task._id}
                      className="flex-row items-center py-2 border-b border-black/5"
                    >
                      <Pressable
                        className="flex-1"
                        onPress={() =>
                          task.buildId &&
                          updateTask({ id: task._id, userId, checked: !task.checked })
                        }
                      >
                        <Text
                          className={`text-sm ${task.checked ? "text-black/40 line-through" : "text-black"}`}
                        >
                          {task.label}
                        </Text>
                        {task.buildName ? (
                          <Text className="text-[10px] text-black/40">{task.buildName}</Text>
                        ) : null}
                      </Pressable>
                      <Pressable
                        onPress={() =>
                          Alert.alert(t("ClosetDetail.deleteTaskTitle"), "", [
                            { text: t("Common.cancel"), style: "cancel" },
                            {
                              text: t("Common.delete"),
                              style: "destructive",
                              onPress: () => deleteTask({ id: task._id, userId }),
                            },
                          ])
                        }
                      >
                        <Text className="text-[10px] text-red-600">{t("Common.remove")}</Text>
                      </Pressable>
                    </View>
                  ))}
                  {tasksAssigned.length === 0 ? (
                    <Text className="text-sm text-black/40">{t("ClosetDetail.noTasksYet")}</Text>
                  ) : null}
                </SectionCard>
              </View>
            ) : null}

            {isCloud && userId ? (
              <View className="px-6 mb-6">
                <View className="flex-row justify-between items-center mb-3">
                  <Text className="font-serif text-lg italic text-black">
                    {t("ClosetDetail.outfitsTitle")}
                  </Text>
                  <Pressable onPress={() => setAddToBuildOpen(true)}>
                    <Text className="text-[10px] uppercase tracking-widest font-bold text-black">
                      {t("ClosetDetail.addToOutfit")}
                    </Text>
                  </Pressable>
                </View>
                {buildsUsing.length === 0 ? (
                  <Text className="text-sm text-black/40 mb-2">Not linked to an outfit yet.</Text>
                ) : (
                  buildsUsing.map((b) => (
                    <View
                      key={b._id}
                      className="flex-row items-center py-3 border-b border-black/5"
                    >
                      <Pressable
                        className="flex-1"
                        onPress={() =>
                          router.push({
                            pathname: "/build-detail",
                            params: { id: b._id },
                          } as unknown as Parameters<typeof router.push>[0])
                        }
                      >
                        <Text className="font-serif text-lg italic text-black">{b.name}</Text>
                      </Pressable>
                      <Pressable onPress={() => onRemoveFromBuild(b._id)}>
                        <Text className="text-[10px] text-red-600">Remove</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      <Modal visible={addToBuildOpen} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/40 justify-end"
          onPress={() => setAddToBuildOpen(false)}
        >
          <Pressable
            className="bg-white rounded-t-3xl p-6 max-h-[70%]"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="font-serif text-xl italic mb-4">
              {t("ClosetDetail.addToOutfitModal")}
            </Text>
            <ScrollView>
              {buildsToAdd.length === 0 ? (
                <Text className="text-sm text-black/45">
                  {t("ClosetDetail.allOutfitsHaveItem")}
                </Text>
              ) : (
                buildsToAdd.map((b) => (
                  <Pressable
                    key={b._id}
                    className="py-3 border-b border-black/5"
                    disabled={linkBusy}
                    onPress={() => onAddToBuild(b._id)}
                  >
                    <Text className="text-base text-black">{b.name}</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
            <Pressable className="mt-4 items-center" onPress={() => setAddToBuildOpen(false)}>
              <Text className="text-[10px] uppercase text-black/50">{t("Common.cancel")}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
