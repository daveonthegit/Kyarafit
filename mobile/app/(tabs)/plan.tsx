import { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@kyarafit/design-system/rn';

const conventions = [
  { id: 'ax', name: 'Anime Expo', date: 'July 2024', status: 'Upcoming' },
  { id: 'nycc', name: 'NYCC', date: 'Oct 2024', status: 'Planning' },
];

export default function PlanScreen() {
  const router = useRouter();
  const [view, setView] = useState<'daily' | 'conventions'>('daily');

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.tabs}>
            <Pressable onPress={() => setView('daily')}>
              <Text style={[styles.tab, view === 'daily' && styles.tabActive]}>Daily</Text>
            </Pressable>
            <Pressable onPress={() => setView('conventions')}>
              <Text style={[styles.tab, view === 'conventions' && styles.tabActive]}>Conventions</Text>
            </Pressable>
          </View>
          {view === 'daily' ? (
            <View style={styles.dateHeader}>
              <Text style={styles.dateTitle}>October 24</Text>
              <Text style={styles.dateDay}>Thursday</Text>
            </View>
          ) : (
            <Text style={styles.dateTitle}>Circuit</Text>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {view === 'daily' ? (
            <View style={styles.prioritySection}>
              <Text style={styles.priorityLabel}>Today's Priority</Text>
              <View style={styles.taskList}>
                <View style={styles.task}>
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskNumber}>01</Text>
                    <Pressable>
                      <Ionicons name="ellipsis-horizontal" size={18} color={colors.black} />
                    </Pressable>
                  </View>
                  <Text style={styles.taskTitle}>Finalize structural boning for Arlecchino corset assembly</Text>
                  <Text style={styles.taskMeta}>Workshop • 2:00 PM</Text>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.conventionsList}>
              {conventions.map((con) => (
                <Pressable 
                  key={con.id} 
                  style={styles.conventionItem} 
                  onPress={() => router.push('/itinerary')}
                >
                  <View style={styles.conventionHeader}>
                    <Text style={styles.conventionName}>{con.name}</Text>
                    <Text style={styles.conventionDate}>{con.date}</Text>
                  </View>
                  <View style={styles.conventionActions}>
                    <Pressable style={styles.actionBtn} onPress={() => router.push('/itinerary')}>
                      <Text style={styles.actionBtnText}>Itinerary</Text>
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => router.push('/(tabs)/packing')}>
                      <Text style={styles.actionBtnText}>Packing List</Text>
                    </Pressable>
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 140 },
  header: { paddingHorizontal: 32, paddingTop: 64, paddingBottom: 32 },
  tabs: { flexDirection: 'row', gap: 24, marginBottom: 32 },
  tab: { 
    fontSize: 10, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    fontWeight: 'bold', 
    color: 'rgba(0,0,0,0.3)', 
    paddingBottom: 4 
  },
  tabActive: { 
    color: colors.black, 
    borderBottomWidth: 2, 
    borderBottomColor: colors.black 
  },
  dateHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'baseline' 
  },
  dateTitle: { 
    fontFamily: font.serif, 
    fontSize: 48, 
    fontWeight: 'bold', 
    fontStyle: 'italic', 
    color: colors.black,
    letterSpacing: -1,
  },
  dateDay: { 
    fontSize: 11, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: 'rgba(0,0,0,0.6)' 
  },
  content: { paddingHorizontal: 32 },
  prioritySection: { marginBottom: 64 },
  priorityLabel: { 
    fontSize: 10, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    fontWeight: 'bold', 
    color: colors.black, 
    borderBottomWidth: 1, 
    borderBottomColor: colors.black, 
    paddingBottom: 8, 
    alignSelf: 'flex-start', 
    marginBottom: 32 
  },
  taskList: { gap: 48 },
  task: {},
  taskHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 8 
  },
  taskNumber: { fontSize: 10, color: 'rgba(0,0,0,0.3)' },
  taskTitle: { 
    fontSize: 20, 
    fontWeight: '300', 
    color: colors.black, 
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  taskMeta: { 
    fontSize: 11, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: 'rgba(0,0,0,0.4)', 
    marginTop: 8 
  },
  conventionsList: { gap: 40 },
  conventionItem: { 
    borderBottomWidth: 1, 
    borderBottomColor: '#f3f3f3', 
    paddingBottom: 24 
  },
  conventionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    marginBottom: 12 
  },
  conventionName: { 
    fontFamily: font.serif, 
    fontSize: 24, 
    fontStyle: 'italic', 
    fontWeight: 'bold', 
    color: colors.black,
    letterSpacing: -0.5,
  },
  conventionDate: { fontSize: 10, color: 'rgba(0,0,0,0.4)' },
  conventionActions: { flexDirection: 'row', gap: 16 },
  actionBtn: { 
    borderWidth: 1, 
    borderColor: 'rgba(0,0,0,0.1)', 
    paddingHorizontal: 12, 
    paddingVertical: 6 
  },
  actionBtnText: { 
    fontSize: 9, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: colors.black 
  },
});
