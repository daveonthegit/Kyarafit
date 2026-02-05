import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, font } from "@kyarafit/design-system/rn";
import { signIn, signUp } from "../lib/auth/client";

export default function AuthScreen() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");

  const validateEmail = (emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const handleAuth = async () => {
    setError("");
    setEmailError("");

    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    // Validate email format
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    if (isSignUp && password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setIsLoading(true);
    try {
      if (isSignUp) {
        const result = await signUp.email({
          email,
          password,
        });

        if (result.error) {
          // Check for common error messages indicating email already exists
          const errorMessage = result.error.message.toLowerCase();
          if (
            errorMessage.includes("already") ||
            errorMessage.includes("exists") ||
            errorMessage.includes("registered") ||
            errorMessage.includes("duplicate")
          ) {
            setEmailError("This email is already registered. Try signing in instead.");
          } else {
            setError(result.error.message);
          }
        } else {
          setShowSuccess(true);
        }
      } else {
        const result = await signIn.email({
          email,
          password,
        });

        if (result.error) {
          setError(result.error.message);
        } else {
          router.replace("/(tabs)");
        }
      }
    } catch (error) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Success screen after signup
  if (showSuccess) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <Text style={styles.successCheckmark}>✓</Text>
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successText}>
            We've sent a confirmation link to <Text style={styles.successEmail}>{email}</Text>
          </Text>
          <Text style={styles.successSubtext}>
            Click the link in the email to verify your account, then you can sign in.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              setShowSuccess(false);
              setIsSignUp(false);
              setEmail("");
              setPassword("");
            }}
          >
            <Text style={styles.buttonText}>Go to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.form}>
        <Text style={styles.title}>{isSignUp ? "Create Account" : "Welcome Back"}</Text>
        <Text style={styles.subtitle}>
          {isSignUp ? "Join the cosplay community" : "Sign in to your account"}
        </Text>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View>
          <TextInput
            style={[styles.input, emailError ? styles.inputError : null]}
            placeholder="Email"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setEmailError("");
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading}
          />
          {emailError ? (
            <Text style={styles.emailErrorText}>
              {emailError}
              {emailError.includes("already registered") ? " Try signing in." : ""}
            </Text>
          ) : null}
        </View>

        <View>
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!isLoading}
          />
          {isSignUp && <Text style={styles.hintText}>At least 6 characters</Text>}
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleAuth}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchButton} onPress={() => setIsSignUp(!isSignUp)}>
          <Text style={styles.switchText}>
            {isSignUp ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
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
    fontSize: 36,
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
  input: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.black,
    marginBottom: 24,
  },
  inputError: {
    borderBottomColor: "#ef4444",
  },
  emailErrorText: {
    fontSize: 12,
    color: "#dc2626",
    marginTop: -18,
    marginBottom: 24,
  },
  hintText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: -18,
    marginBottom: 24,
  },
  button: {
    borderWidth: 1,
    borderColor: colors.black,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
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
  switchButton: {
    alignItems: "center",
    paddingVertical: 8,
  },
  switchText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  skipButton: {
    alignItems: "center",
    marginTop: 32,
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: colors.textTertiary,
  },
  // Success screen styles
  successContainer: {
    width: "100%",
    alignItems: "center",
  },
  successCheckmark: {
    fontSize: 64,
    color: colors.black,
    marginBottom: 24,
  },
  successTitle: {
    fontFamily: font.serif,
    fontSize: 32,
    fontStyle: "italic",
    color: colors.black,
    marginBottom: 16,
    textAlign: "center",
  },
  successText: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  successEmail: {
    fontWeight: "600",
    color: colors.black,
  },
  successSubtext: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 20,
  },
});
