import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Alert, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
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
    <View className="flex-1 bg-white">
      <View className="flex-row items-center gap-4 px-6 pt-14 pb-4 border-b border-black/5">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#000" />
        </Pressable>
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
          New Build
        </Text>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2 mt-6">
          NAME
        </Text>
        <TextInput
          className="border-b border-black/10 py-3 text-base text-black"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Arlecchino"
          placeholderTextColor="rgba(0,0,0,0.4)"
        />
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2 mt-6">
          IMAGE (REQUIRED)
        </Text>
        <View className="flex-row gap-2 mb-4">
          <Pressable
            className={`flex-1 py-2 px-3 border items-center rounded-full ${
              imageMode === "file" ? "border-black bg-[#F9F9F9]" : "border-black/10 bg-transparent"
            }`}
            onPress={() => setImageMode("file")}
          >
            <Text
              className={`text-[11px] uppercase tracking-[0.15em] ${
                imageMode === "file" ? "font-semibold text-black" : "font-medium text-black/40"
              }`}
            >
              Upload File
            </Text>
          </Pressable>
          <Pressable
            className={`flex-1 py-2 px-3 border items-center rounded-full ${
              imageMode === "url" ? "border-black bg-[#F9F9F9]" : "border-black/10 bg-transparent"
            }`}
            onPress={() => setImageMode("url")}
          >
            <Text
              className={`text-[11px] uppercase tracking-[0.15em] ${
                imageMode === "url" ? "font-semibold text-black" : "font-medium text-black/40"
              }`}
            >
              Enter URL
            </Text>
          </Pressable>
        </View>
        {imageMode === "file" ? (
          <View>
            <Pressable
              className="border-2 border-dashed border-black/10 py-8 items-center gap-2 rounded-sm"
              onPress={pickImage}
            >
              <Ionicons name="cloud-upload-outline" size={32} color="rgba(0,0,0,0.4)" />
              <Text className="text-xs uppercase tracking-[0.15em] text-black font-medium">
                Tap to select image
              </Text>
              <Text className="text-[10px] text-black/40 mt-1">Stored locally</Text>
            </Pressable>
            {imageLocalUri && (
              <View className="mt-4 w-full aspect-square bg-[#F9F9F9] rounded-sm overflow-hidden">
                <Image
                  source={{ uri: imageLocalUri }}
                  className="w-full h-full"
                  resizeMode="cover"
                />
              </View>
            )}
          </View>
        ) : (
          <TextInput
            className="border-b border-black/10 py-3 text-base text-black"
            value={imageUrl}
            onChangeText={setImageUrl}
            placeholder="https://…"
            placeholderTextColor="rgba(0,0,0,0.4)"
          />
        )}
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2 mt-6">
          BUDGET $ (OPTIONAL)
        </Text>
        <TextInput
          className="border-b border-black/10 py-3 text-base text-black"
          value={budgetCents}
          onChangeText={setBudgetCents}
          placeholder="0.00"
          placeholderTextColor="rgba(0,0,0,0.4)"
          keyboardType="decimal-pad"
        />
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2 mt-6">
          STATUS
        </Text>
        <View className="flex-row gap-3 mt-2">
          {(["idea", "wip", "ready"] as const).map((s) => (
            <Pressable
              key={s}
              className={`py-2.5 px-4 border ${status === s ? "border-black bg-[#F9F9F9]" : "border-black/10"}`}
              onPress={() => setStatus(s)}
            >
              <Text
                className={`text-xs uppercase tracking-widest ${status === s ? "text-black font-semibold" : "text-black/40"}`}
              >
                {s}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          className={`bg-black py-3.5 mt-8 items-center rounded-full ${saving || !name.trim() || !hasImage ? "opacity-50" : ""}`}
          onPress={save}
          disabled={saving || !name.trim() || !hasImage}
        >
          <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
            CREATE BUILD
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
