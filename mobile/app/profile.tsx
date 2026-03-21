import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useCurrentUser } from "../src/hooks/useCurrentUser";

export default function ProfileScreen() {
  const router = useRouter();
  const { identity } = useCurrentUser();

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center gap-4 px-6 pt-14 pb-4 border-b border-black/5">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
          User
        </Text>
      </View>
      <View className="p-6 mt-4">
        <Text className="text-[10px] uppercase tracking-[0.2em] text-black/50 mb-1">Profile</Text>
        <Text className="font-serif text-3xl font-bold italic text-black">
          {identity ? identity.name || "User" : "Anonymous"}
        </Text>
        <Text className="text-sm text-black/60 mt-2">
          {identity ? identity.email : "Not signed in"}
        </Text>
      </View>
    </View>
  );
}
