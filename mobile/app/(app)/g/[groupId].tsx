import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { OfflineBanner } from "@/components/OfflineBanner";
import { ProfileAvatar } from "@/components/social/ProfileAvatar";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary } from "@/ui";
import {
  GlassEmptyState,
  GlassPanel,
  GlassSheet,
  GlassTextField,
  PhotoBackdrop,
  PhotoPill,
} from "@/ui/glass";

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

/** Uppercase tracked meta on photo/glass (QA-2 floors: ≥9px, ≥0.14em). */
function Meta({
  children,
  size = 9,
  color = glass.text.fg70,
  tracking = 0.16,
  numberOfLines,
}: {
  children: string;
  size?: number;
  color?: string;
  tracking?: number;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={{
        fontFamily: APP_FONT_FAMILIES.sansBold,
        fontSize: size,
        letterSpacing: ls(tracking, size),
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </Text>
  );
}

export default function GroupDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
      {/* Glass Studio 7.4 (12d): the screen draws its own headline over the photo. */}
      <Stack.Screen options={{ title: group?.name ?? t("nav.groups"), headerLargeTitle: false }} />
      <DataBoundary status={status} data={{ ready: true }}>
        {() => (
          <View style={{ flex: 1 }}>
            <PhotoBackdrop
              imageStorageId={group?.imageStorageId}
              imageUrl={group?.imageUrl}
            />

            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingTop: insets.top + 58,
                paddingBottom: insets.bottom + 48,
              }}
            >
              <OfflineBanner />

              {!group ? (
                <GlassEmptyState
                  icon="people-outline"
                  message={t("groups.notFound")}
                  style={{ paddingVertical: 48 }}
                />
              ) : (
                <>
                  {/* Identity block (8a grammar) */}
                  <View style={{ paddingHorizontal: 22 }}>
                    <Meta size={9} tracking={0.26} color={glass.text.fg70} numberOfLines={1}>
                      {`${group.visibility} · ${t("groups.memberCount", { count: members.length })}`}
                    </Meta>
                    <Text
                      numberOfLines={3}
                      style={{
                        marginTop: 8,
                        fontFamily: APP_FONT_FAMILIES.displayItalic,
                        fontStyle: "italic",
                        fontSize: 38,
                        lineHeight: 42,
                        letterSpacing: ls(-0.02, 38),
                        color: glass.text.fg,
                      }}
                    >
                      {group.name}
                    </Text>
                    {group.description ? (
                      <Text
                        numberOfLines={3}
                        style={{
                          marginTop: 8,
                          fontFamily: APP_FONT_FAMILIES.sansRegular,
                          fontSize: 12,
                          lineHeight: 18,
                          color: glass.text.fg70,
                        }}
                      >
                        {group.description}
                      </Text>
                    ) : null}

                    {/* Overlapping member-avatar row. */}
                    {members.length > 0 ? (
                      <View
                        style={{
                          marginTop: 14,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 12,
                        }}
                      >
                        <View style={{ flexDirection: "row" }}>
                          {members.slice(0, 6).map((member, index) => (
                            <View key={member.userId} style={{ marginLeft: index === 0 ? 0 : -8 }}>
                              <ProfileAvatar
                                imageStorageId={member.imageStorageId}
                                imageUrl={member.image}
                                label={member.name}
                                size={32}
                              />
                            </View>
                          ))}
                        </View>
                        <Meta size={9} tracking={0.14} color={glass.text.fg55} numberOfLines={1}>
                          {members
                            .slice(0, 3)
                            .map((member) => member.name)
                            .join(" · ")}
                        </Meta>
                      </View>
                    ) : null}
                  </View>

                  {/* Convention day-rail (8a): tiles of shared event days. */}
                  <View style={{ marginTop: 26 }}>
                    <View style={{ paddingHorizontal: 22 }}>
                      <Meta size={10} tracking={0.24} color={glass.text.fg}>
                        {`${t("groups.conventionsTitle")} · ${conventionDays.length}`}
                      </Meta>
                    </View>

                    {conventionDays.length === 0 &&
                    !(isAdmin && availableConventions.length > 0) ? (
                      <Text
                        style={{
                          marginTop: 10,
                          paddingHorizontal: 22,
                          fontFamily: APP_FONT_FAMILIES.sansRegular,
                          fontSize: 12,
                          lineHeight: 18,
                          color: glass.text.fg55,
                        }}
                      >
                        {t("groups.conventionsEmpty")}
                      </Text>
                    ) : (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginTop: 12 }}
                        contentContainerStyle={{ paddingHorizontal: 22, gap: 12 }}
                      >
                        {conventionDays.map((row) => (
                          <Pressable
                            key={row.conventionId}
                            onPress={() =>
                              isAdmin
                                ? openConventionEditor(row.conventionId as Id<"conventions">)
                                : undefined
                            }
                            accessibilityRole={isAdmin ? "button" : undefined}
                            accessibilityLabel={row.conventionName}
                            className="active:opacity-80"
                            style={{
                              width: 190,
                              minHeight: 96,
                              borderRadius: 10,
                              borderWidth: borderWidth.hairline,
                              borderColor: glass.border.divider,
                              backgroundColor: glass.surface.active,
                              paddingHorizontal: 12,
                              paddingVertical: 11,
                            }}
                          >
                            <Text
                              numberOfLines={1}
                              style={{
                                fontFamily: APP_FONT_FAMILIES.displayItalic,
                                fontStyle: "italic",
                                fontSize: 16,
                                lineHeight: 19,
                                color: glass.text.fg,
                              }}
                            >
                              {row.conventionName}
                            </Text>
                            <View
                              style={{
                                marginTop: 8,
                                flexDirection: "row",
                                flexWrap: "wrap",
                                gap: 6,
                              }}
                            >
                              {row.dates.length === 0 ? (
                                <Meta size={9} tracking={0.14} color={glass.text.fg55}>
                                  {t("groups.noDaysPicked", { defaultValue: "No days picked" })}
                                </Meta>
                              ) : (
                                row.dates.map((date) => (
                                  <View
                                    key={date}
                                    style={{
                                      borderRadius: 999,
                                      borderWidth: borderWidth.hairline,
                                      borderColor: glass.border.default,
                                      backgroundColor: glass.surface.bar,
                                      paddingHorizontal: 8,
                                      paddingVertical: 4,
                                    }}
                                  >
                                    <Meta size={9} tracking={0.14} color={glass.text.fg70}>
                                      {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
                                        weekday: "short",
                                        month: "short",
                                        day: "numeric",
                                      })}
                                    </Meta>
                                  </View>
                                ))
                              )}
                            </View>
                          </Pressable>
                        ))}

                        {/* Dashed = add affordance; keeps the isAdmin gate. */}
                        {isAdmin && availableConventions.length > 0 ? (
                          <Pressable
                            onPress={() => {
                              if (availableConventions[0])
                                openConventionEditor(availableConventions[0]._id);
                            }}
                            accessibilityRole="button"
                            accessibilityLabel={t("groups.addConventionAction")}
                            className="active:opacity-80"
                            style={{
                              width: 150,
                              minHeight: 96,
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 8,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderStyle: "dashed",
                              borderColor: glass.border.strong,
                            }}
                          >
                            <Ionicons name="add" size={20} color={glass.text.fg70} />
                            <Meta size={9} color={glass.text.fg70}>
                              {t("groups.linkConventionTile", {
                                defaultValue: "Link a convention",
                              })}
                            </Meta>
                          </Pressable>
                        ) : null}
                      </ScrollView>
                    )}
                  </View>

                  {/* Builds work panel — the ONE glass panel on this screen (12d). */}
                  <View style={{ marginTop: 26, paddingHorizontal: 16 }}>
                    <GlassPanel>
                      <View
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 14,
                          borderBottomWidth: borderWidth.hairline,
                          borderBottomColor: glass.border.dividerStrong,
                        }}
                      >
                        <Meta size={10} tracking={0.24} color={glass.text.fg}>
                          {`${t("groups.buildsTitle")} · ${builds.length}`}
                        </Meta>
                      </View>

                      {builds.length === 0 ? (
                        <Text
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 16,
                            fontFamily: APP_FONT_FAMILIES.sansRegular,
                            fontSize: 13,
                            lineHeight: 19,
                            color: glass.text.fg55,
                          }}
                        >
                          {t("groups.buildsEmpty")}
                        </Text>
                      ) : (
                        builds.map((build) => {
                          const ownerName = members.find(
                            (member) => member.userId === build.userId
                          )?.name;
                          const eyebrow = [build.character, ownerName]
                            .filter(Boolean)
                            .join(" · ");
                          return (
                            <View
                              key={build._id}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                borderBottomWidth: borderWidth.hairline,
                                borderBottomColor: glass.border.divider,
                              }}
                            >
                              <Pressable
                                onPress={() => router.push(APP_HREF.build(build._id))}
                                accessibilityRole="button"
                                accessibilityLabel={build.name}
                                className="active:opacity-80"
                                style={{
                                  minWidth: 0,
                                  flex: 1,
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 12,
                                  minHeight: 82,
                                  paddingHorizontal: 16,
                                  paddingVertical: 8,
                                }}
                              >
                                <View
                                  style={{
                                    width: 52,
                                    height: 66,
                                    borderRadius: 8,
                                    overflow: "hidden",
                                    backgroundColor: glass.surface.active,
                                  }}
                                >
                                  {build.imageStorageId || build.imageUrl ? (
                                    <ConvexStorageImage
                                      storageId={build.imageStorageId}
                                      imageUrl={build.imageUrl}
                                      className="h-full w-full"
                                    />
                                  ) : (
                                    <View
                                      style={{
                                        flex: 1,
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      <Ionicons
                                        name="image-outline"
                                        size={18}
                                        color={glass.text.fg45}
                                      />
                                    </View>
                                  )}
                                </View>
                                <View style={{ minWidth: 0, flex: 1 }}>
                                  {eyebrow ? (
                                    <Meta size={9} tracking={0.14} color={glass.text.fg55} numberOfLines={1}>
                                      {eyebrow}
                                    </Meta>
                                  ) : null}
                                  <Text
                                    numberOfLines={1}
                                    style={{
                                      marginTop: eyebrow ? 3 : 0,
                                      fontFamily: APP_FONT_FAMILIES.displayItalic,
                                      fontStyle: "italic",
                                      fontSize: 16,
                                      lineHeight: 19,
                                      color: glass.text.fg,
                                    }}
                                  >
                                    {build.name}
                                  </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={glass.text.fg45} />
                              </Pressable>
                              {/* Own builds keep their remove affordance. */}
                              {userId === build.userId ? (
                                <Pressable
                                  onPress={() => void removeBuildFromGroup(build._id)}
                                  accessibilityRole="button"
                                  accessibilityLabel={t("groups.removeBuildAction")}
                                  hitSlop={8}
                                  className="active:opacity-80"
                                  style={{
                                    width: 44,
                                    height: 44,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginRight: 8,
                                  }}
                                >
                                  <Ionicons name="close" size={16} color={glass.text.fg55} />
                                </Pressable>
                              ) : null}
                            </View>
                          );
                        })
                      )}

                      {/* Footer composer — keeps the isAdmin gate. */}
                      {isAdmin ? (
                        <Pressable
                          onPress={() => setBuildModalOpen(true)}
                          accessibilityRole="button"
                          accessibilityLabel={t("groups.addMyBuildAction", {
                            defaultValue: "Add my build",
                          })}
                          className="active:opacity-80"
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                            minHeight: 48,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                          }}
                        >
                          <Ionicons name="add" size={16} color={glass.text.fg55} />
                          <Text
                            style={{
                              flex: 1,
                              fontFamily: APP_FONT_FAMILIES.sansRegular,
                              fontSize: 12,
                              color: glass.text.fg55,
                            }}
                          >
                            {t("groups.addMyBuildAction", { defaultValue: "Add my build" })}
                          </Text>
                        </Pressable>
                      ) : null}
                    </GlassPanel>
                  </View>
                </>
              )}
            </ScrollView>

            {/* Screen chrome: glass back over the photo (no nav header on this route). */}
            <View style={{ position: "absolute", top: insets.top + 10, left: 10 }}>
              <MobileBackButton surface="glass" fallbackHref={APP_HREF.more} />
            </View>
          </View>
        )}
      </DataBoundary>

      {/* Convention day picker — overlay-glass sheet. */}
      <GlassSheet
        open={conventionModalOpen}
        onClose={() => setConventionModalOpen(false)}
        closeLabel={t("common.cancel")}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontStyle: "italic",
              fontSize: 22,
              lineHeight: 25,
              color: glass.text.fg,
            }}
          >
            {t("groups.editConventionDays")}
          </Text>

          <ScrollView style={{ marginTop: 14, maxHeight: 380 }} nestedScrollEnabled>
            <View style={{ gap: 8 }}>
              {availableConventions.map((convention) => {
                const active = selectedConventionId === convention._id;
                return (
                  <Pressable
                    key={convention._id}
                    onPress={() => openConventionEditor(convention._id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    className="active:opacity-80"
                    style={{
                      minHeight: 44,
                      justifyContent: "center",
                      borderRadius: 12,
                      borderWidth: active ? 1 : borderWidth.hairline,
                      borderColor: active ? glass.border.strong : glass.border.default,
                      backgroundColor: active ? glass.surface.active : glass.surface.field,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                  >
                    <Text
                      numberOfLines={1}
                      style={{
                        fontFamily: APP_FONT_FAMILIES.sansMedium,
                        fontSize: 13,
                        color: glass.text.fg,
                      }}
                    >
                      {convention.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {selectedConvention ? (
              <View style={{ marginTop: 14, gap: 8 }}>
                {conventionDateOptions.map((date) => {
                  const active = selectedDates.includes(date);
                  return (
                    <Pressable
                      key={date}
                      onPress={() => toggleDate(date)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: active }}
                      className="active:opacity-80"
                      style={
                        active
                          ? {
                              minHeight: 44,
                              justifyContent: "center",
                              borderRadius: 12,
                              backgroundColor: glass.surface.solid,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                            }
                          : {
                              minHeight: 44,
                              justifyContent: "center",
                              borderRadius: 12,
                              borderWidth: borderWidth.hairline,
                              borderColor: glass.border.default,
                              backgroundColor: glass.surface.field,
                              paddingHorizontal: 12,
                              paddingVertical: 10,
                            }
                      }
                    >
                      <Text
                        style={{
                          fontFamily: APP_FONT_FAMILIES.sansMedium,
                          fontSize: 13,
                          color: active ? glass.text.ink : glass.text.fg,
                        }}
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

          <View
            style={{
              marginTop: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 10,
            }}
          >
            <PhotoPill
              variant="outline"
              label={t("common.cancel")}
              onPress={() => setConventionModalOpen(false)}
            />
            <PhotoPill
              variant="solid"
              label={t("common.save")}
              disabled={!selectedConventionId}
              onPress={() => void saveDays()}
            />
          </View>
        </View>
      </GlassSheet>

      {/* Build picker — overlay-glass sheet. */}
      <GlassSheet
        open={buildModalOpen}
        onClose={() => setBuildModalOpen(false)}
        closeLabel={t("common.cancel")}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontStyle: "italic",
              fontSize: 22,
              lineHeight: 25,
              color: glass.text.fg,
            }}
          >
            {t("groups.addBuildAction")}
          </Text>

          <View style={{ marginTop: 14 }}>
            <GlassTextField
              value={search}
              onChangeText={setSearch}
              placeholder={t("groups.searchBuilds")}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <ScrollView
            style={{ marginTop: 14, maxHeight: 420 }}
            contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
            nestedScrollEnabled
          >
            {availableBuilds.length === 0 ? (
              <Text
                style={{
                  paddingVertical: 12,
                  fontFamily: APP_FONT_FAMILIES.sansRegular,
                  fontSize: 13,
                  lineHeight: 19,
                  color: glass.text.fg55,
                }}
              >
                {t("groups.availableBuildsEmpty")}
              </Text>
            ) : (
              availableBuilds.map((build) => (
                <Pressable
                  key={build._id}
                  onPress={() => void addBuildToGroup(build._id)}
                  accessibilityRole="button"
                  accessibilityLabel={build.name}
                  className="active:opacity-80"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderRadius: 12,
                    borderWidth: borderWidth.hairline,
                    borderColor: glass.border.default,
                    backgroundColor: glass.surface.field,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 66,
                      borderRadius: 8,
                      overflow: "hidden",
                      backgroundColor: glass.surface.active,
                    }}
                  >
                    <ConvexStorageImage
                      storageId={build.imageStorageId}
                      imageUrl={build.imageUrl}
                      className="h-full w-full"
                      accessibilityLabel={build.name}
                    />
                  </View>
                  <View style={{ minWidth: 0, flex: 1 }}>
                    {build.character ? (
                      <Meta size={9} tracking={0.14} color={glass.text.fg55} numberOfLines={1}>
                        {build.character}
                      </Meta>
                    ) : null}
                    <Text
                      numberOfLines={1}
                      style={{
                        marginTop: build.character ? 3 : 0,
                        fontFamily: APP_FONT_FAMILIES.displayItalic,
                        fontStyle: "italic",
                        fontSize: 16,
                        lineHeight: 19,
                        color: glass.text.fg,
                      }}
                    >
                      {build.name}
                    </Text>
                  </View>
                  <Ionicons name="add" size={16} color={glass.text.fg45} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </GlassSheet>
    </>
  );
}

