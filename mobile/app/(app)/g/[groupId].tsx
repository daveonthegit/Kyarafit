import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { MobilePageHeader } from "@/components/navigation/MobilePageHeader";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ProfileAvatar } from "@/components/social/ProfileAvatar";
import { PublicBuildCard } from "@/components/social/PublicBuildCard";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard, TextField } from "@/ui";

function getDatesInRange(start: string, end: string) {
  const dates: string[] = [];
  const date = new Date(`${start}T12:00:00`);
  const endDate = new Date(`${end}T12:00:00`);
  while (date <= endDate) {
    dates.push(date.toISOString().slice(0, 10));
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

export default function GroupDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const rawGroupId = useLocalSearchParams<{ groupId: string | string[] }>().groupId;
  const groupId = (Array.isArray(rawGroupId) ? rawGroupId[0] : rawGroupId) as
    | Id<"groups">
    | undefined;
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const data = useQuery(
    api.groups.getWithMembers,
    groupId && userId ? { groupId, userId } : groupId ? { groupId } : "skip"
  );
  const builds = useQuery(api.builds.listByGroup, groupId ? { groupId } : "skip") ?? [];
  const conventionDays =
    useQuery(api.groupConventionDays.listForGroupWithConventions, groupId ? { groupId } : "skip") ??
    [];
  const myConventionsQuery = useQuery(api.conventions.list, userId ? { userId } : "skip");
  const myBuildsQuery = useQuery(api.builds.list, userId ? { userId } : "skip");
  const myConventions = useMemo(() => myConventionsQuery ?? [], [myConventionsQuery]);
  const myBuilds = useMemo(() => myBuildsQuery ?? [], [myBuildsQuery]);

  const setDays = useMutation(api.groupConventionDays.setDays);
  const setBuildGroup = useMutation(api.builds.setGroupId);

  const [conventionModalOpen, setConventionModalOpen] = useState(false);
  const [selectedConventionId, setSelectedConventionId] = useState<Id<"conventions"> | null>(null);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [buildModalOpen, setBuildModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  const group = data?.group;
  const members = data?.members ?? [];
  const isAdmin = data?.myRole === "admin";
  const status = identity === undefined || (groupId && data === undefined) ? "loading" : "ready";

  const selectedConvention = useMemo(
    () => myConventions.find((convention) => convention._id === selectedConventionId),
    [myConventions, selectedConventionId]
  );
  const conventionDateOptions = selectedConvention
    ? getDatesInRange(selectedConvention.startDate, selectedConvention.endDate)
    : [];

  const availableConventions = myConventions.filter(
    (convention) =>
      !conventionDays.some((row) => row.conventionId === convention._id) ||
      convention._id === selectedConventionId
  );
  const availableBuilds = myBuilds.filter(
    (build) =>
      !builds.some((groupBuild) => groupBuild._id === build._id) &&
      `${build.name} ${build.character ?? ""}`.toLowerCase().includes(search.trim().toLowerCase())
  );

  const openConventionEditor = (conventionId: Id<"conventions">) => {
    const existing = conventionDays.find((row) => row.conventionId === conventionId);
    setSelectedConventionId(conventionId);
    setSelectedDates(existing?.dates ?? []);
    setConventionModalOpen(true);
  };

  const toggleDate = (date: string) => {
    setSelectedDates((current) =>
      current.includes(date) ? current.filter((value) => value !== date) : [...current, date]
    );
  };

  const saveDays = async () => {
    if (!groupId || !userId || !selectedConventionId) return;
    try {
      await setDays({
        groupId,
        conventionId: selectedConventionId,
        userId,
        dates: [...selectedDates].sort(),
      });
      setConventionModalOpen(false);
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    }
  };

  const addBuildToGroup = async (buildId: Id<"builds">) => {
    if (!groupId || !userId) return;
    try {
      await setBuildGroup({ buildId, userId, groupId });
      setBuildModalOpen(false);
      setSearch("");
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    }
  };

  const removeBuildFromGroup = async (buildId: Id<"builds">) => {
    if (!userId) return;
    try {
      await setBuildGroup({ buildId, userId, groupId: null });
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    }
  };

  return (
    <>
      <Stack.Screen options={{ title: group?.name ?? t("nav.groups"), headerLargeTitle: false }} />
      <OfflineBanner />
      <MobilePageHeader
        eyebrow={t("nav.groups")}
        title={group?.name ?? t("nav.groups")}
        subtitle={group?.description || t("groups.detailSubtitle")}
        fallbackHref={APP_HREF.more}
        containerClassName="px-5 pt-4"
      />
      <DataBoundary status={status} data={{ ready: true }}>
        {() => (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerClassName="px-5 pb-12 pt-4"
          >
            {!group ? (
              <SurfaceCard className="px-4 py-5">
                <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
                  {t("groups.notFound")}
                </Text>
              </SurfaceCard>
            ) : (
              <>
                <SurfaceCard className="mt-5 overflow-hidden">
                  <View className="aspect-[16/10] bg-kyar-muted dark:bg-kyar-dark-muted">
                    {group.imageStorageId || group.imageUrl ? (
                      <ConvexStorageImage
                        storageId={group.imageStorageId}
                        imageUrl={group.imageUrl}
                        className="h-full w-full"
                      />
                    ) : (
                      <View className="h-full items-center justify-center">
                        <Text className="text-4xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                          ◇
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="gap-2 px-4 py-4">
                    <MetaLabel>{group.visibility}</MetaLabel>
                    <Text
                      style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
                      className="text-[32px] italic text-kyar-text dark:text-kyar-dark-text"
                    >
                      {group.name}
                    </Text>
                    <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {t("groups.memberCount", { count: members.length })}
                    </Text>
                  </View>
                </SurfaceCard>

                <SurfaceCard className="mt-4 px-4 py-4">
                  <View className="flex-row items-center justify-between">
                    <View>
                      <MetaLabel>{t("groups.membersLabel")}</MetaLabel>
                      <Text className="mt-2 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
                        {t("groups.membersTitle")}
                      </Text>
                    </View>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
                    <View className="flex-row gap-3">
                      {members.map((member) => (
                        <View key={member.userId} className="w-[94px] items-center gap-2">
                          <ProfileAvatar
                            imageStorageId={member.imageStorageId}
                            imageUrl={member.image}
                            label={member.name}
                            size={72}
                          />
                          <Text
                            className="text-center text-xs text-kyar-text dark:text-kyar-dark-text"
                            numberOfLines={2}
                          >
                            {member.name}
                          </Text>
                          <Text className="text-[10px] uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
                            {member.role}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </SurfaceCard>

                <SurfaceCard className="mt-4 px-4 py-4">
                  <View className="flex-row items-center justify-between gap-3">
                    <View className="min-w-0 flex-1">
                      <MetaLabel>{t("groups.conventionsLabel")}</MetaLabel>
                      <Text className="mt-2 text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
                        {t("groups.conventionsTitle")}
                      </Text>
                    </View>
                    {isAdmin ? (
                      <Button
                        title={t("groups.addConventionAction")}
                        variant="secondary"
                        onPress={() => {
                          if (availableConventions[0])
                            openConventionEditor(availableConventions[0]._id);
                        }}
                      />
                    ) : null}
                  </View>

                  <View className="mt-4 gap-3">
                    {conventionDays.length === 0 ? (
                      <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                        {t("groups.conventionsEmpty")}
                      </Text>
                    ) : (
                      conventionDays.map((row) => (
                        <Pressable
                          key={row.conventionId}
                          onPress={() =>
                            isAdmin
                              ? openConventionEditor(row.conventionId as Id<"conventions">)
                              : undefined
                          }
                          className="rounded-2xl bg-kyar-panel px-4 py-4 dark:bg-kyar-dark-panel"
                        >
                          <Text className="text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
                            {row.conventionName}
                          </Text>
                          <View className="mt-3 flex-row flex-wrap gap-2">
                            {row.dates.map((date) => (
                              <View
                                key={date}
                                className="rounded-full bg-kyar-surface px-3 py-2 dark:bg-kyar-dark-surface"
                              >
                                <Text className="text-[10px] uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
                                  {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                  })}
                                </Text>
                              </View>
                            ))}
                          </View>
                        </Pressable>
                      ))
                    )}
                  </View>
                </SurfaceCard>

                <View className="mt-4">
                  <SectionHeading
                    eyebrow={t("common.builds")}
                    title={t("groups.buildsTitle")}
                    action={
                      isAdmin ? (
                        <Button
                          title={t("groups.addBuildAction")}
                          variant="secondary"
                          onPress={() => setBuildModalOpen(true)}
                        />
                      ) : undefined
                    }
                  />
                  <View className="mt-4 gap-4">
                    {builds.length === 0 ? (
                      <SurfaceCard className="px-4 py-5">
                        <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                          {t("groups.buildsEmpty")}
                        </Text>
                      </SurfaceCard>
                    ) : (
                      builds.map((build, index) => (
                        <View key={build._id}>
                          <PublicBuildCard
                            build={build}
                            projectIndex={index + 1}
                            onPress={() => router.push(APP_HREF.build(build._id))}
                          />
                          {userId === build.userId ? (
                            <Button
                              title={t("groups.removeBuildAction")}
                              variant="secondary"
                              className="mt-2"
                              onPress={() => void removeBuildFromGroup(build._id)}
                            />
                          ) : null}
                        </View>
                      ))
                    )}
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        )}
      </DataBoundary>

      <Modal visible={conventionModalOpen} transparent animationType="fade">
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setConventionModalOpen(false)}
        >
          <Pressable
            className="rounded-t-3xl border border-kyar-borderSubtle bg-kyar-surface px-5 pb-8 pt-5 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
              {t("groups.editConventionDays")}
            </Text>

            <ScrollView className="mt-4 max-h-[420px]">
              <View className="gap-2">
                {availableConventions.map((convention) => (
                  <Pressable
                    key={convention._id}
                    onPress={() => openConventionEditor(convention._id)}
                    className={`rounded-2xl border px-4 py-3 ${
                      selectedConventionId === convention._id
                        ? "border-kyar-text bg-kyar-panelRaised dark:border-kyar-dark-text dark:bg-kyar-dark-panelRaised"
                        : "border-kyar-borderSubtle bg-kyar-panel dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
                    }`}
                  >
                    <Text className="text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
                      {convention.name}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {selectedConvention ? (
                <View className="mt-4 gap-2">
                  {conventionDateOptions.map((date) => {
                    const active = selectedDates.includes(date);
                    return (
                      <Pressable
                        key={date}
                        onPress={() => toggleDate(date)}
                        className={`rounded-2xl border px-4 py-3 ${
                          active
                            ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                            : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                        }`}
                      >
                        <Text
                          className={`text-sm ${
                            active
                              ? "text-kyar-bg dark:text-kyar-dark-bg"
                              : "text-kyar-text dark:text-kyar-dark-text"
                          }`}
                        >
                          {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                            weekday: "long",
                            month: "long",
                            day: "numeric",
                          })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </ScrollView>

            <View className="mt-4 flex-row gap-3">
              <Button
                title={t("common.cancel")}
                variant="secondary"
                className="flex-1"
                onPress={() => setConventionModalOpen(false)}
              />
              <Button
                title={t("common.save")}
                className="flex-1"
                onPress={() => void saveDays()}
                disabled={!selectedConventionId}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={buildModalOpen} transparent animationType="fade">
        <Pressable
          className="flex-1 justify-end bg-black/40"
          onPress={() => setBuildModalOpen(false)}
        >
          <Pressable
            className="rounded-t-3xl border border-kyar-borderSubtle bg-kyar-surface px-5 pb-8 pt-5 dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
            onPress={(event) => event.stopPropagation()}
          >
            <Text className="text-lg font-semibold text-kyar-text dark:text-kyar-dark-text">
              {t("groups.addBuildAction")}
            </Text>
            <TextField
              value={search}
              onChangeText={setSearch}
              placeholder={t("groups.searchBuilds")}
              className="mt-4"
            />

            <ScrollView className="mt-4 max-h-[420px]">
              <View className="gap-3">
                {availableBuilds.length === 0 ? (
                  <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                    {t("groups.availableBuildsEmpty")}
                  </Text>
                ) : (
                  availableBuilds.map((build, index) => (
                    <PublicBuildCard
                      key={build._id}
                      build={build}
                      projectIndex={index + 1}
                      onPress={() => void addBuildToGroup(build._id)}
                    />
                  ))
                )}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
