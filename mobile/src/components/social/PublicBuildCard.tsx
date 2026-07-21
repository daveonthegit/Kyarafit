import { Pressable, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import type { Id } from "convex/_generated/dataModel";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { scrimGradientProps } from "@/ui/glass";
import { BuildSocialActions } from "./BuildSocialActions";

type Props = {
  build: {
    _id: Id<"builds">;
    name: string;
    character?: string | null;
    status?: string | null;
    imageStorageId?: Id<"_storage"> | null;
    imageUrl?: string | null;
    ownerUsername?: string | null;
    ownerName?: string | null;
    tasksChecked?: number;
    tasksTotal?: number;
  };
  onPress: () => void;
  onPressOwner?: () => void;
  currentUserId?: string | null;
  /** 1-based “Project 001” index; defaults to 1 */
  projectIndex?: number;
};

/**
 * Glass Studio public-build tile (ref 12a/12b, web `PublicBuildCard` anatomy):
 * 4:5 photo, radius 14, scrim, owner chip top-left, serif name + social counts
 * bottom. Same props/navigation as before; likes/comments run through the
 * shared BuildSocialActions (unchanged queries/mutations).
 */
export function PublicBuildCard({
  build,
  onPress,
  onPressOwner,
  currentUserId,
  projectIndex = 1,
}: Props) {
  // Kept for prop-contract parity with existing callers; the glass tile
  // carries no project number (web parity).
  void projectIndex;
  const { t } = useTranslation();
  const ownerLabel = build.ownerUsername ? `@${build.ownerUsername}` : (build.ownerName ?? null);
  const hasImage = build.imageStorageId != null || build.imageUrl != null;
  const tasksTotal = build.tasksTotal ?? 0;
  const tasksChecked = build.tasksChecked ?? 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={build.name}
      className="active:opacity-90"
      style={{
        aspectRatio: 4 / 5,
        borderRadius: glass.radius.panel,
        overflow: "hidden",
        borderWidth: borderWidth.hairline,
        borderColor: glass.border.default,
        backgroundColor: glass.surface.active,
      }}
    >
      {hasImage ? (
        <ConvexStorageImage
          storageId={build.imageStorageId}
          imageUrl={build.imageUrl}
          className="absolute inset-0 h-full w-full"
          accessibilityLabel={build.name}
        />
      ) : (
        <LinearGradient
          {...scrimGradientProps(glass.scrim.studioWall)}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 34, color: glass.text.fg45 }}>✦</Text>
        </LinearGradient>
      )}

      {/* Vertical scrim: keeps the top chip and bottom meta legible over the photo. */}
      <LinearGradient
        {...scrimGradientProps(glass.scrim.pageVertical)}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        pointerEvents="none"
      />

      {ownerLabel ? (
        <Pressable
          onPress={(event) => {
            event.stopPropagation();
            onPressOwner?.();
          }}
          disabled={!onPressOwner}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={ownerLabel}
          className="active:opacity-80"
          style={{
            position: "absolute",
            left: 10,
            top: 10,
            maxWidth: "80%",
            borderRadius: 999,
            backgroundColor: glass.chip.neutral.bg,
            paddingHorizontal: 10,
            paddingVertical: 5,
          }}
        >
          <Text
            numberOfLines={1}
            style={{
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 9,
              letterSpacing: ls(0.14, 9),
              textTransform: "uppercase",
              color: glass.chip.neutral.fg,
            }}
          >
            {ownerLabel}
          </Text>
        </Pressable>
      ) : null}

      <View
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 12 }}
        pointerEvents="box-none"
      >
        {build.character ? (
          <Text
            numberOfLines={1}
            style={{
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 9,
              letterSpacing: ls(0.2, 9),
              textTransform: "uppercase",
              color: glass.text.fg,
              opacity: 0.8,
              marginBottom: 3,
            }}
          >
            {build.character}
          </Text>
        ) : null}
        <Text
          numberOfLines={2}
          style={{
            fontFamily: APP_FONT_FAMILIES.displayItalic,
            fontSize: 20,
            lineHeight: 23,
            letterSpacing: ls(-0.02, 20),
            color: glass.text.fg,
          }}
        >
          {build.name}
        </Text>
        {tasksTotal > 0 ? (
          <Text
            numberOfLines={1}
            style={{
              marginTop: 4,
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 10,
              letterSpacing: ls(0.16, 10),
              textTransform: "uppercase",
              color: glass.text.fg,
              opacity: 0.9,
            }}
          >
            {t("social.cardTasksMeta", {
              checked: tasksChecked,
              total: tasksTotal,
              defaultValue: "{{checked}}/{{total}} tasks",
            })}
          </Text>
        ) : null}
        <View style={{ marginTop: 10 }}>
          <BuildSocialActions
            buildId={build._id}
            buildName={build.name}
            currentUserId={currentUserId}
            size="tile"
          />
        </View>
      </View>
    </Pressable>
  );
}
