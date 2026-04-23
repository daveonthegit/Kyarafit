import type { ReactNode } from "react";
import { Text, View } from "react-native";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { LinearGradient } from "expo-linear-gradient";
import type { Id } from "convex/_generated/dataModel";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { overlayCountdownLabel } from "@/screens/conventions/utils";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { mediaOverlay, mediaOverlayTitleShadow } from "@/theme/mediaOverlayColors";
import { useDesignTheme } from "@/theme/useDesignTheme";

function gradientStops(scheme: "light" | "dark"): [string, string, string] {
  return scheme === "dark"
    ? ["rgba(12, 11, 20, 0.06)", "rgba(12, 11, 20, 0.35)", "rgba(12, 11, 20, 0.82)"]
    : ["rgba(15, 12, 24, 0.04)", "rgba(15, 12, 24, 0.28)", "rgba(15, 12, 24, 0.82)"];
}

export type ConventionEventPosterProps = {
  name: string;
  startDate: string;
  endDate: string;
  location?: string | null;
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
  plannedBuilds: number;
  packingChecked: number;
  packingTotal: number;
  /** Optional third metric (e.g. day count) — detail screen only */
  daysCount?: number;
  metricBuildsLabel: string;
  metricPackingLabel: string;
  metricDaysLabel: string;
  /** Rendered top-right over the image (e.g. Edit) */
  topAccessory?: ReactNode;
};

export function ConventionEventPoster({
  name,
  startDate,
  endDate,
  location,
  imageStorageId,
  imageUrl,
  plannedBuilds,
  packingChecked,
  packingTotal,
  daysCount,
  metricBuildsLabel,
  metricPackingLabel,
  metricDaysLabel,
  topAccessory,
}: ConventionEventPosterProps) {
  const { scheme, colors } = useDesignTheme();
  const overlayText = mediaOverlay.primary;
  const stops = gradientStops(scheme);

  const hasImage = imageStorageId != null || imageUrl != null;
  const dateLine =
    startDate === endDate ? startDate : `${startDate} – ${endDate}`;
  const countdownLabel = overlayCountdownLabel(startDate, endDate);

  const locationUpper = (location?.trim() || "No location").toUpperCase();

  const showDays = daysCount != null;

  return (
    <View className="overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-muted shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-muted">
      <View className="relative w-full" style={{ aspectRatio: 16 / 9 }}>
        {hasImage ? (
          <ConvexStorageImage
            storageId={imageStorageId}
            imageUrl={imageUrl}
            className="absolute inset-0 h-full w-full"
            accessibilityLabel={name}
          />
        ) : (
          <View className="absolute inset-0 items-center justify-center bg-kyar-muted dark:bg-kyar-dark-muted">
            <MaterialIcons name="calendar-today" size={56} color={colors.textTertiary} />
          </View>
        )}
        <LinearGradient
          pointerEvents="none"
          colors={stops}
          locations={[0, 0.38, 1]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
        />

        {topAccessory ? (
          <View className="absolute right-4 top-4 z-10">{topAccessory}</View>
        ) : null}

        <View className="absolute inset-0 justify-end p-5">
          <View className="min-w-0">
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.sansBold,
                color: mediaOverlay.secondary,
                letterSpacing: 2,
                fontSize: 9,
                marginBottom: 6,
              }}
            >
              {dateLine.toUpperCase()}
            </Text>
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.displayItalic,
                color: overlayText,
                ...mediaOverlayTitleShadow,
              }}
              className="text-[26px] leading-[30px] font-normal tracking-tight"
              numberOfLines={2}
            >
              {name}
            </Text>
          </View>

          <View className="mt-3 flex-row flex-wrap items-center gap-x-3 gap-y-1">
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.sansBold,
                color: mediaOverlay.secondary,
                fontSize: 10,
                letterSpacing: 2,
                textTransform: "uppercase",
                maxWidth: "85%",
              }}
              numberOfLines={1}
            >
              {locationUpper}
            </Text>
            {countdownLabel ? (
              <>
                <View
                  className="h-1 w-1 rounded-full"
                  style={{ backgroundColor: mediaOverlay.muted }}
                />
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    color: mediaOverlay.primary,
                    fontSize: 10,
                    letterSpacing: 2,
                    textTransform: "uppercase",
                  }}
                >
                  {countdownLabel}
                </Text>
              </>
            ) : null}
          </View>

          <View
            className={`mt-3 flex-row items-end ${showDays ? "justify-between gap-2" : "justify-between gap-3"} border-t border-white/15 pt-3`}
          >
            <View className={showDays ? "min-w-0 flex-1" : undefined}>
              <Text
                style={{
                  fontFamily: APP_FONT_FAMILIES.sansBold,
                  color: mediaOverlay.tertiary,
                  fontSize: 9,
                  letterSpacing: 3.6,
                  textTransform: "uppercase",
                }}
              >
                {metricBuildsLabel}
              </Text>
              <Text
                style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: overlayText }}
                className="mt-1 text-lg"
              >
                {plannedBuilds}
              </Text>
            </View>
            <View className={showDays ? "min-w-0 flex-1 items-center" : "items-end"}>
              <Text
                style={{
                  fontFamily: APP_FONT_FAMILIES.sansBold,
                  color: mediaOverlay.tertiary,
                  fontSize: 9,
                  letterSpacing: 3.6,
                  textTransform: "uppercase",
                }}
              >
                {metricPackingLabel}
              </Text>
              <Text
                style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: overlayText }}
                className="mt-1 text-lg"
              >
                {`${packingChecked}/${packingTotal}`}
              </Text>
            </View>
            {showDays ? (
              <View className="min-w-0 flex-1 items-end">
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    color: mediaOverlay.tertiary,
                    fontSize: 9,
                    letterSpacing: 3.6,
                    textTransform: "uppercase",
                  }}
                >
                  {metricDaysLabel}
                </Text>
                <Text
                  style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: overlayText }}
                  className="mt-1 text-lg"
                >
                  {daysCount}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}
