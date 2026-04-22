import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth/client";

function singleParam(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  return typeof v === "string" ? v : v[0] ?? "";
}

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
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
        router.replace({
          pathname: "/(auth)/sign-in",
          params: { reset: "success" },
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("auth.resetFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <View className="flex-1 justify-center bg-white px-6">
        <Text className="text-center text-xl font-semibold text-neutral-900">{t("auth.invalidLinkTitle")}</Text>
        <Text className="mt-3 text-center text-neutral-600">{t("auth.resetLinkInvalid")}</Text>
        <Link href="/(auth)/sign-in" asChild>
          <Pressable className="mt-8 items-center rounded-xl border border-neutral-300 py-4">
            <Text className="font-semibold text-neutral-900">{t("auth.backToSignIn")}</Text>
          </Pressable>
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white px-6 pt-4"
    >
      <Text className="text-2xl font-semibold text-neutral-900">{t("auth.newPasswordTitle")}</Text>
      <Text className="mt-1 text-neutral-500">{t("auth.chooseNewPassword")}</Text>

      {error ? <Text className="mt-4 text-sm text-red-600">{error}</Text> : null}

      <Text className="mt-6 text-sm font-medium text-neutral-700">{t("auth.newPassword")}</Text>
      <TextInput
        className="mt-1 rounded-lg border border-neutral-200 px-3 py-3 text-base text-neutral-900"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
      />

      <Text className="mt-4 text-sm font-medium text-neutral-700">{t("auth.confirmPassword")}</Text>
      <TextInput
        className="mt-1 rounded-lg border border-neutral-200 px-3 py-3 text-base text-neutral-900"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
      />

      <Pressable
        className="mt-8 items-center rounded-xl bg-neutral-900 py-4 active:opacity-90"
        onPress={onSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">{t("auth.setNewPassword")}</Text>
        )}
      </Pressable>

      <Link href="/(auth)/sign-in" asChild>
        <Pressable className="mt-6">
          <Text className="text-center text-sm text-neutral-600">{t("auth.backToSignIn")}</Text>
        </Pressable>
      </Link>
    </KeyboardAvoidingView>
  );
}
