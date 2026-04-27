import { useCallback, useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Link, useLocalSearchParams } from "expo-router";
import * as ExpoLinking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth/client";
import { mobileEmailCallbackUrl } from "@/lib/auth/callback-url";
import { APP_HREF } from "@/lib/appRoutes";
import { EXPO_PUBLIC_CONVEX_SITE_URL } from "@/config/env";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { AUTH_ON_PRIMARY, AuthScreenShell } from "@/components/auth/AuthScreenShell";

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
  const { colors } = useDesignTheme();
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
    <AuthScreenShell>
      <Text className="text-xl font-semibold text-kyar-text dark:text-kyar-dark-text">
        {t("auth.checkYourEmail")}
      </Text>
      <Text className="mt-2 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
        {t("auth.verifyEmailBody")}
        {email ? ` ${email}` : ""}.
      </Text>

      {token && verifyUrl ? (
        <View className="mt-6 rounded-xl border border-kyar-border bg-kyar-surface p-4 dark:border-kyar-dark-border dark:bg-kyar-dark-surface">
          <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("auth.verifyTokenHint")}
          </Text>
          <Pressable
            className="mt-4 items-center rounded-lg bg-kyar-text py-3 active:opacity-90 dark:bg-kyar-dark-text"
            onPress={openVerifyInBrowser}
            disabled={browserLoading}
          >
            {browserLoading ? (
              <ActivityIndicator color={AUTH_ON_PRIMARY} />
            ) : (
              <Text className="font-semibold text-kyar-bg dark:text-kyar-dark-bg">
                {t("auth.completeVerification")}
              </Text>
            )}
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <Text className="mt-4 text-sm text-kyar-danger dark:text-kyar-dark-danger">{error}</Text>
      ) : null}
      {resent ? (
        <Text className="mt-4 text-sm text-kyar-accent dark:text-kyar-dark-accent">
          {t("auth.verifyResent")}
        </Text>
      ) : null}

      {email && !resent ? (
        <Pressable
          className="mt-6 items-center rounded-xl border border-kyar-border py-4 active:opacity-90 dark:border-kyar-dark-border"
          onPress={handleResend}
          disabled={resending}
        >
          {resending ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text className="font-semibold text-kyar-text dark:text-kyar-dark-text">
              {t("auth.resendVerification")}
            </Text>
          )}
        </Pressable>
      ) : null}

      <Link href={APP_HREF.signIn} asChild>
        <Pressable className="mt-8 self-start">
          <Text className="font-semibold text-kyar-text dark:text-kyar-dark-text">
            {t("auth.backToSignIn")}
          </Text>
        </Pressable>
      </Link>

      <Text className="mt-6 text-xs text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
        {t("auth.verifySpamHint")}
      </Text>
    </AuthScreenShell>
  );
}
