import { useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
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
    <View className="flex-1 bg-white">
      <View className="flex-row items-center gap-4 px-6 pt-14 pb-4 border-b border-black/5">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="close" size={24} color="#000" />
        </Pressable>
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
          New Convention
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
          placeholder="e.g. Anime Expo"
          placeholderTextColor="rgba(0,0,0,0.4)"
        />
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2 mt-6">
          LOCATION (OPTIONAL)
        </Text>
        <TextInput
          className="border-b border-black/10 py-3 text-base text-black"
          value={location}
          onChangeText={setLocation}
          placeholder="City or venue"
          placeholderTextColor="rgba(0,0,0,0.4)"
        />
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2 mt-6">
          START DATE (YYYY-MM-DD)
        </Text>
        <TextInput
          className="border-b border-black/10 py-3 text-base text-black"
          value={startDate}
          onChangeText={setStartDate}
          placeholder="2025-07-04"
          placeholderTextColor="rgba(0,0,0,0.4)"
          keyboardType="numbers-and-punctuation"
        />
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50 mb-2 mt-6">
          END DATE (YYYY-MM-DD)
        </Text>
        <TextInput
          className="border-b border-black/10 py-3 text-base text-black"
          value={endDate}
          onChangeText={setEndDate}
          placeholder="2025-07-06"
          placeholderTextColor="rgba(0,0,0,0.4)"
          keyboardType="numbers-and-punctuation"
        />
        <Pressable
          className={`bg-black py-3.5 mt-8 items-center rounded-full ${saving ? "opacity-50" : ""}`}
          onPress={save}
          disabled={saving}
        >
          <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
            CREATE CONVENTION
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}
