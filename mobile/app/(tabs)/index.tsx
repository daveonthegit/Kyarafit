import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, layout } from "@kyarafit/design-system/rn";

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.metaLabel}>Kyarafit</Text>
            <Text style={styles.title}>The Lookbook</Text>
          </View>
          <View style={styles.headerIcons}>
            <Pressable>
              <Ionicons name="search-outline" size={24} color={colors.black} />
            </Pressable>
            <Pressable onPress={() => router.push("/settings")}>
              <Ionicons name="menu-outline" size={24} color={colors.black} />
            </Pressable>
          </View>
        </View>

        <Pressable
          style={styles.featuredSection}
          onPress={() => router.push("/(tabs)/builds")}
        >
          <View style={styles.featuredPlaceholder}>
            <Ionicons
              name="layers-outline"
              size={48}
              color={colors.textTertiary}
            />
          </View>
          <View style={styles.featuredOverlay}>
            <Text style={styles.featuredMeta}>Current Focus</Text>
            <Text style={styles.featuredTitle}>Builds & Conventions</Text>
            <Text style={styles.viewCaseText}>View Builds</Text>
          </View>
        </Pressable>

        <View style={styles.linksSection}>
          <Text style={styles.linksLabel}>Quick links</Text>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push("/(tabs)/builds")}
          >
            <Text style={styles.linkText}>My Builds</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textTertiary}
            />
          </Pressable>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push("/(tabs)/plan")}
          >
            <Text style={styles.linkText}>Conventions</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textTertiary}
            />
          </Pressable>
          <Pressable
            style={styles.linkRow}
            onPress={() => router.push("/closet")}
          >
            <Text style={styles.linkText}>Closet</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textTertiary}
            />
          </Pressable>
        </View>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => router.push("/add-item")}>
        <Ionicons name="add" size={24} color={colors.white} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: 56,
    paddingBottom: 24,
  },
  metaLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
    marginBottom: 4,
  },
  title: {
    fontFamily: font.serif,
    fontSize: 36,
    fontStyle: "italic",
    color: colors.black,
    letterSpacing: -0.5,
  },
  headerIcons: { flexDirection: "row", gap: 16, marginBottom: 4 },
  featuredSection: { paddingHorizontal: 24, marginBottom: 48 },
  featuredPlaceholder: {
    width: "100%",
    aspectRatio: 4 / 5,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  featuredOverlay: {
    marginTop: 24,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  featuredMeta: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.meta,
    marginBottom: 4,
  },
  featuredTitle: {
    fontFamily: font.serif,
    fontSize: 24,
    fontStyle: "italic",
    color: colors.black,
  },
  viewCaseText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.black,
    borderWidth: 1,
    borderColor: colors.black,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  linksSection: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  linksLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "600",
    color: colors.black,
    marginBottom: 16,
  },
  linkRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  linkText: {
    fontFamily: font.serif,
    fontSize: 20,
    fontStyle: "italic",
    color: colors.black,
  },
  fab: {
    position: "absolute",
    bottom: 120,
    right: 24,
    width: 56,
    height: 56,
    backgroundColor: colors.black,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
});
