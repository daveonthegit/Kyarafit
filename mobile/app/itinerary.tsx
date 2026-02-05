import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font } from "@kyarafit/design-system/rn";

export default function ItineraryScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerMeta}>Kyarafit Itinerary</Text>
          <Text style={styles.headerTitle}>Convention day</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable>
            <Ionicons name="share-outline" size={24} color={colors.black} />
          </Pressable>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="close" size={24} color={colors.black} />
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.daySection}>
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>Day 1</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>Active</Text>
            </View>
          </View>
          <View style={styles.lookLayout}>
            <View style={[styles.lookImageContainer, styles.placeholderImage]}>
              <Ionicons name="image-outline" size={48} color={colors.textTertiary} />
            </View>
            <View style={styles.lookInfo}>
              <Text style={styles.lookLabel}>Look 01</Text>
              <Text style={styles.lookDesc}>Assign a build from your convention plan</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f3f3",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  headerLeft: {},
  headerMeta: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 4,
    fontWeight: "500",
    color: "rgba(0,0,0,0.4)",
    marginBottom: 6,
  },
  headerTitle: {
    fontFamily: font.serif,
    fontSize: 28,
    fontWeight: "bold",
    fontStyle: "italic",
    color: colors.black,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 4,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 120,
  },
  daySection: {},
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 24,
  },
  dayTitle: {
    fontFamily: font.serif,
    fontSize: 48,
    fontStyle: "italic",
    fontWeight: "bold",
    color: colors.black,
    letterSpacing: -1,
  },
  activeBadge: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  activeBadgeText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.black,
  },
  lookLayout: { flexDirection: "row", gap: 24 },
  lookImageContainer: {
    width: "66%",
    aspectRatio: 3 / 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.05,
    shadowRadius: 40,
    elevation: 4,
  },
  placeholderImage: {
    backgroundColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  lookInfo: {
    flex: 1,
    justifyContent: "flex-end",
    paddingBottom: 16,
  },
  lookLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: "bold",
    color: colors.black,
    marginBottom: 8,
  },
  lookDesc: {
    fontSize: 10,
    color: "rgba(0,0,0,0.6)",
  },
});
