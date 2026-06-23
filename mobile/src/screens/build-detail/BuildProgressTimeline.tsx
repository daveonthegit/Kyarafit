import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { can, normalizeTier } from "@kyarafit/design-system/domain/entitlements";
import { sortProgressUpdates } from "@kyarafit/design-system/domain/mediaGallery";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import { useTier } from "@/lib/useTier";
import { MetaLabel, SurfaceCard } from "@/ui";

/**
 * Build "Progress updates" timeline (PRODUCT_SPEC.md §4.3 REQ-049, AC-07; DESIGN_SYSTEM.md §5).
 *
 * A dated, newest-first log of build progress. Adding an entry is FREE and shows at the top of the
 * timeline immediately (optimistic, offline-capable for the owner). Publishing an update to the
 * social feed is PAID (REQ-018): free users see a non-blocking upgrade hint and the entry stays
 * local. Ordering is delegated to the shared pure `sortProgressUpdates` so web/mobile stay at parity.
 */

type ProgressUpdateRow = Doc<"buildProgressUpdates"> & { id: string };

type Props = {
  buildId: Id<"builds">;
  userId: string;
};

function formatTimelineDate(epochMs: number): string {
  try {
    return new Date(epochMs).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return new Date(epochMs).toISOString().slice(0, 10);
  }
}

function parseProgressPercent(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return undefined;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed)) return undefined;
  return Math.max(0, Math.min(100, parsed));
}

export function BuildProgressTimeline({ buildId, userId }: Props) {
  const { t } = useTranslation();

  const updates = useOfflineQuery(api.buildProgressUpdates.listByBuild, { buildId, userId });
  const addUpdate = useOfflineMutation(api.buildProgressUpdates.add);

  const tierInfo = useTier(userId);
  const tier = normalizeTier(tierInfo.data?.tier);
  const canPublish = can(tier, "social_post");

  const [note, setNote] = useState("");
  const [percentText, setPercentText] = useState("");
  const [publish, setPublish] = useState(false);
  const [showUpgradeHint, setShowUpgradeHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<ProgressUpdateRow[]>([]);

  const timeline = useMemo<ProgressUpdateRow[]>(() => {
    const server = (updates ?? []) as ProgressUpdateRow[];
    const byId = new Map<string, ProgressUpdateRow>();
    for (const row of server) byId.set(row.id ?? (row._id as string), row);
    for (const row of optimistic) {
      const key = row.id ?? (row._id as string);
      if (!byId.has(key)) byId.set(key, row);
    }
    return sortProgressUpdates([...byId.values()]);
  }, [updates, optimistic]);

  const loading = updates === undefined;
  const percent = parseProgressPercent(percentText);
  const canSubmit = !busy && (note.trim().length > 0 || percent !== undefined);

  const onTogglePublish = useCallback(() => {
    if (!canPublish) {
      // Non-blocking: surface an upgrade hint but never enable publishing for free users.
      setShowUpgradeHint(true);
      setPublish(false);
      return;
    }
    setShowUpgradeHint(false);
    setPublish((value) => !value);
  }, [canPublish]);

  const onSubmit = useCallback(async () => {
    const trimmedNote = note.trim();
    const parsedPercent = parseProgressPercent(percentText);
    if (busy || (trimmedNote.length === 0 && parsedPercent === undefined)) return;

    setBusy(true);
    setError(null);
    const willPublish = canPublish && publish;
    try {
      const created = (await addUpdate({
        buildId,
        userId,
        note: trimmedNote.length > 0 ? trimmedNote : undefined,
        progressPercent: parsedPercent,
        publish: willPublish ? true : undefined,
      })) as Doc<"buildProgressUpdates"> | null | undefined;

      const createdAt = created?.createdAt ?? Date.now();
      const optimisticId =
        (created?._id as string | undefined) ?? `local-${createdAt}-${Math.random()}`;
      const row: ProgressUpdateRow = {
        ...(created ?? {}),
        _id: (created?._id ?? optimisticId) as Id<"buildProgressUpdates">,
        id: optimisticId,
        buildId,
        userId,
        createdAt,
        note: trimmedNote.length > 0 ? trimmedNote : undefined,
        imageRefs: created?.imageRefs ?? [],
        progressPercent: parsedPercent,
        publishedToFeed: created?.publishedToFeed ?? willPublish,
      } as ProgressUpdateRow;

      setOptimistic((prev) => [row, ...prev]);
      setNote("");
      setPercentText("");
      setPublish(false);
      setShowUpgradeHint(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [addUpdate, buildId, busy, canPublish, note, percentText, publish, userId]);

  return (
    <View className="gap-4">
      <SurfaceCard className="gap-4 px-4 py-4">
        <View>
          <MetaLabel>
            {t("buildDetail.progressUpdatesLabel", { defaultValue: "Timeline" })}
          </MetaLabel>
          <Text className="mt-1 font-serif text-2xl italic text-kyar-text dark:text-kyar-dark-text">
            {t("buildDetail.progressUpdatesTitle", { defaultValue: "Progress updates" })}
          </Text>
        </View>

        <View className="gap-3">
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            editable={!busy}
            placeholder={t("buildDetail.progressUpdateNotePlaceholder", {
              defaultValue: "What did you work on?",
            })}
            accessibilityLabel={t("buildDetail.progressUpdateNoteLabel", {
              defaultValue: "Progress update note",
            })}
            className="min-h-[44px] rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
          />
          <TextInput
            value={percentText}
            onChangeText={setPercentText}
            keyboardType="number-pad"
            editable={!busy}
            placeholder={t("buildDetail.progressUpdatePercentPlaceholder", {
              defaultValue: "Progress % (optional)",
            })}
            accessibilityLabel={t("buildDetail.progressUpdatePercentLabel", {
              defaultValue: "Progress percent",
            })}
            className="min-h-[44px] rounded-2xl border border-kyar-borderSubtle bg-kyar-panel px-4 py-3 text-base text-kyar-text dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel dark:text-kyar-dark-text"
          />

          <Pressable
            onPress={onTogglePublish}
            accessibilityRole="switch"
            accessibilityState={{ checked: publish, disabled: false }}
            accessibilityLabel={t("buildDetail.progressUpdatePublishLabel", {
              defaultValue: "Publish update to social feed",
            })}
            className="min-h-[44px] flex-row items-center justify-between gap-3 rounded-2xl border border-kyar-borderSubtle px-4 py-3 dark:border-kyar-dark-borderSubtle"
          >
            <Text className="min-w-0 flex-1 text-sm text-kyar-text dark:text-kyar-dark-text">
              {t("buildDetail.progressUpdatePublish", { defaultValue: "Publish to feed" })}
            </Text>
            <View
              className={`h-6 w-11 justify-center rounded-full px-0.5 ${
                publish
                  ? "bg-kyar-text dark:bg-kyar-dark-text"
                  : "bg-kyar-panelRaised dark:bg-kyar-dark-panelRaised"
              }`}
            >
              <View
                className={`h-5 w-5 rounded-full bg-kyar-bg dark:bg-kyar-dark-bg ${
                  publish ? "self-end" : "self-start"
                }`}
              />
            </View>
          </Pressable>

          {!canPublish && showUpgradeHint ? (
            <Text
              accessibilityRole="alert"
              className="rounded-2xl bg-kyar-panel px-4 py-3 text-sm leading-5 text-kyar-textSecondary dark:bg-kyar-dark-panel dark:text-kyar-dark-textSecondary"
            >
              {t("buildDetail.progressUpdatePublishUpgrade", {
                defaultValue:
                  "Publishing updates to the feed is a paid feature. This update will stay private on your timeline.",
              })}
            </Text>
          ) : null}

          {error ? (
            <Text className="text-sm text-kyar-danger dark:text-kyar-dark-danger">{error}</Text>
          ) : null}

          <Pressable
            onPress={() => void onSubmit()}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit }}
            accessibilityLabel={t("buildDetail.progressUpdateAddLabel", {
              defaultValue: "Add progress update",
            })}
            className="min-h-[44px] items-center justify-center rounded-full bg-kyar-text py-3 disabled:opacity-40 dark:bg-kyar-dark-text"
          >
            <Text className="text-sm font-semibold text-kyar-bg dark:text-kyar-dark-bg">
              {busy
                ? t("buildDetail.progressUpdateAdding", { defaultValue: "Adding…" })
                : t("buildDetail.progressUpdateAdd", { defaultValue: "Add update" })}
            </Text>
          </Pressable>
        </View>
      </SurfaceCard>

      {loading ? (
        <View className="items-center py-10">
          <ActivityIndicator />
        </View>
      ) : timeline.length === 0 ? (
        <SurfaceCard className="items-center gap-2 px-4 py-10">
          <Text className="text-center text-base font-semibold text-kyar-text dark:text-kyar-dark-text">
            {t("buildDetail.progressUpdatesEmptyTitle", {
              defaultValue: "No progress updates yet",
            })}
          </Text>
          <Text className="text-center text-sm leading-5 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("buildDetail.progressUpdatesEmptyBody", {
              defaultValue: "Add your first progress update to start your timeline.",
            })}
          </Text>
        </SurfaceCard>
      ) : (
        <View className="gap-3">
          {timeline.map((update, index) => (
            <SurfaceCard key={update.id ?? (update._id as string)} className="gap-2 px-4 py-4">
              <View
                accessibilityRole="text"
                accessibilityLabel={t("buildDetail.progressUpdateEntryLabel", {
                  defaultValue: "Progress update",
                })}
                className="flex-row items-center justify-between gap-3"
              >
                <MetaLabel>{formatTimelineDate(update.createdAt)}</MetaLabel>
                <View className="flex-row items-center gap-2">
                  {typeof update.progressPercent === "number" ? (
                    <View className="rounded-full bg-kyar-panel px-3 py-1 dark:bg-kyar-dark-panel">
                      <Text className="text-[10px] font-semibold uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                        {t("buildDetail.progressUpdatePercentBadge", {
                          defaultValue: `${Math.round(update.progressPercent)}%`,
                          pct: Math.round(update.progressPercent),
                        })}
                      </Text>
                    </View>
                  ) : null}
                  {update.publishedToFeed ? (
                    <View className="rounded-full bg-kyar-text px-3 py-1 dark:bg-kyar-dark-text">
                      <Text className="text-[10px] font-semibold uppercase tracking-widest text-kyar-bg dark:text-kyar-dark-bg">
                        {t("buildDetail.progressUpdatePublished", { defaultValue: "Published" })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              {update.note ? (
                <Text
                  testID={`progress-update-note-${index}`}
                  className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                >
                  {update.note}
                </Text>
              ) : null}

              {(update.imageRefs?.length ?? 0) > 0 ? (
                <Text className="text-[10px] uppercase tracking-widest text-kyar-meta dark:text-kyar-dark-meta">
                  {t("buildDetail.progressUpdatePhotoCount", {
                    defaultValue: `${update.imageRefs?.length ?? 0} photo(s)`,
                    count: update.imageRefs?.length ?? 0,
                  })}
                </Text>
              ) : null}
            </SurfaceCard>
          ))}
        </View>
      )}
    </View>
  );
}
