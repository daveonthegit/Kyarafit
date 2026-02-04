import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@kyarafit/design-system/rn';

const BUILD_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBu_SZd735qYIoLuhK64k-v3rkLy747i8ue_eH0N3xYPJbFfLIbKTVm3H-NcZKqndHcu7oc5R6oewk0qzI59bly1EUxBH8v_Rksago6lmZEEUMphUaNGZWEVkABr3W0VuzaghrdMUk4d_908-swoxIEwGiMwYZ2vS4ll8I4ag19hB22sskICQ_WverIln2OaHA-UVny57iBW11GSZL7UBfu6pwj192s2Eef0qAaLpXYi0LribO8DOh31AUeQf2hy-No5kYha4q4BEpE';

const materials = [
  { name: 'Worbla Sheet (Large)', cost: 85.0, status: 'Acquired' },
  { name: 'Raw Silk Fabric (4yd)', cost: 120.0, status: 'Acquired' },
  { name: 'EVA Foam 5mm', cost: 45.5, status: 'Planned' },
];

export default function BuildDetailScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.fixedHeader}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="chevron-back" size={24} color={colors.black} />
        </Pressable>
        <Text style={styles.headerMeta}>Build Profile</Text>
        <Pressable style={styles.headerBtn}>
          <Ionicons name="ellipsis-horizontal" size={24} color={colors.black} />
        </Pressable>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Hero Image */}
        <View style={styles.heroSection}>
          <View style={styles.heroImageContainer}>
            <Image source={{ uri: BUILD_IMG }} style={styles.heroImage} resizeMode="cover" />
          </View>

          <View style={styles.titleRow}>
            <View style={styles.titleLeft}>
              <Text style={styles.metaLabel}>Character Project</Text>
              <Text style={styles.title}>Arlecchino</Text>
            </View>
            <View style={styles.editionBox}>
              <Text style={styles.metaLabel}>Edition</Text>
              <Text style={styles.editionValue}>Spring 2024</Text>
            </View>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.metaLabel}>Construction</Text>
              <Text style={styles.statValue}>85% Complete</Text>
            </View>
            <View style={[styles.statBox, styles.statBoxBorder]}>
              <Text style={styles.metaLabel}>Financials</Text>
              <Text style={styles.statValue}>Spent: $842.10</Text>
              <Text style={styles.statLimit}>Limit: $1,200.00</Text>
            </View>
          </View>
        </View>

        {/* Bill of Materials */}
        <View style={styles.bomSection}>
          <View style={styles.bomHeader}>
            <Text style={styles.bomTitle}>Bill of Materials</Text>
            <Pressable>
              <Text style={styles.addExpenseBtn}>Add Expense</Text>
            </Pressable>
          </View>
          <View style={styles.bomList}>
            {materials.map((item, i) => (
              <View key={i} style={styles.bomItem}>
                <View>
                  <Text style={styles.bomItemName}>{item.name}</Text>
                  <Text style={styles.bomItemStatus}>{item.status}</Text>
                </View>
                <Text style={styles.bomItemCost}>${item.cost.toFixed(2)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  fixedHeader: { 
    position: 'absolute', 
    top: 0, 
    left: 0, 
    right: 0, 
    zIndex: 50, 
    backgroundColor: 'rgba(255,255,255,0.9)', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingTop: 48, 
    paddingBottom: 16 
  },
  headerBtn: { width: 24 },
  headerMeta: { 
    fontSize: 9, 
    letterSpacing: 2, 
    textTransform: 'uppercase', 
    fontWeight: '600', 
    color: 'rgba(0,0,0,0.5)' 
  },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 96, paddingBottom: 100 },
  heroSection: { paddingHorizontal: 24, marginBottom: 48 },
  heroImageContainer: { 
    width: '100%', 
    aspectRatio: 4 / 5, 
    marginBottom: 32 
  },
  heroImage: { width: '100%', height: '100%' },
  titleRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    marginBottom: 32 
  },
  titleLeft: {},
  title: { 
    fontFamily: font.serif, 
    fontSize: 36, 
    fontStyle: 'italic', 
    color: colors.black, 
    marginTop: 8,
    letterSpacing: -0.5,
  },
  metaLabel: { 
    fontSize: 9, 
    letterSpacing: 2, 
    textTransform: 'uppercase', 
    fontWeight: '600', 
    color: 'rgba(0,0,0,0.5)' 
  },
  editionBox: { alignItems: 'flex-end' },
  editionValue: { 
    fontSize: 12, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    fontWeight: '500', 
    color: colors.black, 
    marginTop: 4 
  },
  statsGrid: { 
    flexDirection: 'row', 
    borderTopWidth: 1, 
    borderBottomWidth: 1, 
    borderColor: 'rgba(0,0,0,0.05)', 
    paddingVertical: 24 
  },
  statBox: { flex: 1, paddingHorizontal: 8 },
  statBoxBorder: { 
    borderLeftWidth: 1, 
    borderLeftColor: 'rgba(0,0,0,0.05)' 
  },
  statValue: { 
    fontSize: 12, 
    textTransform: 'uppercase', 
    fontWeight: '500', 
    color: colors.black, 
    marginTop: 4 
  },
  statLimit: { 
    fontSize: 9, 
    fontStyle: 'italic', 
    color: 'rgba(0,0,0,0.4)', 
    marginTop: 2 
  },
  bomSection: { paddingHorizontal: 24 },
  bomHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 32 
  },
  bomTitle: { 
    fontFamily: font.serif, 
    fontSize: 20, 
    fontStyle: 'italic', 
    color: colors.black 
  },
  addExpenseBtn: { 
    fontSize: 9, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: colors.black, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.black,
    paddingBottom: 2,
  },
  bomList: { gap: 24 },
  bomItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderBottomWidth: 1, 
    borderBottomColor: '#f3f3f3', 
    paddingBottom: 16 
  },
  bomItemName: { 
    fontSize: 12, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    fontWeight: '300', 
    color: colors.black 
  },
  bomItemStatus: { 
    fontSize: 9, 
    color: 'rgba(0,0,0,0.4)', 
    marginTop: 4 
  },
  bomItemCost: { 
    fontSize: 11, 
    fontWeight: 'bold', 
    color: colors.black 
  },
});
