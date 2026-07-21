import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { Doc, Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { useOfflineQuery } from "@/offline";
import {
  enumerateConventionDays,
  formatLongDateLabel,
  type ConventionWithDetails,
} from "@/screens/conventions/utils";
import { DataBoundary } from "@/ui";
import { GlassPanel, PhotoBackdrop } from "@/ui/glass";

type Ready = {
  conventions: ConventionWithDetails[];
  builds: (Doc<"builds"> & {
    tasksTotal: number;
    tasksChecked: number;
    workflowProgressPercent: number;
    packingProgressPercent?: number;
    nodeProgressPercent?: number;
    totalCostCents: number;
  })[];
};

export default function ItineraryScreen() {
  const { t } = useTranslation();
  const identity = useOfflineQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const conventions = useOfflineQuery(
    api.conventions.listWithDetails,
    userId ? { userId } : "skip"
  );
  const builds = useOfflineQuery(api.builds.list, userId ? { userId } : "skip");

  const loading =
    identity === undefined ||
    (userId != null && (conventions === undefined || builds === undefined));
  const error = identity === null ? new Error(t("builds.loadError")) : undefined;

  let status: "loading" | "error" | "empty" | "ready";
  if (loading) status = "loading";
  else if (error) status = "error";
  else if (!userId || !conventions || !builds || conventions.length === 0) status = "empty";
  else status = "ready";

  const data: Ready | undefined =
    status === "ready" && conventions && builds
      ? { conventions: conventions as ConventionWithDetails[], builds }
      : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t("conventions.itineraryTitle"), headerShown: true }} />
      <DataBoundary status={status} data={data} error={error}>
        {(loaded) => <ItineraryBody {...loaded} />}
      </DataBoundary>
    </>
  );
}

function metaTextStyle(size: number, tracking: number, color: string) {
  return {
    fontFamily: APP_FONT_FAMILIES.sansBold,
    fontSize: size,
    letterSpacing: ls(tracking, size),
    textTransform: "uppercase" as const,
    color,
  };
}

function ItineraryBody({ conventions, builds }: Ready) {
  const { t } = useTranslation();
  const router = useRouter();

  const rows = conventions
    .filter((convention) => convention.archived !== true)
    .flatMap((convention) =>
      enumerateConventionDays(convention.startDate, convention.endDate).map((date) => {
        const dayPlan = convention.plans.find((entry) => entry.date === date);
        const build = dayPlan?.buildId
          ? builds.find((item) => item._id === (dayPlan.buildId as Id<"builds">))
          : null;
        return {
          key: `${convention._id}-${date}`,
          date,
          convention,
          build,
        };
      })
    )
    .sort((left, right) => left.date.localeCompare(right.date));

  return (
    <View style={{ flex: 1 }}>
      {/* No photo — falls back to the studio wall. */}
      <PhotoBackdrop scrim="off" kenBurns={false} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 48 }}
      >
        <View style={{ paddingHorizontal: 22 }}>
          <Text style={metaTextStyle(9, 0.26, glass.text.fg70)}>{t("nav.events")}</Text>
          <Text
            style={{
              marginTop: 8,
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontStyle: "italic",
              fontSize: 34,
              lineHeight: 38,
              color: glass.text.fg,
            }}
          >
            {t("conventions.itineraryTitle")}
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontFamily: APP_FONT_FAMILIES.sansRegular,
              fontSize: 13,
              lineHeight: 19,
              color: glass.text.fg70,
            }}
          >
            {t("conventions.itinerarySubtitle")}
          </Text>
        </View>

        <View style={{ marginTop: 18, paddingHorizontal: 16 }}>
          <GlassPanel>
            {rows.map((row, index) => (
              <Pressable
                key={row.key}
                onPress={() => router.push(APP_HREF.convention(row.convention._id))}
                accessibilityRole="button"
                className="active:opacity-80"
                style={{
                  minHeight: 44,
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                  borderTopWidth: index === 0 ? 0 : borderWidth.hairline,
                  borderTopColor: glass.border.divider,
                }}
              >
                <Text style={metaTextStyle(9, 0.2, glass.text.fg55)}>
                  {`${formatLongDateLabel(row.date)}${
                    row.convention.location ? ` · ${row.convention.location}` : ""
                  }`}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 5,
                    fontFamily: APP_FONT_FAMILIES.displayItalic,
                    fontStyle: "italic",
                    fontSize: 20,
                    lineHeight: 24,
                    color: glass.text.fg,
                  }}
                >
                  {row.convention.name}
                </Text>
                {/* Sentence-case body — the day's build is content, not meta (QA-4). */}
                <Text
                  numberOfLines={1}
                  style={{
                    marginTop: 5,
                    fontFamily: APP_FONT_FAMILIES.sansRegular,
                    fontSize: 13,
                    lineHeight: 18,
                    color: row.build ? glass.text.fg : glass.text.fg55,
                  }}
                >
                  {row.build?.name ?? t("conventions.restDay")}
                </Text>
              </Pressable>
            ))}
          </GlassPanel>
        </View>
      </ScrollView>
    </View>
  );
}
