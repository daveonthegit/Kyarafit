import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@kyarafit/design-system/rn';
import { useSession, signOut } from '../src/lib/auth/client';

const menuItems = ['Account Details', 'Subscription Plan', 'Notification Style'];

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useSession();

  const handleSignOut = async () => {
    await signOut();
  };

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

        {/* Tier / sync copy */}
        {!session && (
          <View style={styles.tierNote}>
            <Text style={styles.tierNoteText}>Local-only mode</Text>
            <Text style={styles.tierNoteSub}>Sign in to sync across devices.</Text>
            <Pressable 
              style={styles.signInBtn} 
              onPress={() => router.push('/auth')}
            >
              <Text style={styles.signInBtnText}>Sign In or Create Account</Text>
            </Pressable>
          </View>
        )}
        {session && (
          <View style={styles.tierNote}>
            <Text style={styles.tierNoteSub}>Upgrade for backup and export.</Text>
          </View>
        )}

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

        {session && (
          <Pressable style={styles.signOut} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </Pressable>
        )}
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
  tierNote: { paddingHorizontal: 32, marginTop: 16, paddingVertical: 8 },
  tierNoteText: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: '600', color: colors.meta },
  tierNoteSub: { fontSize: 10, color: colors.textSecondary, marginTop: 2 },
  signInBtn: { 
    marginTop: 16, 
    borderWidth: 1, 
    borderColor: colors.black, 
    paddingVertical: 12, 
    alignItems: 'center' 
  },
  signInBtnText: { 
    fontSize: 11, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    fontWeight: '600', 
    color: colors.black 
  },
});
