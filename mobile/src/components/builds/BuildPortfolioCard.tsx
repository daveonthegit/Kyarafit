import { Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, G } from "react-native-svg";
import type { Id } from "convex/_generated/dataModel";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { mediaOverlay, mediaOverlayTitleShadow } from "@/theme/mediaOverlayColors";
import { useDesignTheme } from "@/theme/useDesignTheme";

export type BuildPortfolioVariant = "comfortable" | "compact" | "grid";

export type BuildPortfolioCardModel = {
  name: string;
  character?: string | null;
  status: string;
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
  tasksTotal: number;
  tasksChecked: number;
};

function gradientStops(scheme: "light" | "dark"): [string, string, string] {
  return scheme === "dark"
    ? ["rgba(12, 11, 20, 0.08)", "rgba(12, 11, 20, 0.18)", "rgba(12, 11, 20, 0.84)"]
    : ["rgba(15, 12, 24, 0.04)", "rgba(15, 12, 24, 0.14)", "rgba(15, 12, 24, 0.72)"];
}

function CircularProgressRing({
  pct,
  size,
  strokeColor,
}: {
  pct: number;
  size: number;
  strokeColor: string;
}) {
  const clamped = Math.min(100, Math.max(0, pct));
  const r = 16;
  const cx = 18;
  const cy = 18;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 36 36">
        <Circle
          cx={cx}
          cy={cy}
          r={r}
          stroke={strokeColor}
          strokeOpacity={0.22}
          strokeWidth={2}
          fill="none"
        />
        <G transform={`rotate(-90 ${cx} ${cy})`}>
          <Circle
            cx={cx}
            cy={cy}
            r={r}
            stroke={strokeColor}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference}, ${circumference}`}
            strokeDashoffset={dashOffset}
          />
        </G>
      </Svg>
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansBold,
          position: "absolute",
          fontSize: Math.max(8, size * 0.225),
          color: strokeColor,
        }}
      >
        {clamped}
      </Text>
    </View>
  );
}

function statusLabel(status: string): string {
  return status.trim().toUpperCase();
}

export function BuildPortfolioCard({
  item,
  variant,
  projectIndex,
}: {
  item: BuildPortfolioCardModel;
  variant: BuildPortfolioVariant;
  /** 1-based index in the current (sorted, filtered) list — matches web “Project 001”. */
  projectIndex: number;
}) {
  const { scheme, colors } = useDesignTheme();
  const pct = item.tasksTotal > 0 ? Math.round((100 * item.tasksChecked) / item.tasksTotal) : 0;
  const projectNumber = String(projectIndex).padStart(3, "0");
  const overlayText = mediaOverlay.primary;
  const stops = gradientStops(scheme);

  const isCompact = variant === "compact";
  const isGrid = variant === "grid";

  const ringSize = isGrid ? 28 : isCompact ? 32 : 40;
  const titleClass = isGrid ? "text-xl leading-[24px]" : "text-[28px] leading-[30px]";
  const padX = isGrid ? 12 : isCompact ? 14 : 20;
  const padB = isGrid ? 12 : isCompact ? 14 : 20;
  const padT = isGrid ? 36 : isCompact ? 28 : 40;

  const posterBody = (
    <>
      {item.imageStorageId || item.imageUrl ? (
        <ConvexStorageImage
          storageId={item.imageStorageId}
          imageUrl={item.imageUrl}
          className="h-full w-full"
          accessibilityLabel={item.name}
        />
      ) : (
        <View className="h-full w-full items-center justify-center bg-kyar-muted dark:bg-kyar-dark-muted">
          <Text className="text-5xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
            ✦
          </Text>
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={stops}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View
        className="absolute inset-0 justify-end"
        style={{ paddingLeft: padX, paddingRight: padX, paddingBottom: padB, paddingTop: padT }}
      >
        <View className="flex-row items-end justify-between gap-2">
          <View className="min-w-0 flex-1">
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.sansBold,
                color: mediaOverlay.secondary,
                letterSpacing: isGrid ? 1.6 : 2,
                fontSize: isGrid ? 8 : 9,
                marginBottom: 4,
                textTransform: "uppercase",
              }}
            >
              Project {projectNumber}
            </Text>
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.displayItalic,
                color: overlayText,
                ...mediaOverlayTitleShadow,
              }}
              className={`${titleClass} font-normal tracking-tight`}
              numberOfLines={isGrid ? 2 : 2}
            >
              {item.name}
            </Text>
          </View>
          <CircularProgressRing pct={pct} size={ringSize} strokeColor={overlayText} />
        </View>

        <View className={`flex-row items-center gap-2 ${isGrid ? "mt-2 pt-1" : "mt-3 pt-1"}`}>
          <Text
            style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: overlayText }}
            className={`${isGrid ? "text-[9px]" : "text-[10px]"} uppercase tracking-widest opacity-90`}
          >
            {statusLabel(item.status)}
          </Text>
          {item.character ? (
            <>
              <View
                className="h-1 w-1 rounded-full"
                style={{ backgroundColor: mediaOverlay.muted }}
              />
              <Text
                style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: overlayText }}
                className={`${isGrid ? "text-[9px]" : "text-[10px]"} uppercase tracking-widest opacity-90`}
                numberOfLines={1}
              >
                {item.character}
              </Text>
            </>
          ) : null}
        </View>
      </View>
    </>
  );

  if (isCompact) {
    return (
      <View className="overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-muted shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-muted">
        <View className="h-[148px] flex-row">
          <View className="relative h-full w-[112px] overflow-hidden bg-kyar-muted dark:bg-kyar-dark-muted">
            {item.imageStorageId || item.imageUrl ? (
              <ConvexStorageImage
                storageId={item.imageStorageId}
                imageUrl={item.imageUrl}
                className="h-full w-full"
                accessibilityLabel={item.name}
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Text className="text-3xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  ✦
                </Text>
              </View>
            )}
            <LinearGradient
              pointerEvents="none"
              colors={stops}
              locations={[0, 0.55, 1]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
            />
          </View>
          <View className="h-[148px] min-w-0 flex-1 justify-between bg-kyar-surface py-3 pl-3 pr-4 dark:bg-kyar-dark-surface">
            <View className="min-w-0">
              <Text
                style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: colors.text }}
                className="text-[9px] uppercase tracking-[0.2em] opacity-70"
              >
                Project {projectNumber}
              </Text>
              <Text
                style={{ fontFamily: APP_FONT_FAMILIES.displayItalic, color: colors.text }}
                className="mt-1 text-[22px] leading-[26px]"
                numberOfLines={2}
              >
                {item.name}
              </Text>
            </View>
            <View className="mt-3 flex-row items-end justify-between gap-2">
              <View className="min-w-0 flex-1">
                <Text
                  style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: colors.textSecondary }}
                  className="text-[10px] uppercase tracking-widest"
                >
                  {statusLabel(item.status)}
                  {item.character ? ` · ${item.character}` : ""}
                </Text>
              </View>
              <CircularProgressRing pct={pct} size={32} strokeColor={colors.text} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-muted shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-muted">
      <View className="relative aspect-[3/4] w-full">{posterBody}</View>
    </View>
  );
}
