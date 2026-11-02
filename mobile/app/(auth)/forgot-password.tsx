import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth/client";
import { mobileResetPasswordRedirectUrl } from "@/lib/auth/callback-url";
import { APP_HREF } from "@/lib/appRoutes";
import { GlassTextField } from "@/ui/glass";
import {
  AuthGlassErrorBanner,
  AuthGlassFrame,
  AuthGlassSolidButton,
  AuthGlassSuccessBanner,
  authGlassBodyStyle,
  authGlassLinkTextStyle,
} from "@/components/auth/AuthGlassFrame";

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
    <AuthGlassFrame
      icon="mail-unread-outline"
      eyebrow={t("auth.accountRecovery", { defaultValue: "Account recovery" })}
      title={t("auth.forgotPasswordTitle")}
    >
      <Text style={[authGlassBodyStyle, { textAlign: "center", marginBottom: 20 }]}>
        {t("auth.forgotPasswordHint")}
      </Text>

      {error ? (
        <View style={{ marginBottom: 16 }}>
          <AuthGlassErrorBanner message={error} />
        </View>
      ) : null}
      {info ? (
        <View style={{ marginBottom: 16 }}>
          <AuthGlassSuccessBanner message={info} />
        </View>
      ) : null}

      <GlassTextField
        label={t("common.email")}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
      />

      <AuthGlassSolidButton
        label={t("auth.sendResetLink")}
        loading={submitting}
        onPress={onSubmit}
        disabled={submitting || !email.trim()}
        style={{ marginTop: 20 }}
      />

      <Link href={APP_HREF.signIn} asChild>
        <Pressable
          className="active:opacity-80"
          style={{ marginTop: 12, minHeight: 44, justifyContent: "center", alignSelf: "center" }}
        >
          <Text style={authGlassLinkTextStyle}>{t("auth.backToSignIn")}</Text>
        </Pressable>
      </Link>
    </AuthGlassFrame>
  );
}
