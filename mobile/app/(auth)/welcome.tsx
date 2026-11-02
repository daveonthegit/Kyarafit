import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { glass, ls } from "@kyarafit/design-system/rn";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { PhotoBackdrop, PhotoPill } from "@/ui/glass";
import { AUTH_BACKDROP_URI, AuthGlassLink } from "@/components/auth/AuthGlassFrame";

/**
 * Signed-out landing (mobile echo of the web hero, S1 in 04-screens):
 * full-bleed photo + scrim, lower-left invitation, one solid primary → sign-up.
 * Static by design — Ken Burns from the backdrop is the only motion.
 */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ flex: 1 }}>
      <PhotoBackdrop imageUrl={AUTH_BACKDROP_URI} />

      <Text
        style={{
          position: "absolute",
          top: insets.top + 14,
          left: 22,
          fontFamily: APP_FONT_FAMILIES.displayItalic,
          fontSize: 21,
          lineHeight: 25,
          color: glass.text.fg,
        }}
      >
        {t("common.appName")}
      </Text>

      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          paddingHorizontal: 22,
          paddingBottom: insets.bottom + 44,
        }}
      >
        <Text
          style={{
            marginBottom: 14,
            fontFamily: APP_FONT_FAMILIES.sansBold,
            fontSize: 10,
            letterSpacing: ls(0.26, 10),
            textTransform: "uppercase",
            color: glass.text.fg70,
          }}
        >
          {t("landing.kicker", { defaultValue: "The cosplay studio planner" })}
        </Text>

        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.displayItalic,
            fontSize: 40,
            lineHeight: 44,
            color: glass.text.fg,
          }}
        >
          {t("landing.headline", { defaultValue: "Made by hand.\nPlanned to the seam." })}
        </Text>

        <Text
          style={{
            marginTop: 14,
            maxWidth: 330,
            fontFamily: APP_FONT_FAMILIES.sansRegular,
            fontSize: 14,
            lineHeight: 21,
            color: glass.text.fg,
            opacity: 0.8,
          }}
        >
          {t("landing.subcopy", {
            defaultValue:
              "Every element, task, and convention day for your next build — tracked in one quiet studio that works offline.",
          })}
        </Text>

        <View style={{ marginTop: 24, alignItems: "flex-start" }}>
          <PhotoPill
            variant="solid"
            label={t("landing.ctaPrimary", { defaultValue: "Start planning — free" })}
            onPress={() => router.push(APP_HREF.signUp)}
          />
          <Text
            style={{
              marginTop: 12,
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 9,
              letterSpacing: ls(0.2, 9),
              textTransform: "uppercase",
              color: glass.text.fg55,
            }}
          >
            {t("landing.ctaMeta", { defaultValue: "No account · runs on your device" })}
          </Text>
        </View>

        <AuthGlassLink
          label={t("common.signIn")}
          style={{ marginTop: 10, alignSelf: "flex-start" }}
          onPress={() => router.push(APP_HREF.signIn)}
        />
      </View>
    </View>
  );
}
