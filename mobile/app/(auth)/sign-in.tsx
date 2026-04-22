import { useState } from "react";
import { Text, TextInput, Pressable, ActivityIndicator, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { authClient, setStoredBearerToken } from "@/lib/auth/client";
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
  authSuccessCls,
  authTitleCls,
  authLinkCls,
} from "@/components/auth/AuthScreenShell";

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { reset: resetParam } = useLocalSearchParams<{ reset?: string }>();
  const resetSuccess = resetParam === "success";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      setError(e instanceof Error ? e.message : "Sign in failed.");
      setOauthLoading(null);
    }
  }

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
    <AuthScreenShell>
      <Text className={authTitleCls}>{t("common.signIn")}</Text>
      <Text className={authSubtitleCls}>{t("auth.welcome")}</Text>

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
              <Text className="text-sm font-semibold text-kyar-text">{t("auth.continueWithGoogle")}</Text>
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
              <Text className="text-sm font-semibold text-kyar-text">{t("auth.continueWithApple")}</Text>
            </>
          )}
        </Pressable>

      </View>

      <View className="my-8 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-kyar-borderSubtle" />
        <Text className="text-xs uppercase tracking-widest text-kyar-textSecondary">{t("auth.orDivider")}</Text>
        <View className="h-px flex-1 bg-kyar-borderSubtle" />
      </View>

      <Text className={authLabelCls}>{t("common.email")}</Text>
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
        autoComplete="password"
      />

      {resetSuccess ? <Text className={authSuccessCls}>{t("auth.passwordResetSuccess")}</Text> : null}
      {error ? <Text className={authErrorCls}>{error}</Text> : null}

      <Pressable className={authPrimaryBtnCls} onPress={onSubmit} disabled={busy}>
        {submitting ? (
          <ActivityIndicator color={AUTH_ON_PRIMARY} />
        ) : (
          <Text className="text-base font-semibold text-kyar-bg">{t("common.signIn")}</Text>
        )}
      </Pressable>

      <Link href="/(auth)/forgot-password" asChild>
        <Pressable className="mt-4 self-start">
          <Text className={authLinkCls}>{t("auth.forgotPassword")}</Text>
        </Pressable>
      </Link>

      <Link href="/(auth)/sign-up" asChild>
        <Pressable className="mt-6">
          <Text className={authFooterTextCls}>
            {t("auth.needAccount")}{" "}
            <Text className={authFooterEmCls}>{t("common.signUp")}</Text>
          </Text>
        </Pressable>
      </Link>
    </AuthScreenShell>
  );
}
