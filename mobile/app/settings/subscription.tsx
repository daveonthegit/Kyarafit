import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTier } from "../../src/hooks/useTier";

function formatStorageMb(n: number) {
  if (n < 0) return "∞";
  return `${n.toFixed(1)} MB`;
}

export default function SettingsSubscriptionScreen() {
  const router = useRouter();
  const { data: tier, isLoading } = useTier();
  const isFree = tier?.tier === "FREE";

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 80 }}>
        <View className="flex-row justify-between items-end px-8 pt-16 pb-6">
          <View>
            <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/40 mb-2">
              Settings
            </Text>
            <Text className="font-serif text-3xl text-black tracking-tight">Subscription Plan</Text>
          </View>
          <Pressable onPress={() => router.back()} className="mb-2">
            <Ionicons name="arrow-back" size={24} color="#000" />
          </Pressable>
        </View>

        <View className="px-8 mt-6">
          {isLoading && <Text className="text-sm text-black/50">Loading…</Text>}
          {!isLoading && tier && (
            <View className="gap-6">
              <View className="py-3 border-b border-black/5">
                <Text className="text-[11px] uppercase tracking-widest text-black/45 mb-1">
                  Current plan
                </Text>
                <Text className="text-sm font-medium text-black" testID="subscription-tier">
                  {tier.tier}
                </Text>
              </View>
              {tier.storageLimitMb >= 0 && (
                <View className="py-3 border-b border-black/5">
                  <Text className="text-[11px] uppercase tracking-widest text-black/45 mb-1">
                    Storage
                  </Text>
                  <Text className="text-sm text-black" testID="subscription-storage">
                    {formatStorageMb(tier.currentUsageMb)} / {formatStorageMb(tier.storageLimitMb)}
                  </Text>
                </View>
              )}
              {tier.storageLimitMb === -1 && (
                <View className="py-3 border-b border-black/5">
                  <Text className="text-[11px] uppercase tracking-widest text-black/45 mb-1">
                    Storage
                  </Text>
                  <Text className="text-sm text-black" testID="subscription-storage">
                    {formatStorageMb(tier.currentUsageMb)} used (unlimited)
                  </Text>
                </View>
              )}
              <Text className="text-[11px] text-black/45">
                {isFree
                  ? "Upgrade for backup, export, and more storage. Stripe checkout uses the web app when enabled."
                  : "Manage subscription on the web app for Stripe portal access."}
              </Text>
            </View>
          )}
          {!isLoading && !tier && (
            <Text className="text-sm text-black/50">Sign in to see your plan.</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
