import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@kyarafit/design-system/rn';

const fields = ['Item Name', 'Category', 'Tags'];

export default function AddItemScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.headerBtn}>
          <Ionicons name="close" size={24} color={colors.black} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerMeta}>Kyarafit</Text>
          <Text style={styles.headerTitle}>New Item</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardView} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scroll} 
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Upload Area */}
          <Pressable style={styles.uploadArea}>
            <Ionicons name="camera-outline" size={32} color="rgba(0,0,0,0.2)" />
            <Text style={styles.uploadText}>Upload Reference</Text>
          </Pressable>

          {/* Form */}
          <View style={styles.form}>
            {fields.map((label) => (
              <View key={label} style={styles.field}>
                <Text style={styles.fieldLabel}>{label}</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder={`Enter ${label}...`}
                  placeholderTextColor="rgba(0,0,0,0.3)"
                />
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Pressable style={styles.saveBtn} onPress={() => router.back()}>
          <Text style={styles.saveBtnText}>Save Item</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingTop: 48, 
    paddingBottom: 16,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  headerBtn: { width: 24 },
  headerCenter: { alignItems: 'center' },
  headerMeta: { 
    fontSize: 9, 
    textTransform: 'uppercase', 
    letterSpacing: 4, 
    fontWeight: '500', 
    color: 'rgba(0,0,0,0.4)' 
  },
  headerTitle: { 
    fontFamily: font.serif, 
    fontSize: 20, 
    fontWeight: 'bold', 
    fontStyle: 'italic', 
    color: colors.black,
    marginTop: 2,
  },
  keyboardView: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 140 },
  uploadArea: { 
    aspectRatio: 3 / 4, 
    backgroundColor: '#f9f9f9', 
    borderWidth: 1, 
    borderColor: '#e5e5e5', 
    borderStyle: 'dashed', 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 16, 
    marginBottom: 40 
  },
  uploadText: { 
    fontSize: 10, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    color: 'rgba(0,0,0,0.4)', 
    marginTop: 16 
  },
  form: { gap: 40 },
  field: {},
  fieldLabel: { 
    fontSize: 10, 
    textTransform: 'uppercase', 
    letterSpacing: 2, 
    fontWeight: 'bold', 
    color: colors.black, 
    marginBottom: 8 
  },
  fieldInput: { 
    borderBottomWidth: 1, 
    borderBottomColor: colors.black, 
    paddingVertical: 12, 
    fontSize: 14, 
    color: colors.black 
  },
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    padding: 24, 
    backgroundColor: colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtn: { 
    backgroundColor: colors.black, 
    paddingVertical: 20, 
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: { 
    fontSize: 11, 
    textTransform: 'uppercase', 
    letterSpacing: 3, 
    fontWeight: 'bold', 
    color: colors.white 
  },
});
