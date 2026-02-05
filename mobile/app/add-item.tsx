import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { colors, font } from "@kyarafit/design-system/rn";
import {
  CLOSET_CATEGORIES,
  createClosetItemSchema,
  type ClosetCategory,
} from "@kyarafit/design-system/types";
import { UnderlineInput } from "../src/components/ui/UnderlineInput";
import { upsertItem } from "../src/storage/closetRepo";
import { enqueue } from "../src/storage/outboxRepo";

function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function AddItemScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<ClosetCategory>("other");
  const [tagsStr, setTagsStr] = useState("");
  const [notes, setNotes] = useState("");
  const [costDollars, setCostDollars] = useState("");
  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Allow access to photos to add an image.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setImageLocalUri(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    setNameError("");
    const tags = tagsStr
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const parsed = createClosetItemSchema.safeParse({
      name: name.trim(),
      category,
      tags,
      notes: notes.trim() || undefined,
      imageLocalUri: imageLocalUri ?? undefined,
      costCents: costDollars.trim()
        ? Math.round(parseFloat(costDollars) * 100)
        : undefined,
    });
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Invalid fields";
      setNameError(msg);
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    const id = generateId();
    const item = {
      id,
      name: parsed.data.name,
      category: parsed.data.category,
      tags: parsed.data.tags ?? [],
      notes: parsed.data.notes,
      imageLocalUri: parsed.data.imageLocalUri,
      imageUrl: undefined as string | undefined,
      costCents: parsed.data.costCents,
      createdAt: now,
      updatedAt: now,
    };
    await upsertItem(item);
    await enqueue("upsert", { item });
    setSaving(false);
    router.back();
  };

  return (
    <View style={styles.container}>
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
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable style={styles.uploadArea} onPress={pickImage}>
            {imageLocalUri ? (
              <Image
                source={{ uri: imageLocalUri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
            ) : (
              <>
                <Ionicons
                  name="camera-outline"
                  size={32}
                  color="rgba(0,0,0,0.2)"
                />
                <Text style={styles.uploadText}>Add Photo</Text>
              </>
            )}
          </Pressable>

          <View style={styles.form}>
            <UnderlineInput
              label="Item name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Arlecchino Wig"
              error={nameError}
            />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryRow}
              >
                {CLOSET_CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[
                      styles.categoryChip,
                      category === c && styles.categoryChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        category === c && styles.categoryChipTextActive,
                      ]}
                    >
                      {c}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
            <UnderlineInput
              label="Tags (comma-separated)"
              value={tagsStr}
              onChangeText={setTagsStr}
              placeholder="wig, character, red"
            />
            <UnderlineInput
              label="Cost $ (optional)"
              value={costDollars}
              onChangeText={setCostDollars}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <UnderlineInput
              label="Notes"
              value={notes}
              onChangeText={setNotes}
              placeholder="Optional notes"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <Pressable
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={styles.saveBtnText}>
            {saving ? "Saving…" : "Save Item"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  headerBtn: { width: 24 },
  headerCenter: { alignItems: "center" },
  headerMeta: {
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 4,
    fontWeight: "500",
    color: "rgba(0,0,0,0.4)",
  },
  headerTitle: {
    fontFamily: font.family.serifDisplay,
    fontSize: 20,
    fontWeight: "bold",
    fontStyle: "italic",
    color: colors.black,
    marginTop: 2,
  },
  keyboardView: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 24, paddingBottom: 140 },
  uploadArea: {
    aspectRatio: 3 / 4,
    backgroundColor: "#f9f9f9",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 40,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  uploadText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "rgba(0,0,0,0.4)",
    marginTop: 16,
  },
  form: { gap: 24 },
  field: { marginBottom: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "rgba(0,0,0,0.5)",
    marginBottom: 8,
  },
  categoryRow: { flexGrow: 0, marginBottom: 8 },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 2,
  },
  categoryChipActive: {
    backgroundColor: colors.black,
  },
  categoryChipText: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.black,
  },
  categoryChipTextActive: {
    color: colors.white,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    backgroundColor: colors.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtn: {
    backgroundColor: colors.black,
    paddingVertical: 20,
    alignItems: "center",
    borderRadius: 2,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 3,
    fontWeight: "bold",
    color: colors.white,
  },
});
