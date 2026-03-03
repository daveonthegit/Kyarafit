import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { colors, font } from "@kyarafit/design-system/rn";
import { authClient } from "../lib/auth/client";

export default function AuthScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleOAuth = async (provider: "google" | "github") => {
    setError("");
    setIsLoading(provider);
    try {
      // Use absolute deep-link callbackURL so the crossDomain server plugin creates
      // an OTT and appends ?ott=<token> to kyarafit://(tabs) after OAuth completes.
      // On React Native, better-auth/react's redirect plugin skips window.location
      // (it's undefined in RN), so signIn.social() returns { data: { url } }.
      // We then open the OAuth provider URL manually via Linking.
      const result = await authClient.signIn.social({
        provider,
        callbackURL: "kyarafit://(tabs)",
      });
      if (result?.data?.url) {
        await Linking.openURL(result.data.url);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
      setIsLoading(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>Kyarafit</Text>
        <Text style={styles.subtitle}>Cosplay lookbook & organizer</Text>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.button, isLoading !== null && styles.buttonDisabled]}
          onPress={() => handleOAuth("google")}
          disabled={isLoading !== null}
        >
          <Text style={styles.buttonText}>
            {isLoading === "google" ? "Redirecting..." : "Continue with Google"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.buttonSecondary, isLoading !== null && styles.buttonDisabled]}
          onPress={() => handleOAuth("github")}
          disabled={isLoading !== null}
        >
          <Text style={styles.buttonSecondaryText}>
            {isLoading === "github" ? "Redirecting..." : "Continue with GitHub"}
          </Text>
        </TouchableOpacity>

        <Pressable style={styles.skipButton} onPress={() => router.replace("/(tabs)")}>
          <Text style={styles.skipText}>Continue without account (local only)</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    justifyContent: "center",
    padding: 32,
  },
  form: {
    width: "100%",
  },
  title: {
    fontFamily: font.serif,
    fontSize: 40,
    fontStyle: "italic",
    color: colors.black,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 40,
  },
  errorContainer: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    padding: 16,
    borderRadius: 4,
    marginBottom: 24,
  },
  errorText: {
    color: "#991b1b",
    fontSize: 14,
    textAlign: "center",
  },
  button: {
    borderWidth: 1,
    borderColor: colors.black,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  buttonSecondary: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 24,
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
  skipButton: {
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.textTertiary,
  },
});
