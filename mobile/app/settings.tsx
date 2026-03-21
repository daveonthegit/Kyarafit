import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSession, signOut } from "../src/lib/auth/client";

const menuItems = ["Account Details", "Subscription Plan", "Notification Style"];

export default function SettingsScreen() {
  const router = useRouter();
  const { session } = useSession();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header */}
        <View className="flex-row justify-between items-end px-8 pt-16 pb-6">
          <View>
            <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/40 mb-2">
              System Preferences
            </Text>
            <Text className="font-serif text-4xl text-black tracking-tight">Settings</Text>
          </View>
          <Pressable onPress={() => router.back()} className="mb-2">
            <Ionicons name="close" size={24} color="#000" />
          </Pressable>
        </View>

        {/* Tier / sync copy */}
        {!session && (
          <View className="px-8 mt-4 py-2">
            <Text className="text-[11px] uppercase tracking-[0.15em] font-semibold text-black/50">
              Local-only mode
            </Text>
            <Text className="text-[10px] text-black/60 mt-1">Sign in to sync across devices.</Text>
            <Pressable
              className="mt-4 border border-black py-3 items-center"
              onPress={() => router.push("/auth")}
            >
              <Text className="text-[11px] uppercase tracking-[0.2em] font-semibold text-black">
                Sign In or Create Account
              </Text>
            </Pressable>
          </View>
        )}
        {session && (
          <View className="px-8 mt-4 py-2">
            <Text className="text-[10px] text-black/60 mt-1">Upgrade for backup and export.</Text>
          </View>
        )}

        {/* Content */}
        <View className="px-8 mt-10">
          <Text className="font-serif text-xl italic text-black mb-6">Profile & Identity</Text>
          {menuItems.map((item) => (
            <Pressable
              key={item}
              className="flex-row justify-between items-center py-5 border-b border-black/5"
            >
              <Text className="text-[11px] uppercase tracking-[0.2em] font-medium text-black">
                {item}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(0,0,0,0.3)" />
            </Pressable>
          ))}
        </View>

        {session && (
          <Pressable className="px-8 mt-12" onPress={handleSignOut}>
            <Text className="text-[10px] uppercase tracking-[0.3em] font-semibold text-red-500/80">
              Sign Out
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
