import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import { createConvention } from "../src/storage/conventionsRepo";

export default function ConventionNewScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !startDate.trim() || !endDate.trim()) return;
    setSaving(true);
    try {
      const c = await createConvention({
        name: name.trim(),
        location: location.trim() || undefined,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
      });
      router.replace({ pathname: "/convention-detail", params: { id: c.id } });
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
        <Text style={styles.metaLabel}>New Convention</Text>
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.label}>NAME</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Anime Expo"
          placeholderTextColor={colors.textTertiary}
        />
        <Text style={styles.label}>LOCATION (OPTIONAL)</Text>
        <TextInput
          style={styles.input}
          value={location}
          onChangeText={setLocation}
          placeholder="City or venue"
          placeholderTextColor={colors.textTertiary}
        />
        <Text style={styles.label}>START DATE (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="2025-07-04"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numbers-and-punctuation"
        />
        <Text style={styles.label}>END DATE (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          value={endDate}
          onChangeText={setEndDate}
          placeholder="2025-07-06"
          placeholderTextColor={colors.textTertiary}
          keyboardType="numbers-and-punctuation"
        />
        <Pressable
          style={[styles.primaryBtn, saving && styles.disabled]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.primaryBtnText}>CREATE CONVENTION</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  metaLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
    color: colors.meta,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: layout.screenPaddingX, paddingBottom: 48 },
  label: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: "uppercase",
    fontWeight: "600",
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
  primaryBtn: {
    backgroundColor: colors.black,
    paddingVertical: 14,
    marginTop: 32,
    alignItems: "center",
    borderRadius: 2,
  },
  primaryBtnText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.white,
  },
  disabled: { opacity: 0.5 },
});
