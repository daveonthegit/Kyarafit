import { useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { authClient, setStoredBearerToken } from "@/lib/auth/client";
export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { reset: resetParam } = useLocalSearchParams<{ reset?: string }>();
  const resetSuccess = resetParam === "success";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      const { data, error: authError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (authError) {
        setError(authError.message ?? "Sign in failed.");
        return;
      }
      if (data?.token) {
        await setStoredBearerToken(data.token);
        await authClient.getSession({
          fetchOptions: {
            headers: { Authorization: `Bearer ${data.token}` },
          },
        });
      }
      router.replace("/(app)/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white px-6 pt-4"
    >
      <Text className="text-2xl font-semibold text-neutral-900">{t("common.signIn")}</Text>
      <Text className="mt-1 text-neutral-500">{t("auth.welcome")}</Text>

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

      <Text className="mt-4 text-sm font-medium text-neutral-700">{t("common.password")}</Text>
      <TextInput
        className="mt-1 rounded-lg border border-neutral-200 px-3 py-3 text-base text-neutral-900"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoComplete="password"
      />

      {resetSuccess ? (
        <Text className="mt-3 text-sm text-green-700">{t("auth.passwordResetSuccess")}</Text>
      ) : null}
      {error ? <Text className="mt-3 text-sm text-red-600">{error}</Text> : null}

      <Pressable
        className="mt-8 items-center rounded-xl bg-neutral-900 py-4 active:opacity-90"
        onPress={onSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">{t("common.signIn")}</Text>
        )}
      </Pressable>

      <Link href="/(auth)/forgot-password" asChild>
        <Pressable className="mt-4 self-start">
          <Text className="text-sm font-medium text-neutral-700">{t("auth.forgotPassword")}</Text>
        </Pressable>
      </Link>

      <Link href="/(auth)/sign-up" asChild>
        <Pressable className="mt-6">
          <Text className="text-center text-sm text-neutral-600">
            {t("auth.needAccount")}{" "}
            <Text className="font-semibold text-neutral-900">{t("common.signUp")}</Text>
          </Text>
        </Pressable>
      </Link>
    </KeyboardAvoidingView>
  );
}
