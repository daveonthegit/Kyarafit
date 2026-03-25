import { View, Text, ScrollView } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { useCurrentUser } from "../src/hooks/useCurrentUser";
import { ScreenHeader, SectionCard, EmptyState } from "../src/components/shared";
import { useTranslation } from "react-i18next";

export default function GroupDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const id =
    typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : undefined;
  const { userId } = useCurrentUser();

  const groupId = id as Id<"groups"> | undefined;
  const data = useQuery(
    api.groups.getWithMembers,
    userId && groupId ? { groupId, userId } : "skip"
  );

  if (!id) {
    return (
      <View className="flex-1 bg-white px-6 pt-20">
        <Text className="text-black/50">{t("GroupDetail.missingId")}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <ScreenHeader
        title={data?.group.name ?? t("GroupDetail.titleFallback")}
        onBack={() => router.back()}
      />
      {data === undefined ? (
        <Text className="text-center mt-10 text-black/50">{t("GroupDetail.loading")}</Text>
      ) : !data ? (
        <View className="px-6 mt-8">
          <EmptyState message={t("GroupDetail.notFound")} />
        </View>
      ) : (
        <ScrollView className="flex-1 px-6" contentContainerStyle={{ paddingBottom: 48 }}>
          {data.group.description ? (
            <Text className="text-base text-black/70 mb-6">{data.group.description}</Text>
          ) : null}
          <SectionCard title={t("GroupDetail.membersWithCount", { count: data.members.length })}>
            {data.members.map((m) => (
              <View key={m.userId} className="py-3 border-b border-black/5">
                <Text className="text-sm text-black font-medium">{m.name}</Text>
                <Text className="text-[10px] uppercase tracking-widest text-black/40 mt-1">
                  {m.role}
                </Text>
              </View>
            ))}
          </SectionCard>
        </ScrollView>
      )}
    </View>
  );
}
