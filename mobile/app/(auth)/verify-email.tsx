import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { borderWidth, glass } from "@kyarafit/design-system/rn";
import { authClient } from "@/lib/auth/client";
import { mobileEmailCallbackUrl } from "@/lib/auth/callback-url";
import { APP_HREF } from "@/lib/appRoutes";
import { EXPO_PUBLIC_CONVEX_SITE_URL } from "@/config/env";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import {
  AuthGlassErrorBanner,
  AuthGlassFrame,
  AuthGlassOutlineButton,
  AuthGlassSolidButton,
  AuthGlassSuccessBanner,
  authGlassBodyStyle,
  authGlassLinkTextStyle,
} from "@/components/auth/AuthGlassFrame";

function singleParam(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" ? v : v[0];
}

/** Same shape as web `verify-email` page — avoids header injection in redirects. */
function isSafeToken(t: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(t) && t.length >= 1 && t.length <= 512;
}

export default function VerifyEmailScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const email = singleParam(params.email);
  const token = singleParam(params.token);

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [browserLoading, setBrowserLoading] = useState(false);

  const convexBase = EXPO_PUBLIC_CONVEX_SITE_URL?.replace(/\/$/, "") ?? "";

  const verifyUrl = useMemo(() => {
    if (!token || !isSafeToken(token) || !convexBase) return null;
    const search = new URLSearchParams();
    const raw = params as Record<string, string | string[] | undefined>;
    Object.entries(raw).forEach(([key, value]) => {
      if (typeof value === "string") search.set(key, value);
      else if (Array.isArray(value) && value[0]) search.set(key, value[0]);
    });
    return `${convexBase}/auth/verify-email?${search.toString()}`;
  }, [convexBase, params, token]);

  const openVerifyInBrowser = useCallback(async () => {
    if (!verifyUrl) return;
    setError(null);
    setBrowserLoading(true);
    try {
      await WebBrowser.openAuthSessionAsync(verifyUrl, ExpoLinking.createURL("/"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not open browser");
    } finally {
      setBrowserLoading(false);
    }
  }, [verifyUrl]);

  async function handleResend() {
    if (!email?.trim()) return;
    setError(null);
    setResending(true);
    try {
      const { error: authError } = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: mobileEmailCallbackUrl(),
      });
      if (authError) {
        setError(authError.message ?? t("auth.resendFailed"));
      } else {
        setResent(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("auth.resendFailed"));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthGlassFrame icon="mail-unread-outline" title={t("auth.checkYourEmail")}>
      <Text style={[authGlassBodyStyle, { textAlign: "center" }]}>
        {t("auth.verifyEmailBody")}
        {email ? ` ${email}` : ""}.
      </Text>

      {token && verifyUrl ? (
        <View
          style={{
            marginTop: 20,
            borderWidth: borderWidth.hairline,
            borderColor: glass.border.default,
            borderRadius: 10,
            backgroundColor: glass.surface.field,
            padding: 16,
          }}
        >
          <Text style={authGlassBodyStyle}>{t("auth.verifyTokenHint")}</Text>
          <AuthGlassSolidButton
            label={t("auth.completeVerification")}
            loading={browserLoading}
            onPress={openVerifyInBrowser}
            disabled={browserLoading}
            style={{ marginTop: 14 }}
          />
        </View>
      ) : null}

      {error ? (
        <View style={{ marginTop: 16 }}>
          <AuthGlassErrorBanner message={error} />
        </View>
      ) : null}
      {resent ? (
        <View style={{ marginTop: 16 }}>
          <AuthGlassSuccessBanner message={t("auth.verifyResent")} />
        </View>
      ) : null}

      {email && !resent ? (
        <AuthGlassOutlineButton
          label={t("auth.resendVerification")}
          loading={resending}
          onPress={handleResend}
          disabled={resending}
          style={{ marginTop: 20 }}
        />
      ) : null}

      <Link href={APP_HREF.signIn} asChild>
        <Pressable
          className="active:opacity-80"
          style={{ marginTop: 12, minHeight: 44, justifyContent: "center", alignSelf: "center" }}
        >
          <Text style={authGlassLinkTextStyle}>{t("auth.backToSignIn")}</Text>
        </Pressable>
      </Link>

      <Text
        style={{
          marginTop: 16,
          fontFamily: APP_FONT_FAMILIES.sansRegular,
          fontSize: 11,
          lineHeight: 16,
          textAlign: "center",
          color: glass.text.fg55,
        }}
      >
        {t("auth.verifySpamHint")}
      </Text>
    </AuthGlassFrame>
  );
}
