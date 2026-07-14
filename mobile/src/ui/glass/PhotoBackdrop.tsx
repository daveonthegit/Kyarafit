import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { glass } from "@kyarafit/design-system/rn";
import { FocalCoverImage } from "@/components/FocalCoverImage";
import { scrimGradientProps } from "./glassSurfaces";
import { useReducedMotion } from "./useReducedMotion";

const KEN_BURNS_SCALE = 1.03;
const KEN_BURNS_DURATION_MS = 12000;

type PhotoBackdropProps = {
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
  /** Normalized focal X/Y (0–1) — mirrors web `object-position` support. */
  focalX?: number | null;
  focalY?: number | null;
  /** Backdrops are decorative; pass a label only when the photo carries meaning. */
  accessibilityLabel?: string;
  /** Mobile always scrims with `--scrim-page-vertical-mobile` (QA-1). */
  scrim?: "default" | "off";
  /** Slow ≤1.03 zoom over 12s; disabled under reduced motion. */
  kenBurns?: boolean;
  style?: StyleProp<ViewStyle>;
};

function KenBurnsImage({
  uri,
  focalX,
  focalY,
  accessibilityLabel,
  kenBurns,
}: {
  uri: string;
  focalX?: number | null;
  focalY?: number | null;
  accessibilityLabel?: string;
  kenBurns: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const animate = kenBurns && !reducedMotion;

  useEffect(() => {
    if (!animate) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: KEN_BURNS_SCALE,
          duration: KEN_BURNS_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: KEN_BURNS_DURATION_MS,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animate, scale]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }] }]}>
      <FocalCoverImage
        uri={uri}
        focalX={focalX}
        focalY={focalY}
        className="h-full w-full"
        accessibilityLabel={accessibilityLabel}
      />
    </Animated.View>
  );
}

/**
 * Full-bleed photo backdrop for studio screens (surface rules 1–4). The
 * studio-wall gradient renders underneath, so a missing or still-resolving
 * image falls back to it — never a gray box. Position inside a `relative`
 * container; layer screen content above it.
 */
export function PhotoBackdrop({
  imageStorageId,
  imageUrl,
  focalX,
  focalY,
  accessibilityLabel,
  scrim = "default",
  kenBurns = true,
  style,
}: PhotoBackdropProps) {
  const fromStorage = useQuery(
    api.files.getUrl,
    !imageUrl && imageStorageId ? { storageId: imageStorageId } : "skip"
  );
  const uri = imageUrl ?? (typeof fromStorage === "string" ? fromStorage : null);

  return (
    <Animated.View
      // Flattened: expo-router's <Slot> rejects array styles on its children.
      style={StyleSheet.flatten([StyleSheet.absoluteFill, { overflow: "hidden" }, style])}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? "auto" : "no-hide-descendants"}
    >
      <LinearGradient {...scrimGradientProps(glass.scrim.studioWall)} style={StyleSheet.absoluteFill} />
      {uri ? (
        <KenBurnsImage
          uri={uri}
          focalX={focalX}
          focalY={focalY}
          accessibilityLabel={accessibilityLabel}
          kenBurns={kenBurns}
        />
      ) : null}
      {scrim !== "off" ? (
        <LinearGradient
          {...scrimGradientProps(glass.scrim.pageVerticalMobile)}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}
    </Animated.View>
  );
}
