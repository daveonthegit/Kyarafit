import { useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font, layout } from '@kyarafit/design-system/rn';
import { createBuild } from '../src/storage/buildsRepo';

export default function BuildNewScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'idea' | 'wip' | 'ready'>('idea');
  const [imageUrl, setImageUrl] = useState('');
  const [budgetCents, setBudgetCents] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const b = await createBuild({
        name: name.trim(),
        status,
        imageUrl: imageUrl.trim() || undefined,
        budgetCents: budgetCents.trim() ? Math.round(parseFloat(budgetCents) * 100) : undefined,
      });
      router.replace({ pathname: '/build-detail', params: { id: b.id } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.black} />
        </Pressable>
        <Text style={styles.metaLabel}>New Build</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Arlecchino"
          placeholderTextColor={colors.textTertiary}
        />
        <Text style={styles.label}>IMAGE URL (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={imageUrl}
          onChangeText={setImageUrl}
          placeholder="https://…"
          placeholderTextColor={colors.textTertiary}
        />
        <Text style={styles.label}>BUDGET $ (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={budgetCents}
          onChangeText={setBudgetCents}
          placeholder="0.00"
          placeholderTextColor={colors.textTertiary}
          keyboardType="decimal-pad"
        />
        <Text style={styles.label}>STATUS</Text>
        <View style={styles.statusRow}>
          {(['idea', 'wip', 'ready'] as const).map((s) => (
            <Pressable
              key={s}
              style={[styles.statusBtn, status === s && styles.statusBtnActive]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.statusText, status === s && styles.statusTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={[styles.primaryBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
          <Text style={styles.primaryBtnText}>CREATE BUILD</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  metaLabel: { fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', fontWeight: '600', color: colors.meta },
  scroll: { flex: 1 },
  scrollContent: { padding: layout.screenPaddingX, paddingBottom: 48 },
  label: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
    color: colors.meta,
    marginBottom: 8,
    marginTop: 24,
  },
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderStrong,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  statusRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  statusBtn: { paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, borderColor: colors.border },
  statusBtnActive: { borderColor: colors.black, backgroundColor: colors.muted },
  statusText: { fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, color: colors.textTertiary },
  statusTextActive: { color: colors.black, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: colors.black,
    paddingVertical: 14,
    marginTop: 32,
    alignItems: 'center',
    borderRadius: 2,
  },
  primaryBtnText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 2, color: colors.white },
  disabled: { opacity: 0.5 },
});
