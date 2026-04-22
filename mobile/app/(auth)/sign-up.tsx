import { useState } from "react";
import {
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth/client";
import { mobileEmailCallbackUrl } from "@/lib/auth/callback-url";

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (username.trim().length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: authError } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        username: username.trim(),
        callbackURL: mobileEmailCallbackUrl(),
      });
      if (authError) {
        setError(authError.message ?? "Sign up failed.");
        return;
      }
      router.replace({
        pathname: "/(auth)/verify-email",
        params: { email: email.trim() },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white px-6 pt-4"
    >
      <Text className="text-2xl font-semibold text-neutral-900">{t("common.signUp")}</Text>
      <Text className="mt-1 text-neutral-500">{t("auth.createAccount")}</Text>

      <Text className="mt-8 text-sm font-medium text-neutral-700">Name</Text>
      <TextInput
        className="mt-1 rounded-lg border border-neutral-200 px-3 py-3 text-base text-neutral-900"
        value={name}
        onChangeText={setName}
        placeholder="Display name"
      />

      <Text className="mt-4 text-sm font-medium text-neutral-700">Username</Text>
      <TextInput
        className="mt-1 rounded-lg border border-neutral-200 px-3 py-3 text-base text-neutral-900"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
        placeholder="At least 3 characters"
      />

      <Text className="mt-4 text-sm font-medium text-neutral-700">{t("common.email")}</Text>
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
        autoComplete="new-password"
      />

      <Text className="mt-4 text-sm font-medium text-neutral-700">Confirm password</Text>
      <TextInput
        className="mt-1 rounded-lg border border-neutral-200 px-3 py-3 text-base text-neutral-900"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
      />

      {error ? <Text className="mt-3 text-sm text-red-600">{error}</Text> : null}

      <Pressable
        className="mt-8 items-center rounded-xl bg-neutral-900 py-4 active:opacity-90"
        onPress={onSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text className="text-base font-semibold text-white">{t("common.signUp")}</Text>
        )}
      </Pressable>

      <Link href="/(auth)/sign-in" asChild>
        <Pressable className="mt-6">
          <Text className="text-center text-sm text-neutral-600">
            {t("auth.haveAccount")}{" "}
            <Text className="font-semibold text-neutral-900">{t("common.signIn")}</Text>
          </Text>
        </Pressable>
      </Link>
    </KeyboardAvoidingView>
  );
}
