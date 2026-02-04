import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@kyarafit/design-system/rn';

const menuItems = ['Account Details', 'Subscription Plan', 'Notification Style'];

export default function SettingsScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.metaLabel}>System Preferences</Text>
            <Text style={styles.title}>Settings</Text>
          </View>
          <Pressable onPress={() => router.back()} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color={colors.black} />
          </Pressable>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Profile & Identity</Text>
          {menuItems.map((item) => (
            <Pressable key={item} style={styles.menuItem}>
              <Text style={styles.menuItemText}>{item}</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(0,0,0,0.3)" />
            </Pressable>
          ))}
        </View>

        <Pressable style={styles.signOut} onPress={() => router.replace('/')}>
          <Text style={styles.signOutText}>Sign Out of Device</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 120 },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-end', 
    paddingHorizontal: 32, 
    paddingTop: 64, 
    paddingBottom: 24 
  },
  metaLabel: { 
    fontSize: 9, 
    letterSpacing: 2, 
    textTransform: 'uppercase', 
    fontWeight: '600', 
    color: 'rgba(0,0,0,0.4)', 
    marginBottom: 8 
  },
  title: { 
    fontFamily: font.serif, 
    fontSize: 36, 
    color: colors.black,
    letterSpacing: -0.5,
  },
  closeBtn: { marginBottom: 8 },
  content: { paddingHorizontal: 32, marginTop: 40 },
  sectionTitle: { 
    fontFamily: font.serif, 
    fontSize: 20, 
    fontStyle: 'italic', 
    color: colors.black, 
    marginBottom: 24 
  },
  menuItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 20, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f3f3f3' 
  },
  menuItemText: { 
    fontSize: 11, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    fontWeight: '500', 
    color: colors.black 
  },
  signOut: { paddingHorizontal: 32, marginTop: 48 },
  signOutText: { 
    fontSize: 10, 
    textTransform: 'uppercase', 
    letterSpacing: 3, 
    fontWeight: '600', 
    color: 'rgba(239,68,68,0.8)' 
  },
});
