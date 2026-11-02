import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { borderWidth, glass } from "@kyarafit/design-system/rn";
import { useAppSession } from "@/lib/auth/appSession";
import { APP_HREF } from "@/lib/appRoutes";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";

/**
 * Transient strip (ADR-0002: shown only while its condition holds) for a session the server no
 * longer accepts. The planner keeps working on this device; signing in again restores sync and the
 * online features. Tapping it opens sign-in.
 */
export function SessionExpiredNotice() {
  const { t } = useTranslation();
  const router = useRouter();
  const session = useAppSession();

  if (session.status !== "signedIn" || session.connection !== "expired") return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint={t("vault.sessionExpiredHint")}
      onPress={() => router.push(APP_HREF.signIn)}
      style={({ pressed }) => ({
        borderRadius: 12,
        borderWidth: borderWidth.hairline,
        borderColor: glass.border.default,
        backgroundColor: glass.fallback.overlay,
        paddingHorizontal: 16,
        paddingVertical: 10,
        minHeight: 44,
        justifyContent: "center",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={{
          textAlign: "center",
          fontFamily: APP_FONT_FAMILIES.sansMedium,
          fontSize: 13,
          color: glass.text.fg,
        }}
      >
        {t("vault.sessionExpired")}
      </Text>
      <Text
        style={{
          marginTop: 2,
          textAlign: "center",
          fontFamily: APP_FONT_FAMILIES.sansRegular,
          fontSize: 12,
          color: glass.text.fg70,
          textDecorationLine: "underline",
        }}
      >
        {t("vault.sessionExpiredAction")}
      </Text>
    </Pressable>
  );
}
