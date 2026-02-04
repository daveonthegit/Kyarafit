import { View, Text, Image, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, font } from '@kyarafit/design-system/rn';

const FEATURED_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBu_SZd735qYIoLuhK64k-v3rkLy747i8ue_eH0N3xYPJbFfLIbKTVm3H-NcZKqndHcu7oc5R6oewk0qzI59bly1EUxBH8v_Rksago6lmZEEUMphUaNGZWEVkABr3W0VuzaghrdMUk4d_908-swoxIEwGiMwYZ2vS4ll8I4ag19hB22sskICQ_WverIln2OaHA-UVny57iBW11GSZL7UBfu6pwj192s2Eef0qAaLpXYi0LribO8DOh31AUeQf2hy-No5kYha4q4BEpE';
const DEADLINE_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuANB3dhJnBdXJaL_UnZMR1yklmotO8qguSIjtgHVdJGshhrjA0Wb9tNJnobCISZ_YmdNp2WnswxnsaTVqyaITjrDuxUSNR26xPv8-NkKwEV7Pmu9sD5Ybq_9oia63qgI8oWfU8TFRCQuvbmabe8RtAwIZdNzZ0ZyEC1sefwCy1t2IOwujj6tqmJPsxLbm9fo4Z4KY3VFUeuK88hUDdq7cCXsLs1YgsJnluz1wdKU7eD_qoRbaqKRUa7Lh6rV9HIViA5YIED8nN2akxW';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.metaLabel}>Kyarafit</Text>
            <Text style={styles.title}>The Lookbook</Text>
          </View>
          <View style={styles.headerIcons}>
            <Pressable>
              <Ionicons name="search-outline" size={24} color={colors.black} />
            </Pressable>
            <Pressable onPress={() => router.push('/settings')}>
              <Ionicons name="menu-outline" size={24} color={colors.black} />
            </Pressable>
          </View>
        </View>

        {/* Featured Image */}
        <Pressable style={styles.featuredSection} onPress={() => router.push('/build-detail')}>
          <View style={styles.featuredImageContainer}>
            <Image source={{ uri: FEATURED_IMG }} style={styles.featuredImage} resizeMode="cover" />
            <View style={styles.featuredOverlay}>
              <View>
                <Text style={styles.featuredMeta}>Current Focus</Text>
                <Text style={styles.featuredTitle}>Arlecchino</Text>
              </View>
              <View style={styles.viewCaseBadge}>
                <Text style={styles.viewCaseText}>View Case</Text>
              </View>
            </View>
          </View>
        </Pressable>

        {/* Next Deadline */}
        <View style={styles.deadlineSection}>
          <View style={styles.deadlineHeader}>
            <Text style={styles.deadlineLabel}>Next Deadline</Text>
            <Text style={styles.deadlineDays}>12 Days</Text>
          </View>
          <View style={styles.deadlineContent}>
            <View style={styles.deadlineText}>
              <Text style={styles.deadlineTitle}>Final Fitting & Prop Polish</Text>
              <Text style={styles.deadlineDesc}>Ensuring structural integrity for the wing mechanism and weathering.</Text>
            </View>
            <View style={styles.deadlineThumb}>
              <Image 
                source={{ uri: DEADLINE_IMG }} 
                style={styles.deadlineImage} 
                resizeMode="cover"
              />
              {/* Grayscale overlay */}
              <View style={styles.grayscaleOverlay} />
            </View>
          </View>
        </View>
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
    paddingHorizontal: 32, 
    paddingTop: 56, 
    paddingBottom: 24 
  },
  metaLabel: { 
    fontSize: 9, 
    letterSpacing: 2, 
    textTransform: 'uppercase', 
    fontWeight: '600', 
    color: 'rgba(0,0,0,0.5)', 
    marginBottom: 4 
  },
  title: { 
    fontFamily: font.serif, 
    fontSize: 36, 
    fontStyle: 'italic', 
    color: colors.black,
    letterSpacing: -0.5,
  },
  headerIcons: { 
    flexDirection: 'row', 
    gap: 16, 
    marginBottom: 4 
  },
  featuredSection: { 
    paddingHorizontal: 24, 
    marginBottom: 48 
  },
  featuredImageContainer: { 
    width: '100%', 
    aspectRatio: 4 / 5, 
    overflow: 'hidden', 
    position: 'relative' 
  },
  featuredImage: { 
    width: '100%', 
    height: '100%' 
  },
  featuredOverlay: { 
    position: 'absolute', 
    bottom: 24, 
    left: 24, 
    right: 24, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end' 
  },
  featuredMeta: { 
    fontSize: 10, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: colors.white, 
    fontWeight: '300',
    marginBottom: 4 
  },
  featuredTitle: { 
    fontFamily: font.serif, 
    fontSize: 24, 
    fontStyle: 'italic', 
    color: colors.white 
  },
  viewCaseBadge: { 
    borderWidth: 1, 
    borderColor: 'rgba(255,255,255,0.3)', 
    paddingHorizontal: 12, 
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  viewCaseText: { 
    fontSize: 10, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: colors.white 
  },
  deadlineSection: { 
    paddingHorizontal: 32, 
    borderTopWidth: 1, 
    borderTopColor: 'rgba(0,0,0,0.05)', 
    paddingTop: 24 
  },
  deadlineHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'baseline', 
    marginBottom: 16 
  },
  deadlineLabel: { 
    fontSize: 11, 
    textTransform: 'uppercase', 
    letterSpacing: 3, 
    fontWeight: '600', 
    color: colors.black 
  },
  deadlineDays: { 
    fontFamily: font.serif, 
    fontSize: 18, 
    fontStyle: 'italic', 
    color: 'rgba(0,0,0,0.4)' 
  },
  deadlineContent: { 
    flexDirection: 'row', 
    gap: 32 
  },
  deadlineText: { 
    flex: 1 
  },
  deadlineTitle: { 
    fontFamily: font.serif, 
    fontSize: 24, 
    lineHeight: 32, 
    marginBottom: 8, 
    color: colors.black 
  },
  deadlineDesc: { 
    fontSize: 12, 
    color: 'rgba(0,0,0,0.5)', 
    lineHeight: 20 
  },
  deadlineThumb: { 
    width: 64, 
    height: 64, 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.05)', 
    padding: 4,
    position: 'relative',
    overflow: 'hidden',
  },
  deadlineImage: { 
    width: '100%', 
    height: '100%',
  },
  grayscaleOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(128,128,128,0.3)',
    mixBlendMode: 'saturation',
  },
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
