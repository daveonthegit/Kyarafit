import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { glass, ls, borderWidth } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { APP_HREF } from "@/lib/appRoutes";
import { buildGlobalAddMenuActions } from "@/lib/globalAddMenuActions";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import {
  countPackingProgress,
  countPlannedBuilds,
  filterAndSortConventions,
  formatDateRange,
  getDaysUntil,
  type ConventionFilter,
  type ConventionSortBy,
  type ConventionWithDetails,
  type SortOrder,
} from "@/screens/conventions/utils";
import { DataBoundary, FloatingCreateMenu } from "@/ui";
import {
  GlassEmptyState,
  GlassPanel,
  GlassSheet,
  GlassTextField,
  PhotoBackdrop,
  PhotoPill,
} from "@/ui/glass";

const FILTER_KEYS: ConventionFilter[] = ["all", "upcoming", "past", "archived"];
const SORT_KEYS: ConventionSortBy[] = ["startDate", "name", "location"];

type Ready = {
  conventions: ConventionWithDetails[];
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ConventionsIndexScreen() {
  const { t } = useTranslation();
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const conventions = useOfflineQuery(
    api.conventions.listWithDetails,
    userId ? { userId } : "skip"
  );

  const loading = identity === undefined || (userId != null && conventions === undefined);
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!userId || (conventions ?? []).length === 0) status = "empty";
  else status = "ready";

  const data: Ready | undefined =
    status === "ready"
      ? { conventions: (conventions ?? []) as ConventionWithDetails[] }
      : undefined;

  return (
    <>
      {/* Glass Studio 7.3 (6e): the list draws its own headline over the photo. */}
      <Stack.Screen options={{ headerShown: false }} />
      <DataBoundary status={status} data={data} error={error} empty={<EmptyConventionState />}>
        {(loaded) =>
          userId ? <ConventionsBody userId={userId} conventions={loaded.conventions} /> : null
        }
      </DataBoundary>
    </>
  );
}

type ConventionsBodyProps = {
  userId: string;
  conventions: ConventionWithDetails[];
};

function ConventionsBody({ userId, conventions }: ConventionsBodyProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<ConventionFilter>("all");
  const [sortBy, setSortBy] = useState<ConventionSortBy>("startDate");
  const [order, setOrder] = useState<SortOrder>("asc");
  const [refreshing, setRefreshing] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [deletedForUndo, setDeletedForUndo] = useState<{
    count: number;
    payloads: {
      userId: string;
      name: string;
      location?: string;
      imageUrl?: string;
      imageStorageId?: Doc<"conventions">["imageStorageId"];
      startDate: string;
      endDate: string;
    }[];
  } | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const archiveMany = useOfflineMutation(api.conventions.archiveMany);
  const removeMany = useOfflineMutation(api.conventions.removeMany);
  const createConvention = useOfflineMutation(api.conventions.create);

  const filtered = useMemo(
    () => filterAndSortConventions(conventions, search, filter, sortBy, order),
    [conventions, filter, order, search, sortBy]
  );

  /** Next upcoming convention — backs the page photo + headline (6e). */
  const nextEvent = useMemo(() => {
    const today = todayIso();
    return (
      [...conventions]
        .filter((c) => c.archived !== true && c.endDate >= today)
        .sort((a, b) => a.startDate.localeCompare(b.startDate))[0] ?? null
    );
  }, [conventions]);

  const countdownLabel = useCallback(
    (startDate: string): string | null => {
      const days = getDaysUntil(startDate);
      if (days < 0) return null;
      if (days === 0) return t("conventions.countdownToday", { defaultValue: "Today" });
      if (days === 1) return t("conventions.countdownTomorrow", { defaultValue: "Tomorrow" });
      return t("conventions.countdownDays", { count: days, defaultValue: "{{count}} days" });
    },
    [t]
  );

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllInModal = useCallback(() => {
    setSelectedIds((prev) => {
      if (filtered.length === 0) return prev;
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((c) => String(c._id)));
    });
  }, [filtered]);

  useEffect(
    () => () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    },
    []
  );

  const UNDO_WINDOW_MS = 8000;

  const handleArchiveSelected = useCallback(
    async (archived: boolean) => {
      if (selectedIds.size === 0) return;
      setBulkPending(true);
      try {
        await archiveMany({
          ids: Array.from(selectedIds) as Id<"conventions">[],
          userId,
          archived,
        });
        clearSelection();
        setBulkOpen(false);
      } catch (error) {
        Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
      } finally {
        setBulkPending(false);
      }
    },
    [archiveMany, clearSelection, selectedIds, t, userId]
  );

  const runBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const toDelete = conventions.filter((c) => selectedIds.has(String(c._id)));
    const payloads = toDelete.map((c) => ({
      userId: c.userId,
      name: c.name,
      location: c.location,
      imageUrl: c.imageUrl,
      imageStorageId: c.imageStorageId,
      startDate: c.startDate,
      endDate: c.endDate,
    }));
    setBulkPending(true);
    try {
      await removeMany({
        ids: Array.from(selectedIds) as Id<"conventions">[],
        userId,
      });
      clearSelection();
      setBulkOpen(false);
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
      setDeletedForUndo({ count: payloads.length, payloads });
      undoTimeoutRef.current = setTimeout(() => {
        setDeletedForUndo(null);
        undoTimeoutRef.current = null;
      }, UNDO_WINDOW_MS);
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setBulkPending(false);
    }
  }, [clearSelection, conventions, removeMany, selectedIds, t, userId]);

  const confirmBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    Alert.alert(
      t("conventions.bulkDeleteConfirmTitle", { count: selectedIds.size }),
      t("conventions.bulkDeleteConfirmBody"),
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("conventions.bulkDeleteConfirmAction"),
          style: "destructive",
          onPress: () => void runBulkDelete(),
        },
      ]
    );
  }, [runBulkDelete, selectedIds.size, t]);

  const handleUndoDelete = useCallback(async () => {
    if (!deletedForUndo) return;
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    setBulkPending(true);
    try {
      for (const payload of deletedForUndo.payloads) {
        await createConvention({
          userId: payload.userId,
          name: payload.name,
          location: payload.location,
          imageUrl: payload.imageUrl,
          imageStorageId: payload.imageStorageId,
          startDate: payload.startDate,
          endDate: payload.endDate,
        });
      }
      setDeletedForUndo(null);
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setBulkPending(false);
    }
  }, [createConvention, deletedForUndo, t]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 450);
  }, []);

  const createActions = useMemo(() => buildGlobalAddMenuActions("events", t, router), [router, t]);

  const chromeTop = insets.top + 10;
  const headlineTop = insets.top + 58 + (searchOpen ? 68 : 0);
  const today = todayIso();
  const seasonYear = nextEvent
    ? nextEvent.startDate.slice(0, 4)
    : String(new Date().getFullYear());

  const nextPlanned = nextEvent ? countPlannedBuilds(nextEvent.plans) : 0;
  const nextPacking = nextEvent ? countPackingProgress(nextEvent.packing) : { checked: 0, total: 0 };
  const nextCountdown = nextEvent ? countdownLabel(nextEvent.startDate) : null;
  const packingPct =
    nextPacking.total > 0 ? Math.round((nextPacking.checked / nextPacking.total) * 100) : 0;

  return (
    <View style={{ flex: 1 }}>
      <PhotoBackdrop
        imageStorageId={nextEvent?.imageStorageId}
        imageUrl={nextEvent?.imageUrl}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: headlineTop, paddingBottom: insets.bottom + 140 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={glass.text.fg} />
        }
      >
        {/* Headline block — the next upcoming event leads the page. */}
        <View style={{ paddingHorizontal: 22 }}>
          {nextEvent ? (
            <>
              <Text
                style={{
                  fontFamily: APP_FONT_FAMILIES.sansBold,
                  fontSize: 9,
                  letterSpacing: ls(0.26, 9),
                  textTransform: "uppercase",
                  color: glass.text.fg,
                  opacity: 0.75,
                  marginBottom: 8,
                }}
                numberOfLines={1}
              >
                {t("conventions.nextEyebrow", { defaultValue: "Next" })} ·{" "}
                {formatDateRange(nextEvent.startDate, nextEvent.endDate)}
                {nextEvent.location ? ` · ${nextEvent.location}` : ""}
              </Text>
              <Text
                style={{
                  fontFamily: APP_FONT_FAMILIES.displayItalic,
                  fontSize: 38,
                  lineHeight: 42,
                  letterSpacing: ls(-0.02, 38),
                  color: glass.text.fg,
                }}
              >
                {nextEvent.name}
              </Text>

              {/* Meta triplet: Countdown / Builds / Packing progress hairline. */}
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 22, marginTop: 16 }}>
                {nextCountdown ? (
                  <HeadlineMetric
                    label={t("conventions.metricCountdown", { defaultValue: "Countdown" })}
                    value={nextCountdown}
                  />
                ) : null}
                <HeadlineMetric
                  label={t("conventions.metricBuilds")}
                  value={t("conventions.metricBuildsValue", {
                    count: nextPlanned,
                    defaultValue: "{{count}} planned",
                  })}
                />
                <View>
                  <Text style={metricLabelStyle}>{t("conventions.metricPacking")}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        width: 64,
                        height: 2,
                        borderRadius: 2,
                        backgroundColor: glass.border.overlay,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          width: `${packingPct}%`,
                          height: "100%",
                          backgroundColor: glass.surface.solid,
                        }}
                      />
                    </View>
                    <Text
                      style={{
                        fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                        fontSize: 13,
                        color: glass.text.fg,
                      }}
                    >
                      {nextPacking.checked}/{nextPacking.total}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Action row. Owner precedent (Builds device check): the content
                  primary stays solid alongside the global create FAB. */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 20 }}>
                <PhotoPill
                  variant="solid"
                  label={t("conventions.dayPlansAction", { defaultValue: "Day plans" })}
                  onPress={() => router.push(APP_HREF.convention(nextEvent._id))}
                />
                <PhotoPill
                  variant="outline"
                  label={t("conventions.packingListAction", { defaultValue: "Packing list" })}
                  onPress={() => router.push(APP_HREF.conventionPacking(nextEvent._id))}
                />
              </View>
            </>
          ) : (
            <>
              <Text
                style={{
                  fontFamily: APP_FONT_FAMILIES.sansBold,
                  fontSize: 9,
                  letterSpacing: ls(0.26, 9),
                  textTransform: "uppercase",
                  color: glass.text.fg,
                  opacity: 0.75,
                  marginBottom: 8,
                }}
              >
                {t("conventions.seasonEyebrowPlain", { defaultValue: "The season" })}
              </Text>
              <Text
                style={{
                  fontFamily: APP_FONT_FAMILIES.displayItalic,
                  fontSize: 34,
                  lineHeight: 38,
                  letterSpacing: ls(-0.02, 34),
                  color: glass.text.fg,
                }}
              >
                {t("conventions.noUpcomingHeadline", {
                  defaultValue: "No events on the calendar.",
                })}
              </Text>
            </>
          )}
        </View>

        {/* The season — the one glass panel on this screen. */}
        <View style={{ paddingHorizontal: 16, marginTop: 28 }}>
          <GlassPanel>
            <View
              style={{
                paddingHorizontal: 16,
                paddingTop: 14,
                paddingBottom: 12,
                borderBottomWidth: borderWidth.hairline,
                borderBottomColor: glass.border.divider,
              }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    fontSize: 9,
                    letterSpacing: ls(0.2, 9),
                    textTransform: "uppercase",
                    color: glass.text.fg,
                    opacity: 0.85,
                  }}
                >
                  {t("conventions.seasonEyebrow", {
                    year: seasonYear,
                    defaultValue: "The season · {{year}}",
                  })}
                </Text>
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                    fontSize: 9,
                    letterSpacing: ls(0.14, 9),
                    textTransform: "uppercase",
                    color: glass.text.fg55,
                  }}
                >
                  {t("conventions.resultsCount", { count: filtered.length })}
                </Text>
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
                contentContainerStyle={{ gap: 14, paddingRight: 6 }}
              >
                {FILTER_KEYS.map((value) => {
                  const active = filter === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setFilter(value)}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: active }}
                      style={{ minHeight: 44, justifyContent: "center" }}
                    >
                      <Text
                        style={{
                          fontFamily: active
                            ? APP_FONT_FAMILIES.sansBold
                            : APP_FONT_FAMILIES.sansSemiBold,
                          fontSize: 9,
                          letterSpacing: ls(0.16, 9),
                          textTransform: "uppercase",
                          color: glass.text.fg,
                          opacity: active ? 1 : 0.55,
                          borderBottomWidth: 1.5,
                          borderBottomColor: active ? glass.text.fg : "transparent",
                          paddingBottom: 2,
                        }}
                      >
                        {t(`conventions.filter.${value}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: "row", alignItems: "center", gap: 18 }}>
                <HeaderTextAction
                  label={t(`conventions.sort.${sortBy}`)}
                  onPress={() =>
                    setSortBy(
                      (value) => SORT_KEYS[(SORT_KEYS.indexOf(value) + 1) % SORT_KEYS.length]!
                    )
                  }
                />
                <HeaderTextAction
                  label={order === "asc" ? t("conventions.order.asc") : t("conventions.order.desc")}
                  onPress={() => setOrder((value) => (value === "asc" ? "desc" : "asc"))}
                />
                {filtered.length > 0 ? (
                  <HeaderTextAction
                    label={t("conventions.bulkSelectAction")}
                    onPress={() => setBulkOpen(true)}
                  />
                ) : null}
              </View>
            </View>

            {filtered.length === 0 ? (
              <GlassEmptyState
                icon="search-outline"
                message={t("conventions.noMatches", {
                  defaultValue: "No events match your search or filter.",
                })}
                style={{ paddingVertical: 32 }}
              />
            ) : (
              filtered.map((item) => {
                const isNext = nextEvent != null && item._id === nextEvent._id;
                const upcoming = item.endDate >= today;
                const plannedBuilds = countPlannedBuilds(item.plans);
                const countdown = upcoming ? countdownLabel(item.startDate) : null;
                const metaParts = [
                  formatDateRange(item.startDate, item.endDate),
                  item.location,
                  plannedBuilds > 0
                    ? t("conventions.rowBuilds", {
                        count: plannedBuilds,
                        defaultValue: "{{count}} builds",
                      })
                    : null,
                  countdown,
                ].filter(Boolean);
                return (
                  <Pressable
                    key={item._id}
                    onPress={() => router.push(APP_HREF.convention(item._id))}
                    accessibilityRole="button"
                    accessibilityLabel={item.name}
                    className="active:opacity-80"
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 56,
                      paddingHorizontal: 16,
                      paddingVertical: 12,
                      borderBottomWidth: borderWidth.hairline,
                      borderBottomColor: glass.border.divider,
                      opacity: isNext ? 1 : upcoming ? 0.8 : 0.6,
                    }}
                  >
                    <View style={{ minWidth: 0, flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: APP_FONT_FAMILIES.displayItalic,
                          fontSize: isNext ? 17 : 15,
                          lineHeight: isNext ? 19 : 17,
                          color: glass.text.fg,
                        }}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={{
                          marginTop: 3,
                          fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                          fontSize: 9,
                          letterSpacing: ls(0.14, 9),
                          textTransform: "uppercase",
                          color: glass.text.fg55,
                        }}
                        numberOfLines={1}
                      >
                        {metaParts.join(" · ")}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={glass.text.fg45} />
                  </Pressable>
                );
              })
            )}

            {/* Footer text-pill: existing create navigation. */}
            <Pressable
              onPress={() => router.push(APP_HREF.conventionNew)}
              accessibilityRole="button"
              accessibilityLabel={t("conventions.addEventAction", {
                defaultValue: "Add an event",
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
                {t("conventions.addEventAction", { defaultValue: "Add an event" })}
              </Text>
            </Pressable>
          </GlassPanel>
        </View>
      </ScrollView>

      {/* Screen chrome: back + search over the photo (this list has no nav header). */}
      <View
        style={{ position: "absolute", top: chromeTop, left: 10, right: 22 }}
        pointerEvents="box-none"
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
          pointerEvents="box-none"
        >
          <MobileBackButton surface="glass" fallbackHref={APP_HREF.more} />
          <IconPill
            icon="search"
            active={searchOpen}
            accessibilityLabel={t("conventions.searchToggle", { defaultValue: "Search events" })}
            onPress={() => {
              if (searchOpen) setSearch("");
              setSearchOpen((open) => !open);
            }}
          />
        </View>
        {searchOpen ? (
          <View style={{ marginTop: 10, paddingLeft: 12 }}>
            <GlassTextField
              value={search}
              onChangeText={setSearch}
              placeholder={t("conventions.searchPlaceholder")}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              clearButtonMode="while-editing"
            />
          </View>
        ) : null}
      </View>

      <FloatingCreateMenu actions={createActions} />

      <GlassSheet open={bulkOpen} onClose={() => setBulkOpen(false)} closeLabel={t("common.cancel")}>
        <View style={{ paddingHorizontal: 20, paddingTop: 14 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontSize: 22,
              lineHeight: 25,
              color: glass.text.fg,
            }}
          >
            {t("conventions.bulkModalTitle")}
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontFamily: APP_FONT_FAMILIES.sansRegular,
              fontSize: 12,
              lineHeight: 18,
              color: glass.text.fg70,
            }}
          >
            {t("conventions.bulkModalBody")}
          </Text>
          <View style={{ marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <PhotoPill
              variant="outline"
              size="sm"
              label={
                selectedIds.size === filtered.length && filtered.length > 0
                  ? t("conventions.bulkDeselectAll")
                  : t("conventions.bulkSelectAll")
              }
              onPress={selectAllInModal}
            />
            <PhotoPill
              variant="text"
              size="sm"
              label={t("conventions.bulkClear")}
              onPress={clearSelection}
            />
          </View>

          <View
            style={{
              marginTop: 14,
              maxHeight: 280,
              borderWidth: borderWidth.hairline,
              borderColor: glass.border.default,
              borderRadius: 12,
              overflow: "hidden",
            }}
          >
            <ScrollView nestedScrollEnabled>
              {filtered.map((c, rowIndex) => {
                const id = String(c._id);
                const selected = selectedIds.has(id);
                return (
                  <Pressable
                    key={id}
                    onPress={() => toggleSelect(id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      minHeight: 52,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderBottomWidth:
                        rowIndex === filtered.length - 1 ? 0 : borderWidth.hairline,
                      borderBottomColor: glass.border.divider,
                    }}
                  >
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={22}
                      color={selected ? glass.text.fg : glass.text.fg45}
                    />
                    <View style={{ minWidth: 0, flex: 1 }}>
                      <Text
                        style={{
                          fontFamily: APP_FONT_FAMILIES.sansMedium,
                          fontSize: 14,
                          color: glass.text.fg,
                        }}
                        numberOfLines={1}
                      >
                        {c.name}
                      </Text>
                      <Text
                        style={{
                          marginTop: 2,
                          fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                          fontSize: 9,
                          letterSpacing: ls(0.14, 9),
                          textTransform: "uppercase",
                          color: glass.text.fg55,
                        }}
                        numberOfLines={1}
                      >
                        {c.startDate} – {c.endDate}
                        {c.location ? ` · ${c.location}` : ""}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <Text
            style={{
              marginTop: 10,
              fontFamily: APP_FONT_FAMILIES.sansSemiBold,
              fontSize: 9,
              letterSpacing: ls(0.14, 9),
              textTransform: "uppercase",
              color: glass.text.fg55,
            }}
          >
            {t("conventions.bulkSelectedCount", { count: selectedIds.size })}
          </Text>

          {selectedIds.size > 0 ? (
            <View
              style={{
                marginTop: 14,
                flexDirection: "row",
                flexWrap: "wrap",
                gap: 8,
                borderTopWidth: borderWidth.hairline,
                borderTopColor: glass.border.divider,
                paddingTop: 14,
              }}
            >
              {filter !== "archived" ? (
                <PhotoPill
                  variant="outline"
                  size="sm"
                  disabled={bulkPending}
                  label={t("conventions.bulkArchive")}
                  onPress={() => void handleArchiveSelected(true)}
                />
              ) : (
                <PhotoPill
                  variant="outline"
                  size="sm"
                  disabled={bulkPending}
                  label={t("conventions.bulkUnarchive")}
                  onPress={() => void handleArchiveSelected(false)}
                />
              )}
              <Pressable
                onPress={confirmBulkDelete}
                disabled={bulkPending}
                accessibilityRole="button"
                style={{
                  minHeight: 34,
                  justifyContent: "center",
                  borderRadius: 999,
                  borderWidth: borderWidth.hairline,
                  borderColor: glass.text.danger,
                  paddingHorizontal: 16,
                  opacity: bulkPending ? 0.25 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    fontSize: 9,
                    letterSpacing: ls(0.16, 9),
                    textTransform: "uppercase",
                    color: glass.text.danger,
                  }}
                >
                  {t("conventions.bulkDelete")}
                </Text>
              </Pressable>
            </View>
          ) : null}

          <View style={{ marginTop: 18, alignItems: "center" }}>
            <PhotoPill
              variant="solid"
              label={t("conventions.bulkDone")}
              onPress={() => setBulkOpen(false)}
            />
          </View>
        </View>
      </GlassSheet>

      {deletedForUndo ? (
        <View
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: insets.bottom + 96,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            borderRadius: 14,
            borderWidth: borderWidth.hairline,
            borderColor: glass.border.overlay,
            backgroundColor: glass.fallback.overlay,
            paddingHorizontal: 16,
            paddingVertical: 12,
          }}
        >
          <Text
            style={{
              minWidth: 0,
              flex: 1,
              fontFamily: APP_FONT_FAMILIES.sansMedium,
              fontSize: 12,
              color: glass.text.fg,
            }}
          >
            {t("conventions.bulkUndoDeleted", { count: deletedForUndo.count })}
          </Text>
          <PhotoPill
            variant="text"
            size="sm"
            disabled={bulkPending}
            label={bulkPending ? t("conventions.bulkUndoing") : t("conventions.bulkUndoAction")}
            onPress={() => void handleUndoDelete()}
          />
        </View>
      ) : null}
    </View>
  );
}

const metricLabelStyle = {
  fontFamily: APP_FONT_FAMILIES.sansBold,
  fontSize: 9,
  letterSpacing: ls(0.2, 9),
  textTransform: "uppercase" as const,
  color: glass.text.fg,
  opacity: 0.6,
  marginBottom: 4,
};

function HeadlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text style={metricLabelStyle}>{label}</Text>
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansSemiBold,
          fontSize: 13,
          color: glass.text.fg,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function HeaderTextAction({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="active:opacity-80"
      style={{ minHeight: 44, justifyContent: "center" }}
    >
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansSemiBold,
          fontSize: 9,
          letterSpacing: ls(0.14, 9),
          textTransform: "uppercase",
          color: glass.text.fg70,
          borderBottomWidth: 1,
          borderBottomColor: glass.border.strong,
          paddingBottom: 2,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 44pt glass-outline icon pill (screen chrome). */
function IconPill({
  icon,
  onPress,
  accessibilityLabel,
  active = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel: string;
  active?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      className="active:opacity-80"
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: borderWidth.hairline,
        borderColor: active ? glass.border.strong : glass.border.overlay,
        backgroundColor: active ? glass.surface.overlay : glass.surface.bar,
      }}
    >
      <Ionicons name={icon} size={18} color={glass.text.fg} />
    </Pressable>
  );
}

function EmptyConventionState() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1, justifyContent: "center" }}>
      <PhotoBackdrop scrim="off" kenBurns={false} />
      <GlassEmptyState
        icon="calendar-outline"
        message={t("conventions.emptyTitle")}
        secondary={t("conventions.emptyBody")}
        action={
          <PhotoPill
            variant="solid"
            icon="add"
            label={t("conventions.createAction")}
            onPress={() => router.push(APP_HREF.conventionNew)}
          />
        }
      />
      <View style={{ position: "absolute", top: insets.top + 10, left: 10 }}>
        <MobileBackButton surface="glass" fallbackHref={APP_HREF.more} />
      </View>
    </View>
  );
}
