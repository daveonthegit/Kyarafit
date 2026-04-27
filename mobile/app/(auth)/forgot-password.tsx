import { useState } from "react";
import { Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth/client";
import { mobileResetPasswordRedirectUrl } from "@/lib/auth/callback-url";
import { APP_HREF } from "@/lib/appRoutes";
import { useDesignTheme } from "@/theme/useDesignTheme";
import {
  AUTH_ON_PRIMARY,
  AuthScreenShell,
  authFieldInputCls,
  authFooterTextCls,
  authLabelCls,
  authSuccessCls,
  authSubtitleCls,
  authTitleCls,
} from "@/components/auth/AuthScreenShell";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { colors } = useDesignTheme();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setInfo(null);
    setSubmitting(true);
    try {
      const { error: authError } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: mobileResetPasswordRedirectUrl(),
      });
      if (authError) {
        setError(authError.message ?? "Failed to send reset email.");
        return;
      }
      setInfo(t("auth.resetEmailSent"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to send reset email");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreenShell>
      <Text className={authTitleCls}>{t("auth.forgotPasswordTitle")}</Text>
      <Text className={authSubtitleCls}>{t("auth.forgotPasswordHint")}</Text>

      <Text className={`mt-8 ${authLabelCls}`}>{t("common.email")}</Text>
      <TextInput
        className={authFieldInputCls}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />

      {error ? (
        <Text className="mt-3 text-sm text-kyar-danger dark:text-kyar-dark-danger">{error}</Text>
      ) : null}
      {info ? <Text className={authSuccessCls}>{info}</Text> : null}

      <Pressable
        className="mt-8 items-center rounded-xl bg-kyar-text py-4 active:opacity-90 dark:bg-kyar-dark-text"
        onPress={onSubmit}
        disabled={submitting || !email.trim()}
      >
        {submitting ? (
          <ActivityIndicator color={AUTH_ON_PRIMARY} />
        ) : (
          <Text className="text-base font-semibold text-kyar-bg dark:text-kyar-dark-bg">
            {t("auth.sendResetLink")}
          </Text>
        )}
      </Pressable>

      <Link href={APP_HREF.signIn} asChild>
        <Pressable className="mt-6">
          <Text className={authFooterTextCls}>{t("auth.backToSignIn")}</Text>
        </Pressable>
      </Link>
    </AuthScreenShell>
  );
}
