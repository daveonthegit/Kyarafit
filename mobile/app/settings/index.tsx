import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSession, signOut } from "../../src/lib/auth/client";
import { useTier, useFeatureAccess } from "../../src/hooks/useTier";
import i18n, { setAppLanguage } from "../../src/i18n";

const menuItems: {
  labelKey: string;
  href: "/settings/account" | "/settings/subscription" | "/settings/notifications";
}[] = [
  { labelKey: "Settings.accountDetails", href: "/settings/account" },
  { labelKey: "Settings.subscriptionPlan", href: "/settings/subscription" },
  { labelKey: "Settings.notificationStyle", href: "/settings/notifications" },
];

export default function SettingsIndexScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const { data: tierData } = useTier();
  const { canUseCloudSync, canExport } = useFeatureAccess();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <View className="flex-1 bg-white">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="flex-row justify-between items-end px-8 pt-16 pb-6">
          <View>
            <Text className="text-[9px] uppercase tracking-[0.2em] font-semibold text-black/40 mb-2">
              {t("Settings.systemPreferences")}
            </Text>
            <Text className="font-serif text-4xl text-black tracking-tight">
              {t("Settings.title")}
            </Text>
          </View>
          <Pressable onPress={() => router.back()} className="mb-2">
            <Ionicons name="close" size={24} color="#000" />
          </Pressable>
        </View>

        {!session && (
          <View className="px-8 mt-4 py-2">
            <Text className="text-[11px] uppercase tracking-[0.15em] font-semibold text-black/50">
              {t("Settings.localOnlyMode")}
            </Text>
            <Text className="text-[10px] text-black/60 mt-1">{t("Settings.signInToSync")}</Text>
            <Pressable
              className="mt-4 border border-black py-3 items-center"
              onPress={() => router.push("/auth")}
            >
              <Text className="text-[11px] uppercase tracking-[0.2em] font-semibold text-black">
                {t("Settings.signInOrCreate")}
              </Text>
            </Pressable>
          </View>
        )}

        {session && tierData && (
          <View className="px-8 mt-4 py-3 border-b border-black/5">
            <Text className="text-[10px] uppercase tracking-[0.2em] text-black/50 mb-1">Plan</Text>
            <Text className="font-serif text-2xl italic text-black">{tierData.tier}</Text>
            <Text className="text-[11px] text-black/60 mt-2">
              {t("Common.storageLabel")} {tierData.currentUsageMb.toFixed(1)} /{" "}
              {tierData.storageLimitMb < 0 ? "∞" : tierData.storageLimitMb} MB
            </Text>
            <Text className="text-[10px] text-black/45 mt-2">
              {canUseCloudSync ? t("Common.cloudSyncOn") : t("Common.cloudSyncUpgrade")} ·{" "}
              {canExport ? t("Common.exportOn") : t("Common.exportUpgrade")}
            </Text>
            <Text className="text-[10px] text-black/50 mt-3">{t("Common.stripeWebNote")}</Text>
          </View>
        )}

        <View className="px-8 mt-10">
          <Text className="font-serif text-xl italic text-black mb-6">
            {t("Settings.profileIdentity")}
          </Text>

          <View className="flex-row justify-between items-center py-5 border-b border-black/5">
            <Text className="text-[11px] uppercase tracking-[0.2em] font-medium text-black">
              {t("Settings.language")}
            </Text>
            <View className="flex-row gap-2">
              <Pressable
                className={`px-3 py-1 rounded-full border ${i18n.language === "en" ? "border-black bg-black/5" : "border-black/10"}`}
                onPress={() => setAppLanguage("en")}
              >
                <Text className="text-[10px] uppercase font-semibold text-black">
                  {t("Language.en")}
                </Text>
              </Pressable>
              <Pressable
                className={`px-3 py-1 rounded-full border ${i18n.language === "es" ? "border-black bg-black/5" : "border-black/10"}`}
                onPress={() => setAppLanguage("es")}
              >
                <Text className="text-[10px] uppercase font-semibold text-black">
                  {t("Language.es")}
                </Text>
              </Pressable>
            </View>
          </View>

          {menuItems.map((item) => (
            <Pressable
              key={item.href}
              className="flex-row justify-between items-center py-5 border-b border-black/5"
              onPress={() => router.push(item.href as unknown as Parameters<typeof router.push>[0])}
            >
              <Text className="text-[11px] uppercase tracking-[0.2em] font-medium text-black">
                {t(item.labelKey)}
              </Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(0,0,0,0.3)" />
            </Pressable>
          ))}
        </View>

        {session && (
          <Pressable className="px-8 mt-12" onPress={handleSignOut}>
            <Text className="text-[10px] uppercase tracking-[0.3em] font-semibold text-red-500/80">
              {t("Settings.signOut")}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}
