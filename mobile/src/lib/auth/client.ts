import { createAuthClient } from "@better-auth/react-native"

export const authClient = createAuthClient({
  baseURL: process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000",
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
} = authClient
