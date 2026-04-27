import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth/client";
import { APP_HREF } from "@/lib/appRoutes";
import { useDesignTheme } from "@/theme/useDesignTheme";
import {
  AUTH_ON_PRIMARY,
  AuthScreenShell,
  authFieldInputCls,
  authFooterTextCls,
  authLabelCls,
  authSubtitleCls,
  authTitleCls,
} from "@/components/auth/AuthScreenShell";

function singleParam(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  return typeof v === "string" ? v : (v[0] ?? "");
}

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useDesignTheme();
  const { token: tokenRaw } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = singleParam(tokenRaw);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    if (password !== confirm) {
      setError(t("auth.passwordsMismatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("auth.passwordMinLength"));
      return;
    }
    if (!token) {
      setError(t("auth.resetLinkInvalid"));
      return;
    }

    setSubmitting(true);
    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (authError) {
        setError(authError.message ?? t("auth.resetFailed"));
      } else {
        router.replace(APP_HREF.signInResetSuccess);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("auth.resetFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <View className="flex-1 justify-center bg-kyar-bg px-6 dark:bg-kyar-dark-bg">
        <Text className="text-center text-xl font-semibold text-kyar-text dark:text-kyar-dark-text">
          {t("auth.invalidLinkTitle")}
        </Text>
        <Text className="mt-3 text-center text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {t("auth.resetLinkInvalid")}
        </Text>
        <Link href={APP_HREF.signIn} asChild>
          <Pressable className="mt-8 items-center rounded-xl border border-kyar-border py-4 dark:border-kyar-dark-border">
            <Text className="font-semibold text-kyar-text dark:text-kyar-dark-text">
              {t("auth.backToSignIn")}
            </Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <AuthScreenShell>
      <Text className={authTitleCls}>{t("auth.newPasswordTitle")}</Text>
      <Text className={authSubtitleCls}>{t("auth.chooseNewPassword")}</Text>

      {error ? (
        <Text className="mt-4 text-sm text-kyar-danger dark:text-kyar-dark-danger">{error}</Text>
      ) : null}

      <Text className="mt-6 text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
        {t("auth.newPassword")}
      </Text>
      <TextInput
        className={authFieldInputCls}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
      />

      <Text className={`mt-4 ${authLabelCls}`}>{t("auth.confirmPassword")}</Text>
      <TextInput
        className={authFieldInputCls}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
      />

      <Pressable
        className="mt-8 items-center rounded-xl bg-kyar-text py-4 active:opacity-90 dark:bg-kyar-dark-text"
        onPress={onSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={AUTH_ON_PRIMARY} />
        ) : (
          <Text className="text-base font-semibold text-kyar-bg dark:text-kyar-dark-bg">
            {t("auth.setNewPassword")}
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
