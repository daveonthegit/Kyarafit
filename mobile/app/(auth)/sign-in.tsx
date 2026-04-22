import { useState, useCallback } from "react";
import {
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  View,
  Alert,
} from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useFonts, BodoniModa_400Regular_Italic } from "@expo-google-fonts/bodoni-moda";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { authClient, setStoredBearerToken } from "@/lib/auth/client";
import { startSocialSignIn } from "@/lib/auth/startSocialSignIn";
import { mobileEmailCallbackUrl } from "@/lib/auth/callback-url";
import { EXPO_PUBLIC_WEB_APP_URL } from "@/config/env";
import {
  AUTH_ON_PRIMARY,
  AUTH_PLACEHOLDER_COLOR,
  AuthScreenShell,
  authFieldInputCls,
  authMetaLabelCls,
  authOAuthAppleBtnCls,
  authOAuthGoogleBtnCls,
  authOAuthLabelCls,
  authPrimaryBtnWebCls,
} from "@/components/auth/AuthScreenShell";

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { reset: resetParam } = useLocalSearchParams<{ reset?: string }>();
  const resetSuccess = resetParam === "success";

  const [fontsLoaded] = useFonts({
    BodoniModa_400Regular_Italic,
  });

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signInWithEmail, setSignInWithEmail] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);

  const busy = submitting || oauthLoading !== null;

  const openWebPath = useCallback(
    async (path: string) => {
      const base = EXPO_PUBLIC_WEB_APP_URL.trim().replace(/\/$/, "");
      if (!base) {
        Alert.alert(t("more.webUnavailableTitle"), t("more.webUnavailableBody"));
        return;
      }
      try {
        await WebBrowser.openBrowserAsync(`${base}${path}`);
      } catch (e: unknown) {
        Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
      }
    },
    [t]
  );

  async function onOAuth(provider: "google" | "apple") {
    setError(null);
    setInfo(null);
    setOauthLoading(provider);
    try {
      await startSocialSignIn(provider);
      setOauthLoading(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign in failed.");
      setOauthLoading(null);
    }
  }

  function noteUnverifiedFromMessage(msg: string) {
    const lower = msg.toLowerCase();
    const isUnverified = /verif/i.test(msg) || lower.includes("email not verified");
    setShowResendVerification(isUnverified);
  }

  async function onSubmit() {
    setError(null);
    setInfo(null);
    setShowResendVerification(false);
    setSubmitting(true);
    try {
      if (signInWithEmail) {
        const { data, error: authError } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (authError) {
          const msg = authError.message ?? "";
          noteUnverifiedFromMessage(msg);
          setError(msg || "Sign in failed.");
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
      } else {
        const { data, error: authError } = await authClient.signIn.username({
          username: username.trim(),
          password,
        });
        if (authError) {
          const msg = authError.message ?? "";
          noteUnverifiedFromMessage(msg);
          setError(msg || "Sign in failed.");
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
      }
      router.replace("/(app)/(tabs)");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sign in failed";
      noteUnverifiedFromMessage(msg);
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  async function onResendVerification() {
    if (!email.trim()) return;
    setError(null);
    setInfo(null);
    setResendLoading(true);
    try {
      const { error: authError } = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: mobileEmailCallbackUrl(),
      });
      if (authError) {
        setError(authError.message ?? t("auth.resendFailed"));
      } else {
        setInfo(t("auth.verifyResent"));
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("auth.resendFailed"));
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <AuthScreenShell>
      <View className="mb-10 w-full items-center">
        <Text className={`mb-2 text-center ${authMetaLabelCls} opacity-40`}>
          {t("auth.welcomeTo")}
        </Text>
        <Text
          className="text-center text-4xl italic text-kyar-text"
          style={
            fontsLoaded ? { fontFamily: "BodoniModa_400Regular_Italic" } : undefined
          }
        >
          {t("common.appName")}
        </Text>
      </View>

      {(error || resetSuccess || info) && (
        <View className="mb-4 w-full gap-3">
          {error ? (
            <View className="border border-red-200 bg-red-50 px-4 py-3">
              <Text className="text-sm text-red-800">{error}</Text>
            </View>
          ) : null}
          {(info || resetSuccess) && (
            <View className="border border-emerald-200 bg-emerald-50 px-4 py-3">
              <Text className="text-sm text-emerald-800">
                {resetSuccess ? t("auth.passwordResetSuccess") : info}
              </Text>
            </View>
          )}
        </View>
      )}

      <View className="mb-6 w-full gap-3">
        <Pressable
          className={authOAuthGoogleBtnCls}
          onPress={() => onOAuth("google")}
          disabled={busy}
        >
          {oauthLoading === "google" ? (
            <ActivityIndicator />
          ) : (
            <>
              <MaterialCommunityIcons name="google" size={16} color="#4285F4" />
              <Text className={authOAuthLabelCls}>{t("auth.continueWithGoogle")}</Text>
            </>
          )}
        </Pressable>

        <Pressable
          className={authOAuthAppleBtnCls}
          onPress={() => onOAuth("apple")}
          disabled={busy}
        >
          {oauthLoading === "apple" ? (
            <ActivityIndicator />
          ) : (
            <>
              <MaterialCommunityIcons name="apple" size={16} color="#171529" />
              <Text className={authOAuthLabelCls}>{t("auth.continueWithApple")}</Text>
            </>
          )}
        </Pressable>
      </View>

      <View className="mb-6 w-full flex-row items-center gap-3">
        <View className="h-px flex-1 bg-kyar-border" />
        <Text className="text-xs text-kyar-textTertiary">{t("auth.orDivider")}</Text>
        <View className="h-px flex-1 bg-kyar-border" />
      </View>

      {signInWithEmail ? (
        <>
          <Text className={authMetaLabelCls}>{t("common.email")}</Text>
          <TextInput
            className={authFieldInputCls}
            placeholderTextColor={AUTH_PLACEHOLDER_COLOR}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
          />
        </>
      ) : (
        <>
          <Text className={authMetaLabelCls}>{t("auth.username")}</Text>
          <TextInput
            className={authFieldInputCls}
            placeholderTextColor={AUTH_PLACEHOLDER_COLOR}
            autoCapitalize="none"
            autoComplete="username"
            textContentType="username"
            value={username}
            onChangeText={setUsername}
            placeholder={t("auth.usernameSignInPlaceholder")}
          />
        </>
      )}

      <View className="mt-4 w-full flex-row items-center justify-between">
        <Text className={authMetaLabelCls}>{t("common.password")}</Text>
        <Link href="/(auth)/forgot-password" asChild>
          <Pressable className="py-1">
            <Text className="text-xs text-kyar-textTertiary underline">{t("auth.forgotPassword")}</Text>
          </Pressable>
        </Link>
      </View>
      <TextInput
        className={authFieldInputCls}
        placeholderTextColor={AUTH_PLACEHOLDER_COLOR}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoComplete="password"
        placeholder="••••••••"
      />

      <Pressable className={authPrimaryBtnWebCls} onPress={onSubmit} disabled={busy}>
        {submitting ? (
          <ActivityIndicator color={AUTH_ON_PRIMARY} />
        ) : (
          <Text className="text-xs font-semibold uppercase tracking-widest text-kyar-bg">
            {t("common.signIn")}
          </Text>
        )}
      </Pressable>

      {showResendVerification ? (
        <View className="mt-4 w-full gap-2">
          <Text className={authMetaLabelCls}>{t("auth.resendVerificationHint")}</Text>
          <TextInput
            className={authFieldInputCls}
            placeholderTextColor={AUTH_PLACEHOLDER_COLOR}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
          />
          <Pressable
            className="w-full items-center rounded-none border border-kyar-border bg-transparent py-3 active:opacity-90"
            onPress={onResendVerification}
            disabled={busy || resendLoading || !email.trim()}
          >
            {resendLoading ? (
              <ActivityIndicator />
            ) : (
              <Text className={authOAuthLabelCls}>{t("auth.resendVerification")}</Text>
            )}
          </Pressable>
        </View>
      ) : null}

      <Pressable
        className="mt-4 self-center py-2"
        onPress={() => {
          setSignInWithEmail(!signInWithEmail);
          setError(null);
          setInfo(null);
        }}
      >
        <Text className="text-xs text-kyar-textTertiary underline">
          {signInWithEmail ? t("auth.signInWithUsernameInstead") : t("auth.signInWithEmailInstead")}
        </Text>
      </Pressable>

      <View className="mt-6 w-full items-center">
        <Text className="text-center text-xs text-kyar-textTertiary">
          {t("auth.dontHaveAccount")}{" "}
          <Link href="/(auth)/sign-up" asChild>
            <Pressable className="active:opacity-80">
              <Text className="text-xs text-kyar-textTertiary underline">{t("auth.createOne")}</Text>
            </Pressable>
          </Link>
        </Text>
      </View>

      <View className="mt-4 w-full flex-row flex-wrap items-center justify-center px-2">
        <Text className="text-center text-xs leading-5 text-kyar-textTertiary">
          {t("auth.readOur")}{" "}
        </Text>
        <Pressable onPress={() => openWebPath("/privacy")} className="active:opacity-80">
          <Text className="text-xs leading-5 text-kyar-textTertiary underline">
            {t("auth.privacyPolicyName")}
          </Text>
        </Pressable>
        <Text className="text-xs leading-5 text-kyar-textTertiary">{` ${t("auth.andConj")} `}</Text>
        <Pressable onPress={() => openWebPath("/terms")} className="active:opacity-80">
          <Text className="text-xs leading-5 text-kyar-textTertiary underline">
            {t("auth.termsOfServiceName")}
          </Text>
        </Pressable>
        <Text className="text-xs leading-5 text-kyar-textTertiary">.</Text>
      </View>

      <Pressable className="mt-8 items-center py-2" onPress={() => openWebPath("/")}>
        <Text className="text-xs text-kyar-textTertiary">{t("auth.backToHome")}</Text>
      </Pressable>
    </AuthScreenShell>
  );
}
