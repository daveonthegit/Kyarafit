import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, G } from "react-native-svg";
import type { Id } from "convex/_generated/dataModel";
import type { CosplayNodeType } from "@kyarafit/design-system/types";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { mediaOverlay, mediaOverlayTitleShadow } from "@/theme/mediaOverlayColors";
import { useDesignTheme } from "@/theme/useDesignTheme";

export type ElementPortfolioVariant = "comfortable" | "compact" | "grid";

export type ElementPortfolioCardModel = {
  name: string;
  category?: string | null;
  imageStorageId?: string | null;
  imageUrl?: string | null;
  nodeType: CosplayNodeType;
  progressPercent: number;
  childCount: number;
  typeBadge: string;
  statusBadge: string;
};

function gradientStops(scheme: "light" | "dark"): [string, string, string] {
  return scheme === "dark"
    ? ["rgba(12, 11, 20, 0.08)", "rgba(12, 11, 20, 0.22)", "rgba(12, 11, 20, 0.88)"]
    : ["rgba(15, 12, 24, 0.06)", "rgba(15, 12, 24, 0.18)", "rgba(15, 12, 24, 0.82)"];
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

function Badge({ children }: { children: string }) {
  return (
    <View
      className="rounded-full px-2.5 py-1"
      style={{
        borderWidth: 1,
        borderColor: "rgba(255, 253, 248, 0.28)",
        backgroundColor: "rgba(0, 0, 0, 0.42)",
      }}
    >
      <Text
        style={{
          fontFamily: APP_FONT_FAMILIES.sansBold,
          color: mediaOverlay.primary,
          fontSize: 9,
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export function ElementPortfolioCard({
  item,
  variant,
  progressLabel,
  childrenLabel,
}: {
  item: ElementPortfolioCardModel;
  variant: ElementPortfolioVariant;
  /** e.g. "72% progress" */
  progressLabel: string;
  /** e.g. "0 children" */
  childrenLabel: string;
}) {
  const { scheme, colors } = useDesignTheme();
  const stops = gradientStops(scheme);
  const overlayText = mediaOverlay.primary;
  const pct = Math.min(100, Math.max(0, item.progressPercent));

  const isCompact = variant === "compact";
  const isGrid = variant === "grid";

  const ringSize = isGrid ? 28 : isCompact ? 30 : 36;
  const titleClass = isGrid ? "text-xl leading-[24px]" : "text-[26px] leading-[30px]";
  const padX = isGrid ? 12 : isCompact ? 14 : 16;
  const padB = isGrid ? 14 : isCompact ? 14 : 16;
  const padT = isGrid ? 40 : isCompact ? 28 : 48;
  const categoryUpper = (item.category?.trim() || "uncategorized").toUpperCase();

  const placeholderIcon =
    item.nodeType === "material" ? ("flask-outline" as const) : ("shirt-outline" as const);

  const posterBody = (
    <>
      {item.imageStorageId || item.imageUrl ? (
        <ConvexStorageImage
          storageId={item.imageStorageId as Id<"_storage"> | undefined}
          imageUrl={item.imageUrl}
          className="h-full w-full"
          accessibilityLabel={item.name}
        />
      ) : (
        <View className="h-full w-full items-center justify-center bg-kyar-mutedWarm dark:bg-kyar-dark-muted">
          <Ionicons name={placeholderIcon} size={52} color={colors.textTertiary} />
        </View>
      )}
      <LinearGradient
        pointerEvents="none"
        colors={stops}
        locations={[0, 0.42, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }}
      />
      <View className="absolute left-3 top-3 z-10 flex-row flex-wrap gap-2">
        <Badge>{item.typeBadge.toUpperCase()}</Badge>
        <Badge>{item.statusBadge.toUpperCase()}</Badge>
      </View>
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
                letterSpacing: isGrid ? 1.4 : 2,
                fontSize: isGrid ? 8 : 9,
                marginBottom: 6,
              }}
            >
              {categoryUpper}
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

        <View className={`flex-row items-center justify-between ${isGrid ? "mt-3" : "mt-4"}`}>
          <Text
            style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: overlayText }}
            className={`${isGrid ? "text-[9px]" : "text-[10px]"} uppercase tracking-widest opacity-85`}
          >
            {progressLabel}
          </Text>
          <Text
            style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: overlayText }}
            className={`${isGrid ? "text-[9px]" : "text-[10px]"} uppercase tracking-widest opacity-85`}
            numberOfLines={1}
          >
            {childrenLabel}
          </Text>
        </View>
      </View>
    </>
  );

  if (isCompact) {
    return (
      <View className="overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-mutedWarm shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-muted">
        <View className="h-[148px] flex-row">
          <View className="relative h-full w-[112px] overflow-hidden bg-kyar-mutedWarm dark:bg-kyar-dark-muted">
            {item.imageStorageId || item.imageUrl ? (
              <ConvexStorageImage
                storageId={item.imageStorageId as Id<"_storage"> | undefined}
                imageUrl={item.imageUrl}
                className="h-full w-full"
                accessibilityLabel={item.name}
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Ionicons name={placeholderIcon} size={40} color={colors.textTertiary} />
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
            <View className="absolute left-2 top-2 flex-col gap-1">
              <View
                className="rounded-full px-2 py-0.5"
                style={{
                  borderWidth: 1,
                  borderColor: "rgba(255, 253, 248, 0.22)",
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                }}
              >
                <Text
                  style={{
                    fontFamily: APP_FONT_FAMILIES.sansBold,
                    color: mediaOverlay.primary,
                    fontSize: 8,
                    letterSpacing: 0.8,
                    textTransform: "uppercase",
                  }}
                >
                  {item.typeBadge.toUpperCase()}
                </Text>
              </View>
            </View>
          </View>
          <View className="h-[148px] min-w-0 flex-1 justify-between bg-kyar-surface py-3 pl-3 pr-3 dark:bg-kyar-dark-surface">
            <View className="min-w-0">
              <Text
                style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: colors.textSecondary }}
                className="text-[9px] uppercase tracking-[0.18em]"
              >
                {categoryUpper}
              </Text>
              <Text
                style={{ fontFamily: APP_FONT_FAMILIES.displayItalic, color: colors.text }}
                className="mt-1 text-[20px] leading-[24px]"
                numberOfLines={2}
              >
                {item.name}
              </Text>
              <Text
                style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: colors.textSecondary }}
                className="mt-2 text-[10px] uppercase tracking-wide"
              >
                {item.typeBadge} · {item.statusBadge}
              </Text>
            </View>
            <View className="mt-2 flex-row items-end justify-between gap-2">
              <View className="min-w-0 flex-1">
                <Text
                  style={{ fontFamily: APP_FONT_FAMILIES.sansBold, color: colors.textSecondary }}
                  className="text-[10px] uppercase tracking-wider"
                  numberOfLines={2}
                >
                  {progressLabel}
                  {"\n"}
                  {childrenLabel}
                </Text>
              </View>
              <CircularProgressRing pct={pct} size={30} strokeColor={colors.text} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-mutedWarm shadow-soft dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-muted">
      <View className="relative aspect-[4/5] w-full">{posterBody}</View>
    </View>
  );
}
