import { View, Text, FlatList, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import { ScreenHeader, EmptyState, KyarIcon } from "../src/components/shared";
import { colors } from "@kyarafit/design-system/rn";
import { useTranslation } from "react-i18next";

export default function GroupsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { userId } = useCurrentUser();
  const groups = useQuery(api.groups.listForUser, userId ? { userId } : "skip");

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        meta={t("Groups.meta")}
        title={t("Groups.title")}
        onBack={() => router.back()}
        trailing={
          userId ? (
            <Pressable
              onPress={() => router.push("/group-new" as Parameters<typeof router.push>[0])}
              hitSlop={12}
            >
              <Text className="text-[10px] uppercase tracking-widest font-bold text-black">
                {t("Common.new")}
              </Text>
            </Pressable>
          ) : undefined
        }
      />
      {!userId ? (
        <View className="px-6 mt-8">
          <EmptyState
            icon="groups"
            message={t("Groups.signIn")}
            secondary={t("Groups.signInSecondary")}
          />
        </View>
      ) : groups === undefined ? (
        <Text className="text-center mt-12 text-black/50">{t("Groups.loading")}</Text>
      ) : groups.length === 0 ? (
        <View className="px-6 mt-8">
          <EmptyState
            icon="groups"
            message={t("Groups.empty")}
            secondary={t("Groups.emptySecondary")}
          />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g._id}
          contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
          renderItem={({ item }) => (
            <Pressable
              className="flex-row items-center gap-4 py-4 border-b border-black/5"
              onPress={() =>
                router.push({
                  pathname: "/group-detail",
                  params: { id: item._id as string },
                } as unknown as Parameters<typeof router.push>[0])
              }
            >
              <View className="w-14 h-14 bg-[#F9F9F9] rounded-xl overflow-hidden items-center justify-center border border-black/5">
                {item.imageUrl ? (
                  <Image
                    source={{ uri: item.imageUrl }}
                    className="w-full h-full"
                    resizeMode="cover"
                  />
                ) : (
                  <KyarIcon name="groups" size={28} color={colors.textTertiary} />
                )}
              </View>
              <View className="flex-1">
                <Text className="font-serif text-xl italic text-black">{item.name}</Text>
                {item.description ? (
                  <Text className="text-xs text-black/50 mt-1" numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
              </View>
              <KyarIcon name="chevron_right" size={20} color={colors.textTertiary} />
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
