import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { DataBoundary } from "@/ui";

export default function LinkElementsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const raw = useLocalSearchParams<{ buildId: string | string[] }>().buildId;
  const buildIdParam = Array.isArray(raw) ? raw[0] : raw;
  const buildId = buildIdParam ? (buildIdParam as Id<"builds">) : undefined;

  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const build = useQuery(api.builds.get, buildId ? { id: buildId } : "skip");
  const linkedIds = useQuery(api.builds.getNodes, buildId ? { buildId } : "skip");
  const catalog = useQuery(
    api.cosplayNodes.list,
    userId && buildId ? { userId, buildId, sortBy: "name" } : "skip"
  );

  const linkNodes = useMutation(api.builds.linkNodes);

  const loading =
    identity === undefined ||
    (buildId != null &&
      (build === undefined || catalog === undefined || linkedIds === undefined));
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!buildId || !userId || build === null) status = "empty";
  else status = "ready";

  type Ready = {
    buildId: Id<"builds">;
    userId: string;
    rows: NonNullable<typeof catalog>;
    initialLinked: Id<"cosplayNodes">[];
  };

  const data: Ready | undefined =
    status === "ready" && catalog && linkedIds !== undefined && buildId && userId
      ? { buildId, userId, rows: catalog, initialLinked: linkedIds }
      : undefined;

  return (
    <DataBoundary<Ready> status={status} data={data} error={error}>
      {(loaded) => (
        <LinkElementsBody
          loaded={loaded}
          linkNodes={linkNodes}
          onDone={() => router.back()}
          t={t}
        />
      )}
    </DataBoundary>
  );
}

function LinkElementsBody({
  loaded,
  linkNodes,
  onDone,
  t,
}: {
  loaded: {
    buildId: Id<"builds">;
    userId: string;
    rows: { _id: Id<"cosplayNodes">; name: string; nodeType?: string }[];
    initialLinked: Id<"cosplayNodes">[];
  };
  linkNodes: (a: {
    userId: string;
    buildId: Id<"builds">;
    cosplayNodeIds: Id<"cosplayNodes">[];
  }) => Promise<unknown>;
  onDone: () => void;
  t: (key: string) => string;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => {
    return new Set(loaded.initialLinked.map((x) => x as string));
  });

  const toggle = useCallback((id: Id<"cosplayNodes">) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = id as string;
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const save = useCallback(async () => {
    const ids = Array.from(selected) as Id<"cosplayNodes">[];
    await linkNodes({
      userId: loaded.userId,
      buildId: loaded.buildId,
      cosplayNodeIds: ids,
    });
    onDone();
  }, [linkNodes, loaded.buildId, loaded.userId, onDone, selected]);

  const sorted = useMemo(() => [...loaded.rows], [loaded.rows]);

  return (
    <View className="flex-1 bg-white px-4 pt-4">
      <Text className="text-base text-neutral-600">{t("linkElements.subtitle")}</Text>
      <FlatList
        className="mt-4 flex-1"
        data={sorted}
        keyExtractor={(item) => item._id as string}
        extraData={selected.size}
        renderItem={({ item }) => {
          const on = selected.has(item._id as string);
          return (
            <Pressable
              onPress={() => toggle(item._id)}
              className={`mb-2 rounded-xl border px-3 py-3 ${
                on ? "border-neutral-900 bg-neutral-900" : "border-neutral-200 bg-neutral-50"
              }`}
            >
              <Text className={`font-medium ${on ? "text-white" : "text-neutral-900"}`}>
                {item.name}
              </Text>
              {item.nodeType ? (
                <Text className={`mt-0.5 text-xs ${on ? "text-white/80" : "text-neutral-500"}`}>
                  {item.nodeType}
                </Text>
              ) : null}
            </Pressable>
          );
        }}
      />
      <Pressable
        onPress={() => void save()}
        className="mb-6 items-center rounded-xl bg-neutral-900 py-3 active:opacity-90"
      >
        <Text className="font-semibold text-white">{t("linkElements.save")}</Text>
      </Pressable>
    </View>
  );
}
