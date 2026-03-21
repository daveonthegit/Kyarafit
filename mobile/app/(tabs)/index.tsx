import { View, Text, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useCurrentUser } from "../../src/hooks/useCurrentUser";
import { ImageCard } from "../../src/components/ui/ImageCard";

export default function HomeScreen() {
  const router = useRouter();
  const { userId } = useCurrentUser();

  const focusedOrRecent = useQuery(
    api.builds.getFocusedOrMostRecentForUser,
    userId ? { userId } : "skip"
  );

  const upcomingWithCounts = useQuery(
    api.conventions.listUpcomingWithPlanCounts,
    userId ? { userId, limit: 3 } : "skip"
  );

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 140 }}>
        <View className="flex-row justify-between items-end px-6 pt-14 pb-6">
          <View>
            <Text className="text-[9px] tracking-[0.2em] uppercase font-semibold text-black/50 mb-1">
              Kyarafit
            </Text>
            <Text className="font-serif text-4xl italic text-black tracking-tight">
              The Lookbook
            </Text>
          </View>
          <View className="flex-row gap-4 mb-1">
            <Pressable onPress={() => router.push("/settings")}>
              <Ionicons name="menu-outline" size={24} color="#000" />
            </Pressable>
          </View>
        </View>

        <View className="px-6 mb-12">
          {focusedOrRecent ? (
            <ImageCard
              imageUrl={focusedOrRecent.imageUrl}
              title={focusedOrRecent.name}
              subtitle={
                focusedOrRecent.character
                  ? focusedOrRecent.character
                  : `${focusedOrRecent.tasksChecked}/${focusedOrRecent.tasksTotal} tasks`
              }
              aspectRatio={4 / 5}
              onPress={() =>
                router.push({ pathname: "/build-detail", params: { id: focusedOrRecent._id } })
              }
            />
          ) : (
            <Pressable
              className="w-full aspect-[4/5] bg-[#F9F9F9] border border-black/5 items-center justify-center rounded-xl"
              onPress={() => router.push("/(tabs)/builds")}
            >
              <Ionicons name="layers-outline" size={48} color="rgba(0,0,0,0.4)" />
              <Text className="mt-3 text-sm text-black/40 font-sans">Plan New Cosplay</Text>
            </Pressable>
          )}
          <View className="mt-6 flex-row justify-between items-end">
            <View className="max-w-[70%]">
              <Text className="text-[10px] uppercase tracking-[0.2em] text-black/50 mb-1">
                Current Focus
              </Text>
              <Text className="font-serif text-2xl italic text-black">
                {focusedOrRecent ? focusedOrRecent.name : "Builds & Conventions"}
              </Text>
            </View>
            <Pressable onPress={() => router.push("/(tabs)/builds")}>
              <Text className="text-[10px] uppercase tracking-[0.2em] text-black border border-black px-3 py-1 rounded">
                View Builds
              </Text>
            </Pressable>
          </View>
        </View>

        {upcomingWithCounts && upcomingWithCounts.length > 0 && (
          <View className="pt-6 border-t border-black/5 pb-12">
            <Text className="text-[11px] uppercase tracking-[0.2em] font-semibold text-black mb-4 px-6">
              Upcoming Events
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 24 }}
            >
              {upcomingWithCounts.map(({ convention, outfitCount }) => (
                <View key={convention._id} className="w-[280px] mr-4">
                  <ImageCard
                    imageUrl={convention.imageUrl}
                    title={convention.name}
                    subtitle={`${convention.startDate} · ${outfitCount} outfits planned`}
                    aspectRatio={21 / 9}
                    onPress={() =>
                      router.push({
                        pathname: "/convention-detail",
                        params: { id: convention._id },
                      })
                    }
                  />
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View className="px-6 pt-6 border-t border-black/5">
          <Text className="text-[11px] uppercase tracking-[0.2em] font-semibold text-black mb-4">
            Quick links
          </Text>
          <Pressable
            className="flex-row justify-between items-center py-4 border-b border-black/5"
            onPress={() => router.push("/(tabs)/builds")}
          >
            <Text className="font-serif text-2xl italic text-black">My Builds</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.4)" />
          </Pressable>
          <Pressable
            className="flex-row justify-between items-center py-4 border-b border-black/5"
            onPress={() => router.push("/plan")}
          >
            <Text className="font-serif text-2xl italic text-black">Conventions</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.4)" />
          </Pressable>
          <Pressable
            className="flex-row justify-between items-center py-4 border-b border-black/5"
            onPress={() => router.push("/closet")}
          >
            <Text className="font-serif text-2xl italic text-black">Closet</Text>
            <Ionicons name="chevron-forward" size={18} color="rgba(0,0,0,0.4)" />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}
