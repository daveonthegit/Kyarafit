import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Pressable,
  Linking,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, font } from "@kyarafit/design-system/rn";
import { authClient, setStoredBearerToken } from "../lib/auth/client";

type Mode = "signin" | "signup" | "forgot";

export default function AuthScreen() {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [showResendVerification, setShowResendVerification] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const anyLoading = loading || oauthLoading !== null;

  const resetForm = (nextMode: Mode) => {
    setError(null);
    setInfo(null);
    setShowResendVerification(false);
    setMode(nextMode);
  };

  // ── OAuth ──────────────────────────────────────────────────────────────────
  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    setOauthLoading(provider);
    try {
      const result = await authClient.signIn.social({
        provider,
        // kyarafit:/// is the deep link root (empty host, "/" path) — a valid URL that
        // Better Auth can accept as a trusted callbackURL. The crossDomain plugin appends
        // ?ott=<token> so the URL becomes kyarafit:///?ott=xxx; _layout.tsx exchanges it.
        // Do NOT use kyarafit://(tabs) — parentheses are invalid hostname characters.
        callbackURL: "kyarafit:///",
      });
      // On React Native, better-auth/react skips window.location (undefined),
      // so signIn.social() returns { data: { url } } instead of redirecting.
      if (result?.data?.url) {
        await Linking.openURL(result.data.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setOauthLoading(null);
    }
  };

  // ── Email sign-in ──────────────────────────────────────────────────────────
  const handleEmailSignIn = async () => {
    setError(null);
    setInfo(null);
    setShowResendVerification(false);
    setLoading(true);
    try {
      const { data, error: authError } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (authError) {
        const msg = authError.message ?? "";
        const isUnverified =
          /verif/i.test(msg) || msg.toLowerCase().includes("email not verified");
        setShowResendVerification(isUnverified);
        setError(msg || "Sign in failed. Check your credentials.");
        setLoading(false);
        return;
      }
      if (data?.token) {
        // Persist the token. The in-memory cache is set synchronously so the
        // 10ms session-signal timer (fired by better-auth after signIn.email()
        // resolves) sends GET /auth/get-session with the bearer token, updating
        // useSession() in the background. Navigate immediately — don't block on
        // the session atom; the tabs page will authenticate via ConvexBetterAuthProvider
        // once the session loads.
        await setStoredBearerToken(data.token);
        router.replace("/(tabs)");
      } else {
        setLoading(false);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      const isUnverified =
        /verif/i.test(msg) || msg.toLowerCase().includes("email not verified");
      setShowResendVerification(isUnverified);
      setError(msg);
      setLoading(false);
    }
  };

  // ── Resend verification ────────────────────────────────────────────────────
  const handleResendVerification = async () => {
    if (!email.trim()) return;
    setError(null);
    setInfo(null);
    setResendLoading(true);
    try {
      const { error: authError } = await authClient.sendVerificationEmail({
        email: email.trim(),
        callbackURL: "kyarafit:///",
      });
      if (authError) {
        setError(authError.message ?? "Failed to resend verification email.");
      } else {
        setInfo("Verification email sent. Check your inbox.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend verification email");
    } finally {
      setResendLoading(false);
    }
  };

  // ── Sign-up ────────────────────────────────────────────────────────────────
  const handleSignUp = async () => {
    setError(null);
    setInfo(null);
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error: authError } = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        // After clicking the verification link in the email, Better Auth redirects here.
        // On iOS/Android the OS intercepts kyarafit:/// and opens the app at the root.
        callbackURL: "kyarafit:///",
      });
      if (authError) {
        setError(authError.message ?? "Sign up failed. Please try again.");
      } else {
        setInfo(
          "Account created! Check your inbox for a verification email and tap the link to activate your account.",
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot password ────────────────────────────────────────────────────────
  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { error: authError } = await authClient.requestPasswordReset({
        email: email.trim(),
        // The reset link opens in the browser; the web app handles /auth/reset-password.
        redirectTo: `${process.env.EXPO_PUBLIC_CONVEX_SITE_URL?.replace(/\/$/, "")}/auth/reset-password`,
      });
      if (authError) {
        setError(authError.message ?? "Failed to send reset email.");
      } else {
        setInfo("Password reset email sent. Check your inbox and click the link.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset email");
    } finally {
      setLoading(false);
    }
  };

  // ── Divider ────────────────────────────────────────────────────────────────
  const Divider = () => (
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>or</Text>
      <View style={styles.dividerLine} />
    </View>
  );

  // ── OAuth buttons (shared) ─────────────────────────────────────────────────
  const OAuthButtons = () => (
    <View style={styles.oauthGroup}>
      <TouchableOpacity
        style={[styles.button, anyLoading && styles.buttonDisabled]}
        onPress={() => handleOAuth("google")}
        disabled={anyLoading}
      >
        <Text style={styles.buttonText}>
          {oauthLoading === "google" ? "Redirecting…" : "Continue with Google"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.buttonSecondary, anyLoading && styles.buttonDisabled]}
        onPress={() => handleOAuth("github")}
        disabled={anyLoading}
      >
        <Text style={styles.buttonSecondaryText}>
          {oauthLoading === "github" ? "Redirecting…" : "Continue with GitHub"}
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.metaLabel}>Welcome to</Text>
          <Text style={styles.title}>Kyarafit</Text>
        </View>

        {/* Alerts */}
        {error ? (
          <View style={styles.alertError}>
            <Text style={styles.alertErrorText}>{error}</Text>
          </View>
        ) : null}
        {info ? (
          <View style={styles.alertInfo}>
            <Text style={styles.alertInfoText}>{info}</Text>
          </View>
        ) : null}

        {/* ── Sign in ── */}
        {mode === "signin" && (
          <>
            <OAuthButtons />
            <Divider />

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!anyLoading}
              />
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.label}>Password</Text>
                <Pressable onPress={() => resetForm("forgot")} disabled={anyLoading}>
                  <Text style={styles.linkSmall}>Forgot password?</Text>
                </Pressable>
              </View>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="current-password"
                editable={!anyLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.buttonPrimary, anyLoading && styles.buttonDisabled]}
              onPress={handleEmailSignIn}
              disabled={anyLoading}
            >
              <Text style={styles.buttonPrimaryText}>
                {loading ? "Signing in…" : "Sign In"}
              </Text>
            </TouchableOpacity>

            {showResendVerification && (
              <TouchableOpacity
                style={[styles.buttonSecondary, styles.mt8, (anyLoading || resendLoading || !email.trim()) && styles.buttonDisabled]}
                onPress={handleResendVerification}
                disabled={anyLoading || resendLoading || !email.trim()}
              >
                <Text style={styles.buttonSecondaryText}>
                  {resendLoading ? "Sending…" : "Resend Verification Email"}
                </Text>
              </TouchableOpacity>
            )}

            <Text style={styles.switchText}>
              Don't have an account?{" "}
              <Text style={styles.link} onPress={() => resetForm("signup")}>
                Create one
              </Text>
            </Text>
          </>
        )}

        {/* ── Sign up ── */}
        {mode === "signup" && (
          <>
            <OAuthButtons />
            <Divider />

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoComplete="name"
                editable={!anyLoading}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!anyLoading}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                secureTextEntry
                autoComplete="new-password"
                editable={!anyLoading}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="••••••••"
                secureTextEntry
                autoComplete="new-password"
                editable={!anyLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.buttonPrimary, anyLoading && styles.buttonDisabled]}
              onPress={handleSignUp}
              disabled={anyLoading}
            >
              <Text style={styles.buttonPrimaryText}>
                {loading ? "Creating account…" : "Create Account"}
              </Text>
            </TouchableOpacity>

            <Text style={styles.switchText}>
              Already have an account?{" "}
              <Text style={styles.link} onPress={() => resetForm("signin")}>
                Sign in
              </Text>
            </Text>
          </>
        )}

        {/* ── Forgot password ── */}
        {mode === "forgot" && (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                editable={!anyLoading}
              />
            </View>

            <TouchableOpacity
              style={[styles.buttonPrimary, anyLoading && styles.buttonDisabled]}
              onPress={handleForgotPassword}
              disabled={anyLoading}
            >
              <Text style={styles.buttonPrimaryText}>
                {loading ? "Sending…" : "Send Reset Link"}
              </Text>
            </TouchableOpacity>

            <Pressable
              onPress={() => resetForm("signin")}
              style={styles.backLink}
              disabled={anyLoading}
            >
              <Text style={styles.linkSmall}>← Back to sign in</Text>
            </Pressable>
          </>
        )}

        {/* Skip */}
        <Pressable style={styles.skipButton} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.skipText}>Continue without account (local only)</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },

  // Header
  header: {
    alignItems: "center",
    marginBottom: 36,
  },
  metaLabel: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 3,
    fontWeight: "600",
    color: colors.textTertiary,
    marginBottom: 6,
  },
  title: {
    fontFamily: font.serif,
    fontSize: 40,
    fontStyle: "italic",
    color: colors.black,
    letterSpacing: -0.5,
  },

  // Alerts
  alertError: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 14,
    marginBottom: 20,
  },
  alertErrorText: {
    color: "#991b1b",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  alertInfo: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 14,
    marginBottom: 20,
  },
  alertInfoText: {
    color: "#166534",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },

  // OAuth group
  oauthGroup: {
    marginBottom: 4,
  },

  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.textTertiary,
    fontWeight: "600",
  },

  // Fields
  fieldGroup: {
    marginBottom: 18,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  label: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "600",
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.black,
  },

  // Buttons
  buttonPrimary: {
    backgroundColor: colors.black,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  buttonPrimaryText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "600",
    color: colors.white,
  },
  button: {
    borderWidth: 1,
    borderColor: colors.black,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "600",
    color: colors.black,
  },
  buttonSecondaryText: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  mt8: {
    marginTop: 8,
  },

  // Switch / links
  switchText: {
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 4,
  },
  link: {
    color: colors.black,
    textDecorationLine: "underline",
    fontWeight: "600",
  },
  linkSmall: {
    fontSize: 11,
    color: colors.textTertiary,
    textDecorationLine: "underline",
  },
  backLink: {
    alignItems: "center",
    marginTop: 12,
  },

  // Skip
  skipButton: {
    alignItems: "center",
    marginTop: 28,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.textTertiary,
  },
});
