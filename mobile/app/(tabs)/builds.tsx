import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font } from '@kyarafit/design-system/rn';

const BUILD_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBu_SZd735qYIoLuhK64k-v3rkLy747i8ue_eH0N3xYPJbFfLIbKTVm3H-NcZKqndHcu7oc5R6oewk0qzI59bly1EUxBH8v_Rksago6lmZEEUMphUaNGZWEVkABr3W0VuzaghrdMUk4d_908-swoxIEwGiMwYZ2vS4ll8I4ag19hB22sskICQ_WverIln2OaHA-UVny57iBW11GSZL7UBfu6pwj192s2Eef0qAaLpXYi0LribO8DOh31AUeQf2hy-No5kYha4q4BEpE';

export default function BuildsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.metaLabel}>Portfolio</Text>
            <Text style={styles.title}>My Builds</Text>
          </View>
          <Pressable style={styles.closetBtn} onPress={() => router.push('/closet')}>
            <Ionicons name="cube-outline" size={14} color={colors.black} />
            <Text style={styles.closetBtnText}>Closet</Text>
          </Pressable>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          <Pressable>
            <Text style={[styles.tab, styles.tabActive]}>In Progress</Text>
          </Pressable>
          <Pressable>
            <Text style={styles.tab}>Completed</Text>
          </Pressable>
        </View>

        {/* Build Card */}
        <Pressable style={styles.buildCard} onPress={() => router.push('/build-detail')}>
          <View style={styles.buildImageContainer}>
            <Image source={{ uri: BUILD_IMG }} style={styles.buildImage} resizeMode="cover" />
            <View style={styles.budgetBadge}>
              <Text style={styles.budgetText}>Budget: $840 / $1200</Text>
            </View>
          </View>
          <View style={styles.buildInfo}>
            <View style={styles.buildHeader}>
              <Text style={styles.buildTitle}>Arlecchino</Text>
              <Text style={styles.buildCode}>PROJ 012</Text>
            </View>
            <View style={styles.progressSection}>
              <View style={styles.progressHeader}>
                <Text style={styles.progressLabel}>Construction Progress</Text>
                <Text style={styles.progressPercent}>85%</Text>
              </View>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '85%' }]} />
              </View>
            </View>
          </View>
        </Pressable>
      </ScrollView>

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => router.push('/add-item')}>
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
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    paddingHorizontal: 24, 
    paddingTop: 56, 
    paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  metaLabel: { 
    fontSize: 9, 
    letterSpacing: 2, 
    textTransform: 'uppercase', 
    fontWeight: '600', 
    color: 'rgba(0,0,0,0.4)', 
    marginBottom: 4 
  },
  title: { 
    fontFamily: font.serif, 
    fontSize: 28, 
    fontWeight: 'bold', 
    fontStyle: 'italic', 
    color: colors.black,
    letterSpacing: -0.5,
  },
  closetBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8, 
    borderWidth: 1, 
    borderColor: colors.black, 
    paddingHorizontal: 12, 
    paddingVertical: 6 
  },
  closetBtnText: { 
    fontSize: 9, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    fontWeight: 'bold', 
    color: colors.black 
  },
  tabs: { 
    flexDirection: 'row', 
    gap: 32, 
    paddingHorizontal: 24, 
    paddingTop: 8, 
    paddingBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  tab: { 
    fontSize: 11, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: 'rgba(0,0,0,0.3)' 
  },
  tabActive: { 
    fontWeight: '600', 
    color: colors.black, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.black, 
    paddingBottom: 4 
  },
  buildCard: { paddingHorizontal: 24, marginTop: 24 },
  buildImageContainer: { 
    width: '100%', 
    aspectRatio: 2 / 3, 
    backgroundColor: '#f9f9f9', 
    marginBottom: 24, 
    position: 'relative' 
  },
  buildImage: { width: '100%', height: '100%' },
  budgetBadge: { 
    position: 'absolute', 
    top: 16, 
    right: 16, 
    backgroundColor: colors.white, 
    paddingHorizontal: 8, 
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  budgetText: { 
    fontSize: 9, 
    fontWeight: 'bold', 
    textTransform: 'uppercase', 
    letterSpacing: 1.5, 
    color: colors.black 
  },
  buildInfo: { gap: 16 },
  buildHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'baseline' 
  },
  buildTitle: { 
    fontFamily: font.serif, 
    fontSize: 24, 
    fontWeight: 'bold', 
    fontStyle: 'italic', 
    color: colors.black,
    letterSpacing: -0.5,
  },
  buildCode: { fontSize: 10, color: 'rgba(0,0,0,0.4)' },
  progressSection: { gap: 8 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { 
    fontSize: 9, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: colors.black 
  },
  progressPercent: { 
    fontSize: 9, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: colors.black 
  },
  progressBar: { height: 1, backgroundColor: '#f3f3f3', width: '100%' },
  progressFill: { height: '100%', backgroundColor: colors.black },
  fab: { 
    position: 'absolute', 
    bottom: 120, 
    right: 24, 
    width: 56, 
    height: 56, 
    backgroundColor: colors.black, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderRadius: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
});
