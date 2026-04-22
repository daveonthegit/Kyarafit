import { useState } from "react";
import { Text, TextInput, Pressable, ActivityIndicator, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { authClient } from "@/lib/auth/client";
import { mobileEmailCallbackUrl } from "@/lib/auth/callback-url";
import { startSocialSignIn } from "@/lib/auth/startSocialSignIn";
import {
  AUTH_ON_PRIMARY,
  AUTH_PLACEHOLDER_COLOR,
  AuthScreenShell,
  authErrorCls,
  authFooterEmCls,
  authFooterTextCls,
  authInputCls,
  authLabelCls,
  authOAuthBtnCls,
  authPrimaryBtnCls,
  authSubtitleCls,
  authTitleCls,
} from "@/components/auth/AuthScreenShell";

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
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const busy = submitting || oauthLoading !== null;

  async function onOAuth(provider: "google" | "apple") {
    setError(null);
    setOauthLoading(provider);
    try {
      await startSocialSignIn(provider);
      setOauthLoading(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign up failed.");
      setOauthLoading(null);
    }
  }

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
    if (username.trim().length < 3) {
      setError(t("auth.usernameMinLength"));
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
    <AuthScreenShell>
      <Text className={authTitleCls}>{t("common.signUp")}</Text>
      <Text className={authSubtitleCls}>{t("auth.createAccount")}</Text>

      <View className="mt-8 gap-3">
        <Pressable
          className={authOAuthBtnCls}
          onPress={() => onOAuth("google")}
          disabled={busy}
        >
          {oauthLoading === "google" ? (
            <ActivityIndicator />
          ) : (
            <>
              <MaterialCommunityIcons name="google" size={22} color="#4285F4" />
              <Text className="text-sm font-semibold text-kyar-text">{t("auth.signUpWithGoogle")}</Text>
            </>
          )}
        </Pressable>

        <Pressable
          className={authOAuthBtnCls}
          onPress={() => onOAuth("apple")}
          disabled={busy}
        >
          {oauthLoading === "apple" ? (
            <ActivityIndicator />
          ) : (
            <>
              <MaterialCommunityIcons name="apple" size={22} color="#171529" />
              <Text className="text-sm font-semibold text-kyar-text">{t("auth.signUpWithApple")}</Text>
            </>
          )}
        </Pressable>

      </View>

      <View className="my-8 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-kyar-borderSubtle" />
        <Text className="text-xs uppercase tracking-widest text-kyar-textSecondary">{t("auth.orDivider")}</Text>
        <View className="h-px flex-1 bg-kyar-borderSubtle" />
      </View>

      <Text className={authLabelCls}>{t("auth.name")}</Text>
      <TextInput
        className={authInputCls}
        placeholderTextColor={AUTH_PLACEHOLDER_COLOR}
        value={name}
        onChangeText={setName}
        placeholder={t("auth.namePlaceholder")}
        autoComplete="name"
      />

      <Text className={`mt-4 ${authLabelCls}`}>{t("auth.username")}</Text>
      <TextInput
        className={authInputCls}
        placeholderTextColor={AUTH_PLACEHOLDER_COLOR}
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
        placeholder={t("auth.usernamePlaceholder")}
        autoComplete="username"
      />

      <Text className={`mt-4 ${authLabelCls}`}>{t("common.email")}</Text>
      <TextInput
        className={authInputCls}
        placeholderTextColor={AUTH_PLACEHOLDER_COLOR}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />

      <Text className={`mt-4 ${authLabelCls}`}>{t("common.password")}</Text>
      <TextInput
        className={authInputCls}
        placeholderTextColor={AUTH_PLACEHOLDER_COLOR}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
      />

      <Text className={`mt-4 ${authLabelCls}`}>{t("auth.confirmPassword")}</Text>
      <TextInput
        className={authInputCls}
        placeholderTextColor={AUTH_PLACEHOLDER_COLOR}
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
      />

      {error ? <Text className={authErrorCls}>{error}</Text> : null}

      <Pressable className={authPrimaryBtnCls} onPress={onSubmit} disabled={busy}>
        {submitting ? (
          <ActivityIndicator color={AUTH_ON_PRIMARY} />
        ) : (
          <Text className="text-base font-semibold text-kyar-bg">{t("common.signUp")}</Text>
        )}
      </Pressable>

      <Link href="/(auth)/sign-in" asChild>
        <Pressable className="mt-6">
          <Text className={authFooterTextCls}>
            {t("auth.haveAccount")}{" "}
            <Text className={authFooterEmCls}>{t("common.signIn")}</Text>
          </Text>
        </Pressable>
      </Link>
    </AuthScreenShell>
  );
}
