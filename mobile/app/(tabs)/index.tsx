import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";
import { useDataSource } from "../../src/hooks/useDataSource";
import { KyarIcon, MetaLabel, ScreenHeader, StorageImage } from "../../src/components/shared";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import { useTranslation } from "react-i18next";

function daysUntil(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

type FocusedBuild = {
  _id: Id<"builds">;
  name: string;
  character?: string;
  imageStorageId?: Id<"_storage">;
  imageUrl?: string;
  tasksChecked: number;
  tasksTotal: number;
};

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userQueryArgs } = useDataSource();
  const { userId } = useCurrentUser();

  const focusedBuildId = useQuery(
    api.users.getFocusedBuildId,
    userId ? { externalId: userId } : "skip"
  );
  const focusedOrRecent = useQuery(api.builds.getFocusedOrMostRecentForUser, userQueryArgs);
  const recentBuild = focusedOrRecent as FocusedBuild | null | undefined;

  const eventForBuild = useQuery(
    api.conventions.getEventForBuild,
    userId && recentBuild ? { buildId: recentBuild._id, userId } : "skip"
  );

  const upcomingWithCounts = useQuery(
    api.conventions.listUpcomingWithPlanCounts,
    userId ? { userId, limit: 10 } : "skip"
  );

  const builds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];

  const setFocusedBuild = useMutation(api.users.setFocusedBuild);

  const recentProjectsList = useMemo(() => {
    const excluded = recentBuild ? builds.filter((b) => b._id !== recentBuild._id) : [...builds];
    const withCreation = excluded as Array<(typeof builds)[number] & { _creationTime?: number }>;
    const sorted = [...withCreation].sort(
      (a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0)
    );
    return sorted.slice(0, 10);
  }, [builds, recentBuild]);

  const [focusModalOpen, setFocusModalOpen] = useState(false);
  const [focusSearch, setFocusSearch] = useState("");

  const filteredBuildsForFocus = useMemo(() => {
    const q = focusSearch.trim().toLowerCase();
    if (!q) return builds;
    return builds.filter(
      (b) => b.name.toLowerCase().includes(q) || (b.character ?? "").toLowerCase().includes(q)
    );
  }, [builds, focusSearch]);

  const openFocusModal = useCallback(() => {
    setFocusSearch("");
    setFocusModalOpen(true);
  }, []);

  const closeFocusModal = useCallback(() => setFocusModalOpen(false), []);

  const selectFocus = useCallback(
    async (buildId: Id<"builds"> | undefined) => {
      await setFocusedBuild({ buildId });
      closeFocusModal();
    },
    [setFocusedBuild, closeFocusModal]
  );

  const heroOpen = () => {
    if (recentBuild) {
      router.push({ pathname: "/build-detail", params: { id: recentBuild._id } });
    } else {
      router.push("/(tabs)/builds");
    }
  };

  const continueCta = recentBuild ? t("Home.continueEditing") : t("Home.viewBuilds");

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        meta={t("Home.metaBrand")}
        title={t("Home.theLookbook")}
        trailing={
          <Pressable
            onPress={() => router.push("/settings")}
            hitSlop={12}
            accessibilityLabel={t("Common.settings")}
          >
            <KyarIcon name="menu" size={24} color={colors.text} />
          </Pressable>
        }
        bottomPadding={24}
      />

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ paddingHorizontal: layout.screenPaddingX }}>
          {/* Hero — matches web: badge, title, items line, planned-for, progress */}
          <Pressable
            onPress={heroOpen}
            className="rounded-2xl overflow-hidden border border-black/5 bg-[#F9F9F9]"
            accessibilityRole="button"
          >
            <View style={{ aspectRatio: 4 / 5, width: "100%" }}>
              {recentBuild?.imageStorageId || recentBuild?.imageUrl ? (
                <StorageImage
                  imageStorageId={recentBuild.imageStorageId}
                  imageUrl={recentBuild.imageUrl}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                />
              ) : (
                <View className="flex-1 items-center justify-center bg-[#EAEAEA]">
                  <KyarIcon name="image" size={64} color={colors.textTertiary} />
                </View>
              )}
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.45)"]}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                }}
              />
              <View className="absolute bottom-0 left-0 right-0 p-5">
                <View className="self-start bg-black px-2.5 py-1 rounded-sm mb-2">
                  <Text className="text-[10px] uppercase tracking-[0.2em] text-white font-medium">
                    {t("Home.currentFocus")}
                  </Text>
                </View>
                <Text
                  className="text-white font-serif text-3xl italic"
                  style={{ fontFamily: font.family.serifElegant }}
                >
                  {recentBuild ? recentBuild.name : t("Home.addBuildsToFeature")}
                </Text>
                {recentBuild ? (
                  <>
                    <Text className="text-white/90 text-sm mt-1">
                      {t("Home.itemsComplete", {
                        checked: recentBuild.tasksChecked,
                        total: recentBuild.tasksTotal,
                      })}
                      {recentBuild.character ? ` · ${recentBuild.character}` : ""}
                    </Text>
                    {eventForBuild ? (
                      <Text className="text-white/80 text-[10px] uppercase tracking-wider mt-1">
                        {t("Home.plannedFor", { name: eventForBuild.name })}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            </View>
          </Pressable>

          {recentBuild && recentBuild.tasksTotal > 0 ? (
            <View className="bg-white px-4 py-3 border-t border-black/5">
              <View className="h-1.5 w-full bg-black/10 rounded-full overflow-hidden">
                <View
                  className="h-full bg-black rounded-full"
                  style={{
                    width: `${(100 * recentBuild.tasksChecked) / recentBuild.tasksTotal}%`,
                  }}
                />
              </View>
            </View>
          ) : null}

          <View className="mt-4 flex-row flex-wrap items-center justify-between gap-3">
            <View className="flex-1 min-w-[160px]">
              <Text className="text-[10px] uppercase tracking-widest text-black/45">
                {recentBuild ? t("Home.yourMostRecentBuild") : t("Home.createBuildToSee")}
              </Text>
              {builds.length > 0 ? (
                <Pressable onPress={openFocusModal} className="mt-1 self-start">
                  <Text className="text-[10px] font-semibold uppercase tracking-widest text-black underline">
                    {t("Home.selectFocus")}
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <Pressable
              onPress={() =>
                recentBuild
                  ? router.push({ pathname: "/build-detail", params: { id: recentBuild._id } })
                  : router.push("/(tabs)/builds")
              }
              className="border border-black px-4 py-2.5 rounded-sm min-h-[44px] justify-center"
            >
              <Text className="text-[10px] font-semibold uppercase tracking-widest text-black">
                {continueCta}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Upcoming events */}
        <View className="mt-10 pt-6 border-t border-black/5">
          <View
            className="flex-row items-center justify-between px-6 mb-4"
            style={{ paddingHorizontal: layout.screenPaddingX }}
          >
            <Text className="text-[11px] uppercase tracking-[0.2em] font-semibold text-black">
              {t("Home.upcomingEvents")}
            </Text>
            <Pressable onPress={() => router.push("/plan")} hitSlop={8}>
              <Text className="text-[10px] uppercase tracking-widest text-black/50 underline">
                {t("Home.viewAllEvents")}
              </Text>
            </Pressable>
          </View>
          {upcomingWithCounts && upcomingWithCounts.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: layout.screenPaddingX, gap: 16 }}
            >
              {upcomingWithCounts.map(({ convention, outfitCount }) => {
                const days = daysUntil(convention.startDate);
                const dayLabel =
                  days === 0
                    ? t("Home.today")
                    : days === 1
                      ? t("Home.tomorrow")
                      : t("Home.daysLeft", { count: days });
                const hasImage = convention.imageStorageId != null || convention.imageUrl != null;
                return (
                  <Pressable
                    key={convention._id}
                    onPress={() =>
                      router.push({
                        pathname: "/convention-detail",
                        params: { id: convention._id },
                      })
                    }
                    className="w-[240px] rounded-2xl overflow-hidden border border-black/10 bg-white"
                  >
                    <View style={{ height: 120, width: "100%" }}>
                      {hasImage ? (
                        <StorageImage
                          imageStorageId={convention.imageStorageId}
                          imageUrl={convention.imageUrl}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="flex-1 h-full items-center justify-center bg-[#EAEAEA]">
                          <KyarIcon name="calendar_today" size={40} color={colors.textTertiary} />
                        </View>
                      )}
                    </View>
                    <View className="p-4">
                      <Text className="text-[10px] uppercase tracking-widest text-black/45">
                        {convention.startDate === convention.endDate
                          ? convention.startDate
                          : `${convention.startDate} – ${convention.endDate}`}
                      </Text>
                      <Text
                        className="font-serif text-lg italic text-black mt-1"
                        style={{ fontFamily: font.family.serifElegant }}
                        numberOfLines={1}
                      >
                        {convention.name}
                      </Text>
                      <Text className="text-[10px] uppercase tracking-widest text-black/40 mt-3">
                        {dayLabel} · {t("Home.buildsPlanned", { count: outfitCount })}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View className="px-6" style={{ paddingHorizontal: layout.screenPaddingX }}>
              <Pressable onPress={() => router.push("/plan")}>
                <Text className="text-sm text-black/50 underline">{t("Home.viewAllEvents")}</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Current projects */}
        <View className="mt-10 pt-6 border-t border-black/5">
          <View
            className="flex-row items-center justify-between px-6 mb-4"
            style={{ paddingHorizontal: layout.screenPaddingX }}
          >
            <Text className="text-[11px] uppercase tracking-[0.2em] font-semibold text-black">
              {t("Home.currentProjects")}
            </Text>
            {recentProjectsList.length > 0 ? (
              <Pressable onPress={() => router.push("/(tabs)/builds")} hitSlop={8}>
                <Text className="text-[10px] uppercase tracking-widest text-black/50 underline">
                  {t("Home.viewAllBuilds")}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {recentProjectsList.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: layout.screenPaddingX, gap: 16 }}
            >
              {recentProjectsList.map((build) => {
                const hasImage = build.imageStorageId != null || build.imageUrl != null;
                return (
                  <Pressable
                    key={build._id}
                    onPress={() =>
                      router.push({ pathname: "/build-detail", params: { id: build._id } })
                    }
                    className="w-[180px] rounded-2xl overflow-hidden border border-black/10 bg-white"
                  >
                    <View style={{ height: 200, width: "100%" }}>
                      {hasImage ? (
                        <StorageImage
                          imageStorageId={build.imageStorageId}
                          imageUrl={build.imageUrl}
                          style={{ width: "100%", height: "100%" }}
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="flex-1 h-full items-center justify-center bg-[#EAEAEA]">
                          <KyarIcon name="image" size={40} color={colors.textTertiary} />
                        </View>
                      )}
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.65)"]}
                        style={{
                          position: "absolute",
                          left: 0,
                          right: 0,
                          bottom: 0,
                          top: "40%",
                        }}
                      />
                      <View className="absolute bottom-0 left-0 right-0 p-3">
                        <Text
                          className="text-white font-serif text-base italic leading-tight"
                          style={{ fontFamily: font.family.serifElegant }}
                          numberOfLines={2}
                        >
                          {build.name}
                        </Text>
                        <Text className="text-[10px] uppercase tracking-wider text-white/90 mt-1">
                          {build.tasksChecked} / {build.tasksTotal} tasks
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <View className="px-6" style={{ paddingHorizontal: layout.screenPaddingX }}>
              <Pressable onPress={() => router.push("/(tabs)/builds")}>
                <Text className="text-sm text-black/50 underline">{t("Home.viewAllBuilds")}</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={focusModalOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeFocusModal}
      >
        <KeyboardAvoidingView
          className="flex-1 bg-white"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={{ paddingTop: insets.top + 8, paddingHorizontal: layout.screenPaddingX }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text
                className="font-serif text-xl italic text-black flex-1"
                style={{ fontFamily: font.family.serifElegant }}
              >
                {t("Home.selectFocus")}
              </Text>
              <Pressable
                onPress={closeFocusModal}
                hitSlop={12}
                accessibilityLabel={t("Common.close")}
              >
                <KyarIcon name="close" size={24} color={colors.text} />
              </Pressable>
            </View>
            <TextInput
              value={focusSearch}
              onChangeText={setFocusSearch}
              placeholder={t("Home.searchBuildsPlaceholder")}
              placeholderTextColor="rgba(0,0,0,0.35)"
              className="border border-black/10 rounded-lg px-3 py-2.5 text-base text-black mb-3"
            />
          </View>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{
              paddingHorizontal: layout.screenPaddingX,
              paddingBottom: insets.bottom + 24,
            }}
            keyboardShouldPersistTaps="handled"
          >
            <Pressable
              onPress={() => selectFocus(undefined)}
              className="flex-row items-center gap-3 p-3 rounded-lg border border-black/10 bg-[#F9F9F9] mb-2"
            >
              <View className="w-12 h-12 rounded-md bg-[#EAEAEA] items-center justify-center">
                <KyarIcon name="event_note" size={28} color={colors.textTertiary} />
              </View>
              <Text
                className="flex-1 font-serif italic text-black"
                style={{ fontFamily: font.family.serifElegant }}
              >
                {t("Home.defaultFocus")}
              </Text>
            </Pressable>
            {filteredBuildsForFocus.map((b) => (
              <Pressable
                key={b._id}
                onPress={() => selectFocus(b._id)}
                className="flex-row items-center gap-3 p-3 rounded-lg border border-black/10 mb-2"
              >
                <View className="w-12 h-12 rounded-md overflow-hidden bg-[#EAEAEA]">
                  {b.imageStorageId || b.imageUrl ? (
                    <StorageImage
                      imageStorageId={b.imageStorageId}
                      imageUrl={b.imageUrl}
                      style={{ width: "100%", height: "100%" }}
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <KyarIcon name="image" size={24} color={colors.textTertiary} />
                    </View>
                  )}
                </View>
                <View className="flex-1 min-w-0">
                  <Text
                    className="font-serif italic text-black"
                    style={{ fontFamily: font.family.serifElegant }}
                    numberOfLines={1}
                  >
                    {b.name}
                  </Text>
                  <Text className="text-[10px] uppercase tracking-wider text-black/45 mt-0.5">
                    {b.tasksChecked} / {b.tasksTotal} tasks
                    {b.character ? ` · ${b.character}` : ""}
                  </Text>
                </View>
                {focusedBuildId === b._id ? (
                  <KyarIcon name="check" size={22} color={colors.text} />
                ) : null}
              </Pressable>
            ))}
            {filteredBuildsForFocus.length === 0 ? (
              <Text className="text-center text-black/40 py-6">{t("Home.noBuildsMatch")}</Text>
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
