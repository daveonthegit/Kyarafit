import { useState } from "react";
import { Text, Pressable, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { glass } from "@kyarafit/design-system/rn";
import { authClient } from "@/lib/auth/client";
import { mobileEmailCallbackUrl } from "@/lib/auth/callback-url";
import { startSocialSignIn } from "@/lib/auth/startSocialSignIn";
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
  authGlassLinkTextStyle,
} from "@/components/auth/AuthGlassFrame";

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
    <AuthGlassFrame
      eyebrow={t("auth.joinEyebrow", { defaultValue: "Join" })}
      title={t("common.appName")}
    >
      {error ? (
        <View style={{ marginBottom: 16 }}>
          <AuthGlassErrorBanner message={error} />
        </View>
      ) : null}

      <View style={{ marginBottom: 24, gap: 12 }}>
        <AuthGlassOutlineButton
          label={t("auth.signUpWithGoogle")}
          leading={<GoogleLogo />}
          loading={oauthLoading === "google"}
          onPress={() => onOAuth("google")}
          disabled={busy}
        />
        <AuthGlassOutlineButton
          label={t("auth.signUpWithApple")}
          leading={<MaterialCommunityIcons name="apple" size={16} color={glass.text.fg} />}
          loading={oauthLoading === "apple"}
          onPress={() => onOAuth("apple")}
          disabled={busy}
        />
      </View>

      <View style={{ marginBottom: 24 }}>
        <AuthGlassDivider label={t("auth.orDivider")} />
      </View>

      <GlassTextField
        label={t("auth.name")}
        value={name}
        onChangeText={setName}
        placeholder={t("auth.namePlaceholderWeb")}
        autoComplete="name"
      />

      <View style={{ marginTop: 16 }}>
        <GlassTextField
          label={t("auth.username")}
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={setUsername}
          placeholder={t("auth.usernamePlaceholderWeb")}
          autoComplete="username"
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <GlassTextField
          label={t("common.email")}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <GlassTextField
          label={t("common.password")}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          autoComplete="new-password"
          placeholder={t("auth.passwordPlaceholder")}
        />
      </View>

      <View style={{ marginTop: 16 }}>
        <GlassTextField
          label={t("auth.confirmPassword")}
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          autoComplete="new-password"
          placeholder="••••••••"
        />
      </View>

      <AuthGlassSolidButton
        label={t("auth.createAccount")}
        loading={submitting}
        onPress={onSubmit}
        disabled={busy}
        style={{ marginTop: 20 }}
      />

      <View
        style={{
          marginTop: 12,
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
          {t("auth.haveAccount")}{" "}
        </Text>
        <Link href={APP_HREF.signIn} asChild>
          <Pressable
            className="active:opacity-80"
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={authGlassLinkTextStyle}>{t("common.signIn")}</Text>
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
            textAlign: "center",
          }}
        >
          {t("auth.byContinuing")}{" "}
        </Text>
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
        >{` ${t("auth.andConj")} `}</Text>
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
