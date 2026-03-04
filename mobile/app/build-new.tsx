import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import { processImageForUpload } from "../src/lib/imageUtils";
import { createBuild } from "../src/storage/buildsRepo";

export default function BuildNewScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [status, setStatus] = useState<"idea" | "wip" | "ready">("idea");
  const [imageUrl, setImageUrl] = useState("");
  const [imageMode, setImageMode] = useState<"file" | "url">("file");
  const [imageLocalUri, setImageLocalUri] = useState<string | null>(null);
  const [budgetCents, setBudgetCents] = useState("");
  const [saving, setSaving] = useState(false);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to photos to add an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const processedUri = await processImageForUpload(result.assets[0].uri);
        setImageLocalUri(processedUri);
        setImageUrl(processedUri);
      } catch (e) {
        Alert.alert("Image error", "Failed to process image. Try another.");
      }
    }
  };

  const save = async () => {
    const finalImageUrl = imageMode === "file" ? imageLocalUri : imageUrl.trim();
    if (!name.trim() || !finalImageUrl) return;
    setSaving(true);
    try {
      const b = await createBuild({
        name: name.trim(),
        status,
        imageUrl: finalImageUrl,
        budgetCents: budgetCents.trim() ? Math.round(parseFloat(budgetCents) * 100) : undefined,
      });
      router.replace({ pathname: "/build-detail", params: { id: b.id } });
    } finally {
      setSaving(false);
    }
  };

  const hasImage = imageMode === "file" ? !!imageLocalUri : !!imageUrl.trim();

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
        <Text style={styles.label}>IMAGE (REQUIRED)</Text>
        <View style={styles.imageModeToggle}>
          <Pressable
            style={[styles.modeBtn, imageMode === "file" && styles.modeBtnActive]}
            onPress={() => setImageMode("file")}
          >
            <Text style={[styles.modeBtnText, imageMode === "file" && styles.modeBtnTextActive]}>
              Upload File
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, imageMode === "url" && styles.modeBtnActive]}
            onPress={() => setImageMode("url")}
          >
            <Text style={[styles.modeBtnText, imageMode === "url" && styles.modeBtnTextActive]}>
              Enter URL
            </Text>
          </Pressable>
        </View>
        {imageMode === "file" ? (
          <View>
            <Pressable style={styles.imagePickerBtn} onPress={pickImage}>
              <Ionicons name="cloud-upload-outline" size={32} color={colors.textTertiary} />
              <Text style={styles.imagePickerText}>Tap to select image</Text>
              <Text style={styles.imagePickerSubtext}>Stored locally</Text>
            </Pressable>
            {imageLocalUri && (
              <View style={styles.imagePreview}>
                <Image
                  source={{ uri: imageLocalUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
              </View>
            )}
          </View>
        ) : (
          <TextInput
            style={styles.input}
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://…"
            placeholderTextColor={colors.textTertiary}
          />
        )}
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
          {(["idea", "wip", "ready"] as const).map((s) => (
            <Pressable
              key={s}
              style={[styles.statusBtn, status === s && styles.statusBtnActive]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.statusText, status === s && styles.statusTextActive]}>{s}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.primaryBtn, (saving || !name.trim() || !hasImage) && styles.disabled]}
          onPress={save}
          disabled={saving || !name.trim() || !hasImage}
        >
          <Text style={styles.primaryBtnText}>CREATE BUILD</Text>
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
  imageModeToggle: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  modeBtnActive: {
    borderColor: colors.black,
    backgroundColor: colors.muted,
  },
  modeBtnText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: colors.textTertiary,
    fontWeight: "500",
  },
  modeBtnTextActive: {
    color: colors.black,
    fontWeight: "600",
  },
  imagePickerBtn: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.border,
    paddingVertical: 32,
    alignItems: "center",
    gap: 8,
    borderRadius: 2,
  },
  imagePickerText: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    color: colors.text,
    fontWeight: "500",
  },
  imagePickerSubtext: {
    fontSize: 10,
    color: colors.textTertiary,
    marginTop: 4,
  },
  imagePreview: {
    marginTop: 16,
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.muted,
    borderRadius: 2,
    overflow: "hidden",
  },
  previewImage: {
    width: "100%",
    height: "100%",
  },
  statusRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  statusBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBtnActive: { borderColor: colors.black, backgroundColor: colors.muted },
  statusText: {
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  statusTextActive: { color: colors.black, fontWeight: "600" },
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
