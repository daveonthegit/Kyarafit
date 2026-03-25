import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function SettingsNotificationsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>
        <View className="flex-row justify-between items-end px-8 pt-16 pb-6">
          <View>
            <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/40 mb-2">
              Settings
            </Text>
            <Text className="font-serif text-3xl text-black tracking-tight">
              Notification Style
            </Text>
          </View>
          <Pressable onPress={() => router.back()} className="mb-2">
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
        </View>
        <View className="px-8 mt-6">
          <Text className="text-sm text-black/50" testID="notifications-placeholder">
            Notification preferences coming soon.
          </Text>
          <Text className="text-xs text-black/40 mt-3">
            Matches the web app — granular controls will appear here in a future release.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
