import { useLayoutEffect, useMemo, useState } from "react";
import { Alert, FlatList, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard } from "@/ui";

type BuildRow = Doc<"builds">;

type LinkBuildReady = {
  rows: BuildRow[];
  linkedIds: Set<string>;
  userId: string;
  cosplayNodeId: Id<"cosplayNodes">;
};

export default function ElementLinkBuildScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const router = useRouter();

  useLayoutEffect(() => {
    navigation.setOptions({ title: t("elements.linkBuildTitle") });
  }, [navigation, t]);

  const raw = useLocalSearchParams<{ cosplayNodeId: string | string[] }>().cosplayNodeId;
  const param = Array.isArray(raw) ? raw[0] : raw;
  const cosplayNodeId = param ? (param as Id<"cosplayNodes">) : undefined;

  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const builds = useQuery(
    api.builds.list,
    userId ? { userId, sortBy: "name", order: "asc" } : "skip"
  );
  const linkedBuilds = useQuery(
    api.builds.getBuildsUsingNode,
    cosplayNodeId ? { cosplayNodeId } : "skip"
  );
  const addNodesToBuild = useMutation(api.builds.addNodesToBuild);

  const loading =
    identity === undefined ||
    (userId != null &&
      (builds === undefined || (cosplayNodeId != null && linkedBuilds === undefined)));
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!cosplayNodeId || !userId) status = "empty";
  else status = "ready";

  const data: LinkBuildReady | undefined =
    status === "ready" && cosplayNodeId && userId
      ? {
          rows: (builds ?? []) as BuildRow[],
          linkedIds: new Set((linkedBuilds ?? []).map((row) => row._id as string)),
          userId,
          cosplayNodeId,
        }
      : undefined;

  return (
    <DataBoundary<LinkBuildReady> status={status} data={data} error={error}>
      {(loaded) => (
        <LinkBuildBody
          loaded={loaded}
          addNodesToBuild={addNodesToBuild}
          onPicked={() => router.back()}
        />
      )}
    </DataBoundary>
  );
}

function LinkBuildBody({
  loaded,
  addNodesToBuild,
  onPicked,
}: {
  loaded: LinkBuildReady;
  addNodesToBuild: (args: {
    userId: string;
    buildId: Id<"builds">;
    cosplayNodeIds: Id<"cosplayNodes">[];
  }) => Promise<unknown>;
  onPicked: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useDesignTheme();
  const [search, setSearch] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const { rows, userId, cosplayNodeId, linkedIds } = loaded;

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!needle) return true;
      return (
        row.name.toLowerCase().includes(needle) ||
        (row.character ?? "").toLowerCase().includes(needle) ||
        row.status.toLowerCase().includes(needle)
      );
    });
  }, [rows, search]);

  return (
    <View className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg">
      <View className="px-5 pb-3 pt-4">
        <SectionHeading title={t("elements.linkBuildTitle")} />

        <SurfaceCard className="mt-4 px-4 py-4">
          <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("elements.linkBuildSubtitle")}
          </Text>

          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("elements.linkBuildSearchPlaceholder")}
            placeholderTextColor={colors.textTertiary}
            className="mt-4 rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
          />
        </SurfaceCard>
      </View>

      <FlatList
        className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 132,
          gap: 12,
        }}
        ListHeaderComponent={
          <Text className="pb-3 text-[10px] font-bold uppercase tracking-meta text-kyar-meta dark:text-kyar-dark-meta">
            {filtered.length} {filtered.length === 1 ? "outfit" : "outfits"}
          </Text>
        }
        ListEmptyComponent={
          <Text className="py-12 text-center text-kyar-meta dark:text-kyar-dark-meta">
            {search.trim() ? t("builds.emptySearch") : t("elements.linkBuildEmpty")}
          </Text>
        }
        renderItem={({ item }) => {
          const linked = linkedIds.has(item._id as string);
          return (
            <SurfaceCard className="mb-3 overflow-hidden">
              <View className="flex-row items-center gap-3 px-4 py-4">
                {item.imageStorageId || item.imageUrl ? (
                  <ConvexStorageImage
                    storageId={item.imageStorageId}
                    imageUrl={item.imageUrl}
                    className="h-20 w-20 rounded-2xl"
                    accessibilityLabel={item.name}
                  />
                ) : (
                  <View className="h-20 w-20 items-center justify-center rounded-2xl bg-kyar-panel dark:bg-kyar-dark-panel">
                    <Text className="text-3xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                      ✦
                    </Text>
                  </View>
                )}

                <View className="min-w-0 flex-1">
                  <MetaLabel>{item.status}</MetaLabel>
                  <Text
                    className="mt-1 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text"
                    numberOfLines={1}
                  >
                    {item.name}
                  </Text>
                  {item.character ? (
                    <Text
                      className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                      numberOfLines={1}
                    >
                      {item.character}
                    </Text>
                  ) : null}
                </View>

                <Button
                  title={
                    linked
                      ? t("elements.linkAlreadyLinked")
                      : pendingId === (item._id as string)
                        ? t("elements.linkingAction")
                        : t("elements.linkAddAction")
                  }
                  variant={linked ? "secondary" : "primary"}
                  loading={pendingId === (item._id as string)}
                  disabled={linked || pendingId !== null}
                  onPress={() => {
                    setPendingId(item._id as string);
                    void addNodesToBuild({
                      userId,
                      buildId: item._id,
                      cosplayNodeIds: [cosplayNodeId],
                    })
                      .then(onPicked)
                      .catch((error) => {
                        Alert.alert(
                          t("common.errorTitle"),
                          String(error instanceof Error ? error.message : error)
                        );
                      })
                      .finally(() => setPendingId(null));
                  }}
                />
              </View>
            </SurfaceCard>
          );
        }}
      />
    </View>
  );
}
