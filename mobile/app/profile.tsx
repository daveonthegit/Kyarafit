import { View, Text, Pressable, ScrollView, Image } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import { useSession } from "../src/lib/auth/client";
import { StorageImage } from "../src/components/shared";
import { useTranslation } from "react-i18next";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const { userId } = useCurrentUser();
  const convexUser = useQuery(api.users.getByExternalId, userId ? { externalId: userId } : "skip");
  const sessionUser = session?.user;

  const displayName = sessionUser?.name ?? convexUser?.displayName ?? convexUser?.name ?? "User";
  const email = sessionUser?.email;

  return (
    <View className="flex-1 bg-white">
      <View className="flex-row items-center gap-4 px-6 pt-14 pb-4 border-b border-black/5">
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/50">
          {t("Profile.metaYou")}
        </Text>
      </View>
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingBottom: 48 }}>
        <View className="flex-row gap-4 items-start mb-8">
          <View className="w-20 h-20 rounded-full overflow-hidden border border-black/10 bg-[#F5F5F5]">
            {convexUser?.imageStorageId ? (
              <StorageImage
                imageStorageId={convexUser.imageStorageId}
                imageUrl={convexUser.image}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : sessionUser?.image ? (
              <Image
                source={{ uri: sessionUser.image }}
                style={{ width: "100%", height: "100%" }}
                resizeMode="cover"
              />
            ) : (
              <View className="flex-1 items-center justify-center">
                <Ionicons name="person" size={32} color="#999" />
              </View>
            )}
          </View>
          <View className="flex-1">
            <Text className="font-serif text-3xl italic text-black">{displayName}</Text>
            {email ? <Text className="text-sm text-black/55 mt-1">{email}</Text> : null}
            {convexUser?.username ? (
              <Text className="text-[10px] uppercase tracking-widest text-black/45 mt-2">
                @{convexUser.username}
              </Text>
            ) : null}
          </View>
        </View>

        {userId ? (
          <>
            {convexUser?.profileVisibility === "public" && convexUser.username ? (
              <Pressable
                className="border border-black py-3.5 items-center rounded-full mb-3"
                onPress={() =>
                  router.push({
                    pathname: "/user/[username]",
                    params: { username: convexUser.username! },
                  } as unknown as Parameters<typeof router.push>[0])
                }
              >
                <Text className="text-[11px] font-semibold uppercase tracking-[0.2em] text-black">
                  {t("Profile.viewPublic")}
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              className="bg-black py-3.5 items-center rounded-full mb-3"
              onPress={() =>
                router.push("/settings/account" as unknown as Parameters<typeof router.push>[0])
              }
            >
              <Text className="text-[11px] font-bold uppercase tracking-[0.2em] text-white">
                {t("Profile.accountSettings")}
              </Text>
            </Pressable>

            <Pressable className="py-3" onPress={() => router.push("/settings")}>
              <Text className="text-[11px] uppercase tracking-widest text-black/55 underline">
                {t("Profile.allSettings")}
              </Text>
            </Pressable>
          </>
        ) : (
          <Text className="text-sm text-black/50">{t("Profile.signInBlurb")}</Text>
        )}
      </ScrollView>
    </View>
  );
}
