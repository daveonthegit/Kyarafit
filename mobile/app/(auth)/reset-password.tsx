import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { authClient } from "@/lib/auth/client";
import { APP_HREF } from "@/lib/appRoutes";
import { GlassTextField } from "@/ui/glass";
import {
  AuthGlassErrorBanner,
  AuthGlassFrame,
  AuthGlassOutlineButton,
  AuthGlassSolidButton,
  authGlassBodyStyle,
  authGlassLinkTextStyle,
} from "@/components/auth/AuthGlassFrame";

function singleParam(v: string | string[] | undefined): string {
  if (v === undefined) return "";
  return typeof v === "string" ? v : (v[0] ?? "");
}

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { token: tokenRaw } = useLocalSearchParams<{ token?: string | string[] }>();
  const token = singleParam(tokenRaw);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    if (!token) {
      setError(t("auth.resetLinkInvalid"));
      return;
    }

    setSubmitting(true);
    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });
      if (authError) {
        setError(authError.message ?? t("auth.resetFailed"));
      } else {
        router.replace(APP_HREF.signInResetSuccess);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("auth.resetFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthGlassFrame icon="mail-unread-outline" title={t("auth.invalidLinkTitle")}>
        <Text style={[authGlassBodyStyle, { textAlign: "center", marginBottom: 20 }]}>
          {t("auth.resetLinkInvalid")}
        </Text>
        <AuthGlassOutlineButton
          label={t("auth.backToSignIn")}
          onPress={() => router.replace(APP_HREF.signIn)}
        />
      </AuthGlassFrame>
    );
  }

  return (
    <AuthGlassFrame
      eyebrow={t("auth.accountRecovery", { defaultValue: "Account recovery" })}
      title={t("auth.newPasswordTitle")}
    >
      <Text style={[authGlassBodyStyle, { textAlign: "center", marginBottom: 20 }]}>
        {t("auth.chooseNewPassword")}
      </Text>

      {error ? (
        <View style={{ marginBottom: 16 }}>
          <AuthGlassErrorBanner message={error} />
        </View>
      ) : null}

      <GlassTextField
        label={t("auth.newPassword")}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        autoComplete="new-password"
      />

      <View style={{ marginTop: 16 }}>
        <GlassTextField
          label={t("auth.confirmPassword")}
          secureTextEntry
          value={confirm}
          onChangeText={setConfirm}
          autoComplete="new-password"
        />
      </View>

      <AuthGlassSolidButton
        label={t("auth.setNewPassword")}
        loading={submitting}
        onPress={onSubmit}
        disabled={submitting}
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
