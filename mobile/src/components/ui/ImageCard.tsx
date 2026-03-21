import { View, Text, Image, StyleSheet, Dimensions, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, spacing, layout, font, radius } from "@kyarafit/design-system/rn";

const { width } = Dimensions.get("window");
const gap = layout.gridGap;
const cols = 2;
const cardWidth = (width - layout.screenPaddingX * 2 - gap) / cols;

interface ImageCardProps {
  imageUrl?: string | null;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  aspectRatio?: number;
}

export function ImageCard({
  imageUrl,
  title,
  subtitle,
  onPress,
  aspectRatio = 3 / 4,
}: ImageCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={[styles.imageWrap, { aspectRatio }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.placeholder} />
        )}
        <LinearGradient colors={["transparent", "rgba(0,0,0,0.7)"]} style={styles.gradient} />
        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  imageWrap: {
    width: "100%",
    backgroundColor: colors.muted,
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.muted,
  },
  gradient: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "50%",
  },
  textContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing[3],
  },
  title: {
    fontFamily: font.sansSerif,
    fontSize: font.size.sm,
    fontWeight: "600",
    color: colors.white,
  },
  subtitle: {
    fontFamily: font.sansSerif,
    fontSize: 10,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
});
