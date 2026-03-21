import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { colors, font } from "@kyarafit/design-system/rn";

interface EditorialProgressDonutProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
}

export function EditorialProgressDonut({
  progress,
  size = 120,
  strokeWidth = 4,
}: EditorialProgressDonutProps) {
  const p = Math.min(100, Math.max(0, progress));
  // 15.9155 is the radius that makes the circumference exactly 100
  // C = 2 * pi * r
  // r = 100 / (2 * pi) ≈ 15.9154943
  const radius = 15.9155;
  const circumference = 2 * Math.PI * radius; // Approx 100
  const dash = (p / 100) * circumference;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width="100%" height="100%" viewBox="0 0 36 36" style={styles.svg}>
        <Circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={colors.borderSubtle}
          strokeWidth={strokeWidth}
        />
        <Circle
          cx="18"
          cy="18"
          r={radius}
          fill="none"
          stroke={colors.text}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </Svg>
      <View style={styles.textContainer}>
        <Text style={styles.text}>{p}%</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
  },
  svg: {
    transform: [{ rotate: "-90deg" }],
  },
  textContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontFamily: font.serif,
    fontSize: font.size["3xl"],
    fontWeight: "600",
    color: colors.text,
  },
});
