import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { glass, motion } from "@kyarafit/design-system/rn";
import { GlassOverlay } from "./GlassSurface";
import { useReducedMotion } from "./useReducedMotion";

/** `--ease-out-strong` (motion.easing.standard). */
const EASE_OUT_STRONG = Easing.bezier(0.23, 1, 0.32, 1);

type GlassSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Accessibility label for the dim backdrop's close affordance. */
  closeLabel: string;
  children: ReactNode;
};

/**
 * Glass bottom sheet scaffold (ref 13d): dim wash, overlay-weight glass,
 * 20pt top radius + drag grip. Content-only sheets (menus, dialogs); the
 * explorer sheets keep their own drag mechanics.
 */
export function GlassSheet({ open, onClose, closeLabel, children }: GlassSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const [mounted, setMounted] = useState(open);
  const translateY = useRef(new Animated.Value(height)).current;
  const dim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      setMounted(true);
      const duration = reducedMotion ? 0 : motion.duration.baseMs;
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          easing: EASE_OUT_STRONG,
          useNativeDriver: true,
        }),
        Animated.timing(dim, { toValue: 1, duration, useNativeDriver: true }),
      ]).start();
      return;
    }
    const duration = reducedMotion ? 0 : motion.duration.fastMs;
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height,
        duration,
        easing: EASE_OUT_STRONG,
        useNativeDriver: true,
      }),
      Animated.timing(dim, { toValue: 0, duration, useNativeDriver: true }),
    ]).start(() => setMounted(false));
  }, [open, reducedMotion, height, translateY, dim]);

  if (!mounted) return null;

  return (
    <Modal transparent statusBarTranslucent visible onRequestClose={onClose}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: glass.scrimDim, opacity: dim }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel}
        />
      </Animated.View>
      <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
        <Animated.View style={{ transform: [{ translateY }] }}>
          {/* Real blur — matches the nav drawer's live-glass overlay. */}
          <GlassOverlay
            style={{ borderRadius: 0 }}
            surfaceStyle={{
              borderTopLeftRadius: glass.radius.sheet,
              borderTopRightRadius: glass.radius.sheet,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
              borderBottomWidth: 0,
            }}
          >
            <View style={{ alignItems: "center", paddingTop: 10 }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: glass.border.strong,
                }}
              />
            </View>
            <View style={{ paddingBottom: Math.max(insets.bottom, 16) }}>{children}</View>
          </GlassOverlay>
        </Animated.View>
      </View>
    </Modal>
  );
}
