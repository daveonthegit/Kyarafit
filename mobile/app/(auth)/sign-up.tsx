import { useState } from "react";
import { Text, TextInput, Pressable, ActivityIndicator, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { authClient } from "@/lib/auth/client";
import { mobileEmailCallbackUrl } from "@/lib/auth/callback-url";
import { startSocialSignIn } from "@/lib/auth/startSocialSignIn";
import { APP_HREF } from "@/lib/appRoutes";
import { openWebAppPath } from "@/lib/openWebAppPath";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import {
  AUTH_ON_PRIMARY,
  AuthScreenShell,
  GoogleLogo,
  authFieldInputCls,
  authMetaLabelCls,
  authOAuthLabelCls,
  authPrimaryBtnWebCls,
  authSocialBtnCls,
} from "@/components/auth/AuthScreenShell";

export default function SignUpScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { colors } = useDesignTheme();
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
      const result = await startSocialSignIn(provider);
      if (result === "signed_in") {
        router.replace(APP_HREF.home);
      }
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
      router.replace(APP_HREF.verifyEmail(email.trim()));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign up failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthScreenShell>
      <View className="mb-10 w-full items-center">
        <Text className={`mb-2 text-center ${authMetaLabelCls} opacity-40`}>Join</Text>
        <Text
          className="text-center text-4xl italic text-kyar-text"
          style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
        >
          {t("common.appName")}
        </Text>
      </View>

      {error ? (
        <View className="mb-4 border border-kyar-danger bg-kyar-surface px-4 py-3 dark:border-kyar-dark-danger dark:bg-kyar-dark-surface">
          <Text className="text-sm text-kyar-danger dark:text-kyar-dark-danger">{error}</Text>
        </View>
      ) : null}

      <View className="mb-6 w-full gap-3">
        <Pressable className={authSocialBtnCls} onPress={() => onOAuth("google")} disabled={busy}>
          {oauthLoading === "google" ? (
            <ActivityIndicator />
          ) : (
            <>
              <GoogleLogo />
              <Text className={authOAuthLabelCls}>{t("auth.signUpWithGoogle")}</Text>
            </>
          )}
        </Pressable>

        <Pressable className={authSocialBtnCls} onPress={() => onOAuth("apple")} disabled={busy}>
          {oauthLoading === "apple" ? (
            <ActivityIndicator />
          ) : (
            <>
              <MaterialCommunityIcons name="apple" size={16} color="#171529" />
              <Text className={authOAuthLabelCls}>{t("auth.signUpWithApple")}</Text>
            </>
          )}
        </Pressable>
      </View>

      <View className="mb-6 w-full flex-row items-center gap-3">
        <View className="h-px flex-1 bg-kyar-border" />
        <Text className="text-xs uppercase tracking-widest text-kyar-textTertiary">
          {t("auth.orDivider")}
        </Text>
        <View className="h-px flex-1 bg-kyar-border" />
      </View>

      <Text className={authMetaLabelCls}>{t("auth.name")}</Text>
      <TextInput
        className={authFieldInputCls}
        placeholderTextColor={colors.textTertiary}
        value={name}
        onChangeText={setName}
        placeholder={t("auth.namePlaceholderWeb")}
        autoComplete="name"
      />

      <Text className={`mt-4 ${authMetaLabelCls}`}>{t("auth.username")}</Text>
      <TextInput
        className={authFieldInputCls}
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
        placeholder={t("auth.usernamePlaceholderWeb")}
        autoComplete="username"
      />

      <Text className={`mt-4 ${authMetaLabelCls}`}>{t("common.email")}</Text>
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

      <Text className={`mt-4 ${authMetaLabelCls}`}>{t("common.password")}</Text>
      <TextInput
        className={authFieldInputCls}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
        placeholder={t("auth.passwordPlaceholder")}
      />

      <Text className={`mt-4 ${authMetaLabelCls}`}>{t("auth.confirmPassword")}</Text>
      <TextInput
        className={authFieldInputCls}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        autoComplete="new-password"
        placeholder="••••••••"
      />

      <Pressable className={authPrimaryBtnWebCls} onPress={onSubmit} disabled={busy}>
        {submitting ? (
          <ActivityIndicator color={AUTH_ON_PRIMARY} />
        ) : (
          <Text className="text-xs font-semibold uppercase tracking-widest text-kyar-bg dark:text-kyar-dark-bg">
            {t("auth.createAccount")}
          </Text>
        )}
      </Pressable>

      <Link href={APP_HREF.signIn} asChild>
        <Pressable className="mt-6">
          <Text className="text-center text-xs text-kyar-textTertiary">
            {t("auth.haveAccount")}{" "}
            <Text className="text-xs text-kyar-textTertiary underline">
              {t("common.signIn")}
            </Text>
          </Text>
        </Pressable>
      </Link>

      <View className="mt-6 w-full flex-row flex-wrap items-center justify-center px-2">
        <Text className="text-center text-xs leading-5 text-kyar-textTertiary">
          {t("auth.byContinuing")}{" "}
        </Text>
        <Pressable onPress={() => void openWebAppPath("/terms", t)} className="active:opacity-80">
          <Text className="text-xs leading-5 text-kyar-textTertiary underline">
            {t("auth.termsOfServiceName")}
          </Text>
        </Pressable>
        <Text className="text-xs leading-5 text-kyar-textTertiary">{` ${t("auth.andConj")} `}</Text>
        <Pressable onPress={() => void openWebAppPath("/privacy", t)} className="active:opacity-80">
          <Text className="text-xs leading-5 text-kyar-textTertiary underline">
            {t("auth.privacyPolicyName")}
          </Text>
        </Pressable>
        <Text className="text-xs leading-5 text-kyar-textTertiary">.</Text>
      </View>

      <Pressable className="mt-8 items-center py-2" onPress={() => void openWebAppPath("/", t)}>
        <Text className="text-xs text-kyar-textTertiary">{t("auth.backToHome")}</Text>
      </Pressable>
    </AuthScreenShell>
  );
}
