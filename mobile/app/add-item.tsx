import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { processImageForUpload } from "../src/lib/imageUtils";
import {
  CLOSET_CATEGORIES,
  createClosetItemSchema,
  type ClosetCategory,
} from "@kyarafit/design-system/types";
import { UnderlineInput } from "../src/components/ui/UnderlineInput";
import { upsertItem } from "../src/storage/closetRepo";

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
  const [imageUrl, setImageUrl] = useState("");
  const [imageMode, setImageMode] = useState<"device" | "url">("device");
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState("");

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Allow access to photos to add an image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      try {
        const processedUri = await processImageForUpload(result.assets[0].uri);
        setImageLocalUri(processedUri);
      } catch (e) {
        Alert.alert("Image error", "Failed to process image. Try another.");
      }
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
      imageLocalUri: imageMode === "device" ? (imageLocalUri ?? undefined) : undefined,
      imageUrl: imageMode === "url" ? imageUrl.trim() || undefined : undefined,
      costCents: costDollars.trim() ? Math.round(parseFloat(costDollars) * 100) : undefined,
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
      imageUrl: parsed.data.imageUrl,
      costCents: parsed.data.costCents,
      createdAt: now,
      updatedAt: now,
    };
    await upsertItem(item);
    setSaving(false);
    router.back();
  };

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row justify-between items-center px-6 pt-14 pb-4 bg-white/95 border-b border-black/5">
        <Pressable onPress={() => router.back()} className="w-6">
          <Ionicons name="close" size={24} color="#000" />
        </Pressable>
        <View className="items-center">
          <Text className="text-[9px] uppercase tracking-[0.4em] font-medium text-black/40">
            Kyarafit
          </Text>
          <Text className="font-serif text-xl font-bold italic text-black mt-0.5">New Item</Text>
        </View>
        <View className="w-6" />
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mt-4 mb-10">
            <View className="flex-row gap-2 mb-4">
              <Pressable
                className={`px-3 py-2 border rounded-full ${imageMode === "device" ? "bg-[#f9f9f9] border-black" : "bg-transparent border-black/10"}`}
                onPress={() => setImageMode("device")}
              >
                <Text
                  className={`text-[10px] uppercase tracking-[0.2em] ${imageMode === "device" ? "font-semibold text-black" : "font-medium text-black/40"}`}
                >
                  Device
                </Text>
              </Pressable>
              <Pressable
                className={`px-3 py-2 border rounded-full ${imageMode === "url" ? "bg-[#f9f9f9] border-black" : "bg-transparent border-black/10"}`}
                onPress={() => setImageMode("url")}
              >
                <Text
                  className={`text-[10px] uppercase tracking-[0.2em] ${imageMode === "url" ? "font-semibold text-black" : "font-medium text-black/40"}`}
                >
                  URL
                </Text>
              </Pressable>
            </View>

            {imageMode === "device" ? (
              <Pressable
                className="aspect-[3/4] bg-[#f9f9f9] border border-dashed border-black/10 justify-center items-center overflow-hidden rounded-[24px]"
                onPress={pickImage}
              >
                {imageLocalUri ? (
                  <Image
                    source={{ uri: imageLocalUri }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <>
                    <Ionicons name="camera-outline" size={32} color="rgba(0,0,0,0.2)" />
                    <Text className="text-[10px] uppercase tracking-[0.2em] text-black/40 mt-4">
                      Add Photo
                    </Text>
                  </>
                )}
              </Pressable>
            ) : (
              <View className="gap-4">
                <UnderlineInput
                  label="Image URL"
                  value={imageUrl}
                  onChangeText={setImageUrl}
                  placeholder="https://example.com/image.jpg"
                />
                {imageUrl.trim() && (
                  <View className="aspect-[3/4] bg-[#f9f9f9] overflow-hidden border border-black/10 rounded-[24px]">
                    <Image
                      source={{ uri: imageUrl }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                  </View>
                )}
              </View>
            )}
          </View>

          <View className="gap-6">
            <UnderlineInput
              label="Item name"
              value={name}
              onChangeText={setName}
              placeholder="e.g. Arlecchino Wig"
              error={nameError}
            />
            <View className="mb-2">
              <Text className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black/50 mb-2">
                Category
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="flex-grow-0 mb-2"
              >
                {CLOSET_CATEGORIES.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    className={`px-3 py-2 mr-2 border rounded-full ${category === c ? "bg-black border-black" : "border-black/10"}`}
                  >
                    <Text
                      className={`text-xs uppercase tracking-widest ${category === c ? "text-white" : "text-black"}`}
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

      <View className="absolute bottom-0 left-0 right-0 p-6 bg-white shadow-md z-10 border-t border-black/5">
        <Pressable
          className={`bg-black py-5 items-center rounded-full ${saving ? "opacity-60" : ""}`}
          onPress={handleSave}
          disabled={saving}
        >
          <Text className="text-[11px] uppercase tracking-[0.3em] font-bold text-white">
            {saving ? "Saving…" : "Save Item"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
