import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { signOut } from "@/lib/auth/client";
import { APP_HREF } from "@/lib/appRoutes";

/**
 * Hub for Events, Groups, Feed, Discover, Settings (blueprint §3.3).
 * Sign-out lives here until a dedicated Settings stack ships (Phase 7).
 */
export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)/sign-in");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <View className="flex-1 bg-white px-6 pt-8">
      <Text className="text-lg font-semibold text-neutral-900">{t("common.more")}</Text>
      <Text className="mt-2 text-neutral-600">
        Events, Groups, Feed, and Discover will link from here; open Settings for appearance, language, and dev
        tools.
      </Text>

      <Link href={APP_HREF.settings} asChild>
        <Pressable
          className="mt-8 items-center rounded-xl border border-violet-200 bg-violet-50 py-4 active:opacity-90"
          accessibilityRole="button"
          accessibilityLabel={t("common.settings")}
        >
          <Text className="font-semibold text-violet-950">{t("common.settings")}</Text>
        </Pressable>
      </Link>

      <Pressable
        className="mt-4 items-center rounded-xl border border-neutral-300 py-4 active:opacity-90"
        onPress={onSignOut}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityLabel={t("common.signOut")}
      >
        {signingOut ? (
          <ActivityIndicator />
        ) : (
          <Text className="font-semibold text-neutral-900">{t("common.signOut")}</Text>
        )}
      </Pressable>
    </View>
  );
}
