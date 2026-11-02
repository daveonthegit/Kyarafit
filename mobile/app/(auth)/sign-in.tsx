import { useState } from "react";
import { Text, Pressable, View } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { glass } from "@kyarafit/design-system/rn";
import { authClient, setStoredBearerToken } from "@/lib/auth/client";
import { startSocialSignIn } from "@/lib/auth/startSocialSignIn";
import { mobileEmailCallbackUrl } from "@/lib/auth/callback-url";
import { APP_HREF } from "@/lib/appRoutes";
import { openWebAppPath } from "@/lib/openWebAppPath";
import { GlassTextField } from "@/ui/glass";
import { GoogleLogo } from "@/components/auth/AuthScreenShell";
import {
  AuthGlassDivider,
  AuthGlassErrorBanner,
  AuthGlassFrame,
  AuthGlassLink,
  AuthGlassOutlineButton,
  AuthGlassSolidButton,
  AuthGlassSuccessBanner,
  authGlassLabelStyle,
  authGlassLinkTextStyle,
} from "@/components/auth/AuthGlassFrame";

export default function SignInScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { reset: resetParam } = useLocalSearchParams<{ reset?: string }>();
  const resetSuccess = resetParam === "success";

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

  async function onOAuth(provider: "google" | "apple") {
    setError(null);
    setInfo(null);
    setOauthLoading(provider);
    try {
      const result = await startSocialSignIn(provider);
      if (result === "signed_in") {
        router.replace(APP_HREF.home);
      }
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
    if (submitting || oauthLoading !== null) return;
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
      router.replace(APP_HREF.home);
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
    <AuthGlassFrame eyebrow={t("auth.welcomeTo")} title={t("common.appName")}>
      {(error || resetSuccess || info) && (
        <View style={{ marginBottom: 16, gap: 12 }}>
          {error ? <AuthGlassErrorBanner message={error} /> : null}
          {(info || resetSuccess) && (
            <AuthGlassSuccessBanner
              message={resetSuccess ? t("auth.passwordResetSuccess") : (info ?? "")}
            />
          )}
        </View>
      )}

      <View style={{ marginBottom: 24, gap: 12 }}>
        <AuthGlassOutlineButton
          label={t("auth.continueWithGoogle")}
          leading={<GoogleLogo />}
          loading={oauthLoading === "google"}
          onPress={() => onOAuth("google")}
          disabled={busy}
        />
        <AuthGlassOutlineButton
          label={t("auth.continueWithApple")}
          leading={<MaterialCommunityIcons name="apple" size={16} color={glass.text.fg} />}
          loading={oauthLoading === "apple"}
          onPress={() => onOAuth("apple")}
          disabled={busy}
        />
      </View>

      <View style={{ marginBottom: 24 }}>
        <AuthGlassDivider label={t("auth.orDivider")} />
      </View>

      {signInWithEmail ? (
        <GlassTextField
          label={t("common.email")}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
        />
      ) : (
        <GlassTextField
          label={t("auth.username")}
          autoCapitalize="none"
          autoComplete="username"
          textContentType="username"
          value={username}
          onChangeText={setUsername}
          placeholder={t("auth.usernameSignInPlaceholder")}
        />
      )}

      <View
        style={{
          marginTop: 16,
          marginBottom: 6,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Text style={authGlassLabelStyle}>{t("common.password")}</Text>
        <Link href={APP_HREF.forgotPassword} asChild>
          <Pressable
            className="active:opacity-80"
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={authGlassLinkTextStyle}>{t("auth.forgotPassword")}</Text>
          </Pressable>
        </Link>
      </View>
      <GlassTextField
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoComplete="password"
        returnKeyType="go"
        blurOnSubmit
        onSubmitEditing={() => void onSubmit()}
        placeholder="••••••••"
      />

      <AuthGlassSolidButton
        label={t("common.signIn")}
        loading={submitting}
        onPress={onSubmit}
        disabled={busy}
        style={{ marginTop: 16 }}
      />

      {showResendVerification ? (
        <View style={{ marginTop: 16, gap: 8 }}>
          <Text style={authGlassLabelStyle}>{t("auth.resendVerificationHint")}</Text>
          <GlassTextField
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
          />
          <AuthGlassOutlineButton
            label={t("auth.resendVerification")}
            loading={resendLoading}
            onPress={onResendVerification}
            disabled={busy || resendLoading || !email.trim()}
          />
        </View>
      ) : null}

      <AuthGlassLink
        label={
          signInWithEmail ? t("auth.signInWithUsernameInstead") : t("auth.signInWithEmailInstead")
        }
        style={{ marginTop: 8 }}
        onPress={() => {
          setSignInWithEmail(!signInWithEmail);
          setError(null);
          setInfo(null);
        }}
      />

      <View
        style={{
          marginTop: 4,
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: authGlassLinkTextStyle.fontFamily,
            fontSize: 12,
            color: glass.text.fg55,
          }}
        >
          {t("auth.dontHaveAccount")}{" "}
        </Text>
        <Link href={APP_HREF.signUp} asChild>
          <Pressable
            className="active:opacity-80"
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={authGlassLinkTextStyle}>{t("auth.createOne")}</Text>
          </Pressable>
        </Link>
      </View>

      <View
        style={{
          marginTop: 4,
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{
            fontFamily: authGlassLinkTextStyle.fontFamily,
            fontSize: 12,
            lineHeight: 20,
            color: glass.text.fg55,
          }}
        >
          {t("auth.readOur")}{" "}
        </Text>
        <Pressable
          onPress={() => void openWebAppPath("/privacy", t)}
          className="active:opacity-80"
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={authGlassLinkTextStyle}>{t("auth.privacyPolicyName")}</Text>
        </Pressable>
        <Text
          style={{
            fontFamily: authGlassLinkTextStyle.fontFamily,
            fontSize: 12,
            lineHeight: 20,
            color: glass.text.fg55,
          }}
        >{` ${t("auth.andConj")} `}</Text>
        <Pressable
          onPress={() => void openWebAppPath("/terms", t)}
          className="active:opacity-80"
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={authGlassLinkTextStyle}>{t("auth.termsOfServiceName")}</Text>
        </Pressable>
        <Text
          style={{
            fontFamily: authGlassLinkTextStyle.fontFamily,
            fontSize: 12,
            lineHeight: 20,
            color: glass.text.fg55,
          }}
        >
          .
        </Text>
      </View>

      <AuthGlassLink
        label={t("auth.backToHome")}
        textStyle={{ textDecorationLine: "none", color: glass.text.fg55 }}
        style={{ marginTop: 8 }}
        onPress={() => router.replace(APP_HREF.welcome)}
      />
    </AuthGlassFrame>
  );
}
