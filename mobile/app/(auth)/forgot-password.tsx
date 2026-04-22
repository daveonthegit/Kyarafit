import { useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth/client";
import { mobileResetPasswordRedirectUrl } from "@/lib/auth/callback-url";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
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
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white px-6 pt-4"
    >
      <Text className="text-2xl font-semibold text-neutral-900">
        {t("auth.forgotPasswordTitle")}
      </Text>
      <Text className="mt-1 text-neutral-500">{t("auth.forgotPasswordHint")}</Text>

      <Text className="mt-8 text-sm font-medium text-neutral-700">{t("common.email")}</Text>
      <TextInput
        className="mt-1 rounded-lg border border-neutral-200 px-3 py-3 text-base text-neutral-900"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />

      {error ? <Text className="mt-3 text-sm text-red-600">{error}</Text> : null}
      {info ? <Text className="mt-3 text-sm text-green-700">{info}</Text> : null}

      <Pressable
        className="mt-8 items-center rounded-xl bg-neutral-900 py-4 active:opacity-90"
        onPress={onSubmit}
        disabled={submitting || !email.trim()}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">{t("auth.sendResetLink")}</Text>
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
