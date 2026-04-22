import { useLayoutEffect } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { DataBoundary } from "@/ui";

type BuildRow = Doc<"builds">;

type LinkBuildReady = {
  rows: BuildRow[];
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

  const addNodesToBuild = useMutation(api.builds.addNodesToBuild);

  const loading = identity === undefined || (userId != null && builds === undefined);
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!cosplayNodeId || !userId) status = "empty";
  else status = "ready";

  const data: LinkBuildReady | undefined =
    status === "ready" && cosplayNodeId && userId
      ? { rows: (builds ?? []) as BuildRow[], userId, cosplayNodeId }
      : undefined;

  return (
    <DataBoundary<LinkBuildReady> status={status} data={data} error={error}>
      {(loaded) => (
        <LinkBuildBody
          loaded={loaded}
          addNodesToBuild={addNodesToBuild}
          onPicked={() => router.back()}
          t={t}
        />
      )}
    </DataBoundary>
  );
}

function LinkBuildBody({
  loaded,
  addNodesToBuild,
  onPicked,
  t,
}: {
  loaded: LinkBuildReady;
  addNodesToBuild: (args: {
    userId: string;
    buildId: Id<"builds">;
    cosplayNodeIds: Id<"cosplayNodes">[];
  }) => Promise<unknown>;
  onPicked: () => void;
  t: (key: string) => string;
}) {
  const { rows, userId, cosplayNodeId } = loaded;

  return (
    <View className="flex-1 bg-white px-4 pt-2">
      <Text className="text-sm text-neutral-500">{t("elements.linkBuildSubtitle")}</Text>
      <FlatList
        className="mt-4"
        data={rows}
        keyExtractor={(item) => item._id}
        ItemSeparatorComponent={() => <View className="h-px bg-neutral-100" />}
        renderItem={({ item }) => (
          <Pressable
            className="py-4"
            onPress={() => {
              void (async () => {
                await addNodesToBuild({
                  userId,
                  buildId: item._id,
                  cosplayNodeIds: [cosplayNodeId],
                });
                onPicked();
              })();
            }}
          >
            <Text className="text-base font-medium text-neutral-900">{item.name}</Text>
            {item.character ? (
              <Text className="mt-0.5 text-sm text-neutral-500">{item.character}</Text>
            ) : null}
          </Pressable>
        )}
        ListEmptyComponent={
          <Text className="py-8 text-center text-neutral-500">{t("elements.linkBuildEmpty")}</Text>
        }
      />
    </View>
  );
}
