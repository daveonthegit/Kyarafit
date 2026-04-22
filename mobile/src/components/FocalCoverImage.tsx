import { useMemo, useState } from "react";
import { Image, View, type LayoutChangeEvent, type ImageStyle } from "react-native";

const COVER_SCALE = 1.22;

type Props = {
  uri: string;
  /** Normalized focal X/Y (0–1), matching web hero / `imageFocalX` & `imageFocalY`. */
  focalX?: number | null;
  focalY?: number | null;
  className?: string;
  accessibilityLabel?: string;
};

/**
 * Cover crop with focal anchoring — mirrors web `object-position` on `ResolvedImage`.
 */
export function FocalCoverImage({
  uri,
  focalX,
  focalY,
  className,
  accessibilityLabel,
}: Props) {
  const [layout, setLayout] = useState<{ w: number; h: number } | null>(null);

  const useFocal = focalX != null && focalY != null;
  const fx = focalX ?? 0.5;
  const fy = focalY ?? 0.5;

  const imageStyle = useMemo((): ImageStyle => {
    if (!useFocal || !layout?.w || !layout.h) {
      return { width: "100%", height: "100%" };
    }
    const iw = layout.w * COVER_SCALE;
    const ih = layout.h * COVER_SCALE;
    const left = layout.w / 2 - fx * iw;
    const top = layout.h / 2 - fy * ih;
    return {
      position: "absolute",
      width: iw,
      height: ih,
      left,
      top,
    };
  }, [layout, fx, fy, useFocal]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width <= 0 || height <= 0) return;
    setLayout({ w: width, h: height });
  }

  return (
    <View className={`overflow-hidden ${className ?? ""}`} onLayout={onLayout}>
      <Image
        source={{ uri }}
        style={imageStyle}
        resizeMode="cover"
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}
