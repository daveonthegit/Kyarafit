import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import type { Doc } from "convex/_generated/dataModel";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { OfflineBanner } from "@/components/OfflineBanner";
import { APP_HREF } from "@/lib/appRoutes";
import { buildGlobalAddMenuActions } from "@/lib/globalAddMenuActions";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { Button, DataBoundary, FloatingCreateMenu, MetaLabel, SurfaceCard } from "@/ui";

export default function GroupsIndexScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const groups = useQuery(api.groups.listForUser, userId ? { userId } : "skip") ?? [];
  const status = identity === undefined ? "loading" : "ready";

  const createActions = useMemo(() => buildGlobalAddMenuActions("groups", t, router), [router, t]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: t("groups.title"),
          headerLargeTitle: false,
        }}
      />
      <OfflineBanner />
      <DataBoundary status={status} data={{ groups }}>
        {() => (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerClassName="px-5 pb-28 pt-4"
          >
            <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("groups.subtitle")}
            </Text>

            {groups.length === 0 ? (
              <SurfaceCard className="mt-5 px-4 py-5">
                <Text className="text-xl font-semibold text-kyar-text dark:text-kyar-dark-text">
                  {t("groups.emptyTitle")}
                </Text>
                <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("groups.emptyBody")}
                </Text>
                <Button
                  title={t("groups.createAction")}
                  variant="secondary"
                  className="mt-4"
                  onPress={() => router.push(APP_HREF.groupNew)}
                />
              </SurfaceCard>
            ) : (
              <View className="mt-5 gap-4">
                {groups.map((group: Doc<"groups">) => (
                  <Pressable
                    key={group._id}
                    onPress={() => router.push(APP_HREF.group(group._id))}
                    className="active:opacity-90"
                  >
                    <SurfaceCard className="overflow-hidden">
                      <View className="aspect-[16/10] bg-kyar-muted dark:bg-kyar-dark-muted">
                        {group.imageStorageId || group.imageUrl ? (
                          <ConvexStorageImage
                            storageId={group.imageStorageId}
                            imageUrl={group.imageUrl}
                            className="h-full w-full"
                          />
                        ) : (
                          <View className="h-full items-center justify-center">
                            <Text className="text-4xl text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                              ◇
                            </Text>
                          </View>
                        )}
                      </View>
                      <View className="gap-2 px-4 py-4">
                        <MetaLabel>{group.visibility}</MetaLabel>
                        <Text
                          style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
                          className="text-[30px] italic leading-[32px] text-kyar-text dark:text-kyar-dark-text"
                        >
                          {group.name}
                        </Text>
                        {group.description ? (
                          <Text
                            className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                            numberOfLines={3}
                          >
                            {group.description}
                          </Text>
                        ) : null}
                      </View>
                    </SurfaceCard>
                  </Pressable>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </DataBoundary>

      <FloatingCreateMenu actions={createActions} />
    </>
  );
}
