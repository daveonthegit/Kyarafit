import { View, Text, Image, StyleSheet, Dimensions } from "react-native";
import { colors, spacing, layout, font } from "@kyarafit/design-system/rn";

const { width } = Dimensions.get("window");
const gap = layout.gridGap;
const cols = 2;
const cardWidth = (width - layout.screenPaddingX * 2 - gap) / cols;

interface ImageCardProps {
  imageUrl: string;
  title: string;
  tag?: string;
}

export function ImageCard({ imageUrl, title, tag }: ImageCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.imageWrap}>
        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        {tag ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: cardWidth,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  imageWrap: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: colors.muted,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  tag: {
    position: "absolute",
    bottom: spacing[2],
    left: spacing[2],
    backgroundColor: "rgba(255,255,255,0.9)",
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.text,
  },
  title: {
    fontSize: font.size.sm,
    color: colors.text,
    padding: spacing[4],
  },
});
