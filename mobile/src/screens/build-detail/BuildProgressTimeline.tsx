import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import type { Doc, Id } from "convex/_generated/dataModel";
import { can, normalizeTier } from "@kyarafit/design-system/domain/entitlements";
import { sortProgressUpdates } from "@kyarafit/design-system/domain/mediaGallery";
import { borderWidth, glass } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { useOfflineMutation, useOfflineQuery } from "@/offline";
import { useTier } from "@/lib/useTier";
import { GlassStatusChip, GlassTextField } from "@/ui/glass";
import { GlassBody, GlassMeta, GlassSolidButton } from "./glassAtoms";

/**
 * Build "Progress updates" timeline (PRODUCT_SPEC.md §4.3 REQ-049, AC-07; DESIGN_SYSTEM.md §5).
 *
 * A dated, newest-first log of build progress. Adding an entry is FREE and shows at the top of the
 * timeline immediately (optimistic, offline-capable for the owner). Publishing an update to the
 * social feed is PAID (REQ-018): free users see a non-blocking upgrade hint and the entry stays
 * local. Ordering is delegated to the shared pure `sortProgressUpdates` so web/mobile stay at parity.
 *
 * Glass Studio 7.2: light-on-glass restyle only — renders inside the build
 * detail work panel, so all surfaces are plain token colors (no nested blur).
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

const TIMELINE_CARD = {
  borderRadius: 12,
  borderWidth: borderWidth.hairline,
  borderColor: glass.border.divider,
  backgroundColor: glass.surface.field,
} as const;

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
    <View style={{ gap: 16 }}>
      <View style={{ gap: 14 }}>
        <View>
          <GlassMeta size={9} tone="fg55">
            {t("buildDetail.progressUpdatesLabel", { defaultValue: "Timeline" })}
          </GlassMeta>
          <Text
            style={{
              marginTop: 4,
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontStyle: "italic",
              fontSize: 24,
              color: glass.text.fg,
            }}
          >
            {t("buildDetail.progressUpdatesTitle", { defaultValue: "Progress updates" })}
          </Text>
        </View>

        <View style={{ gap: 10 }}>
          <GlassTextField
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
          />
          <GlassTextField
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
          />

          <Pressable
            onPress={onTogglePublish}
            accessibilityRole="switch"
            accessibilityState={{ checked: publish, disabled: false }}
            accessibilityLabel={t("buildDetail.progressUpdatePublishLabel", {
              defaultValue: "Publish update to social feed",
            })}
            style={[
              TIMELINE_CARD,
              {
                minHeight: 44,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
              },
            ]}
          >
            <GlassBody size={13} tone="fg" style={{ minWidth: 0, flex: 1 }}>
              {t("buildDetail.progressUpdatePublish", { defaultValue: "Publish to feed" })}
            </GlassBody>
            <View
              style={{
                height: 24,
                width: 44,
                justifyContent: "center",
                borderRadius: 12,
                paddingHorizontal: 2,
                backgroundColor: publish ? glass.surface.solid : glass.surface.bar,
                borderWidth: publish ? 0 : 1,
                borderColor: glass.border.default,
              }}
            >
              <View
                style={{
                  height: 18,
                  width: 18,
                  borderRadius: 9,
                  alignSelf: publish ? "flex-end" : "flex-start",
                  backgroundColor: publish ? glass.text.ink : glass.text.fg70,
                }}
              />
            </View>
          </Pressable>

          {!canPublish && showUpgradeHint ? (
            <View style={[TIMELINE_CARD, { paddingHorizontal: 12, paddingVertical: 10 }]}>
              <GlassBody size={13} tone="fg70" accessibilityRole="alert">
                {t("buildDetail.progressUpdatePublishUpgrade", {
                  defaultValue:
                    "Publishing updates to the feed is a paid feature. This update will stay private on your timeline.",
                })}
              </GlassBody>
            </View>
          ) : null}

          {error ? (
            <GlassBody size={13} tone="danger">
              {error}
            </GlassBody>
          ) : null}

          <GlassSolidButton
            label={
              busy
                ? t("buildDetail.progressUpdateAdding", { defaultValue: "Adding…" })
                : t("buildDetail.progressUpdateAdd", { defaultValue: "Add update" })
            }
            onPress={() => void onSubmit()}
            disabled={!canSubmit}
            accessibilityState={{ disabled: !canSubmit }}
            accessibilityLabel={t("buildDetail.progressUpdateAddLabel", {
              defaultValue: "Add progress update",
            })}
          />
        </View>
      </View>

      {loading ? (
        <View style={{ alignItems: "center", paddingVertical: 40 }}>
          <ActivityIndicator color={glass.text.fg70} />
        </View>
      ) : timeline.length === 0 ? (
        <View
          style={[
            TIMELINE_CARD,
            { alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 36 },
          ]}
        >
          <GlassBody size={14} tone="fg" semiBold style={{ textAlign: "center" }}>
            {t("buildDetail.progressUpdatesEmptyTitle", {
              defaultValue: "No progress updates yet",
            })}
          </GlassBody>
          <GlassBody size={13} tone="fg55" style={{ textAlign: "center" }}>
            {t("buildDetail.progressUpdatesEmptyBody", {
              defaultValue: "Add your first progress update to start your timeline.",
            })}
          </GlassBody>
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {timeline.map((update, index) => (
            <View
              key={update.id ?? (update._id as string)}
              style={[TIMELINE_CARD, { gap: 8, paddingHorizontal: 14, paddingVertical: 14 }]}
            >
              <View
                accessibilityRole="text"
                accessibilityLabel={t("buildDetail.progressUpdateEntryLabel", {
                  defaultValue: "Progress update",
                })}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <GlassMeta size={9} tone="fg55">
                  {formatTimelineDate(update.createdAt)}
                </GlassMeta>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  {typeof update.progressPercent === "number" ? (
                    <GlassStatusChip
                      tone="neutral"
                      label={t("buildDetail.progressUpdatePercentBadge", {
                        defaultValue: `${Math.round(update.progressPercent)}%`,
                        pct: Math.round(update.progressPercent),
                      })}
                    />
                  ) : null}
                  {update.publishedToFeed ? (
                    <GlassStatusChip
                      tone="active"
                      label={t("buildDetail.progressUpdatePublished", {
                        defaultValue: "Published",
                      })}
                    />
                  ) : null}
                </View>
              </View>

              {update.note ? (
                <GlassBody size={13} tone="fg70" testID={`progress-update-note-${index}`}>
                  {update.note}
                </GlassBody>
              ) : null}

              {(update.imageRefs?.length ?? 0) > 0 ? (
                <GlassMeta size={9} tone="fg55">
                  {t("buildDetail.progressUpdatePhotoCount", {
                    defaultValue: `${update.imageRefs?.length ?? 0} photo(s)`,
                    count: update.imageRefs?.length ?? 0,
                  })}
                </GlassMeta>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
