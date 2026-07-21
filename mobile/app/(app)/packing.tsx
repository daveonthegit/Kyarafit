import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { useOfflineQuery } from "@/offline";
import {
  countPackingProgress,
  countPlannedBuilds,
  formatDateRange,
  type ConventionWithDetails,
} from "@/screens/conventions/utils";
import { DataBoundary } from "@/ui";
import { GlassPanel, PhotoBackdrop } from "@/ui/glass";

type Ready = { conventions: ConventionWithDetails[] };

export default function PackingOverviewScreen() {
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
      <Stack.Screen options={{ title: t("conventions.crossPackingTitle"), headerShown: true }} />
      <DataBoundary status={status} data={data} error={error}>
        {(loaded) => <PackingOverviewBody conventions={loaded.conventions} />}
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

function PackingOverviewBody({ conventions }: Ready) {
  const { t } = useTranslation();
  const router = useRouter();
  const activeConventions = conventions.filter((convention) => convention.archived !== true);

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
            {t("conventions.crossPackingTitle")}
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
            {t("conventions.crossPackingSubtitle")}
          </Text>
        </View>

        <View style={{ marginTop: 18, paddingHorizontal: 16 }}>
          <GlassPanel>
            {activeConventions.map((convention, index) => {
              const progress = countPackingProgress(convention.packing);
              const plannedBuilds = countPlannedBuilds(convention.plans);
              const pct =
                progress.total > 0 ? Math.round((100 * progress.checked) / progress.total) : 0;
              return (
                <Pressable
                  key={convention._id}
                  onPress={() => router.push(APP_HREF.conventionPacking(convention._id))}
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
                    {`${formatDateRange(convention.startDate, convention.endDate)}${
                      convention.location ? ` · ${convention.location}` : ""
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
                    {convention.name}
                  </Text>
                  <View
                    style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12 }}
                  >
                    <View
                      style={{
                        height: 2,
                        flex: 1,
                        borderRadius: 1,
                        backgroundColor: glass.border.default,
                        overflow: "hidden",
                      }}
                    >
                      <View
                        style={{
                          height: 2,
                          width: `${pct}%`,
                          borderRadius: 1,
                          backgroundColor: glass.surface.solid,
                        }}
                      />
                    </View>
                    <Text style={metaTextStyle(9, 0.16, glass.text.fg55)}>
                      {t("conventions.packedCountMeta", {
                        defaultValue: "{{checked}} / {{total}} packed",
                        checked: progress.checked,
                        total: progress.total,
                      })}
                    </Text>
                  </View>
                  <Text style={[metaTextStyle(9, 0.16, glass.text.fg55), { marginTop: 6 }]}>
                    {`${t("conventions.metricBuilds")} · ${plannedBuilds}`}
                  </Text>
                </Pressable>
              );
            })}
          </GlassPanel>
        </View>
      </ScrollView>
    </View>
  );
}
