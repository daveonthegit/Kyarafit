import { useEffect } from "react";
import { Platform } from "react-native";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import {
  ensureRevenueCatConfigured,
  isRevenueCatSupportedPlatform,
  revenueCatLogIn,
  revenueCatLogOut,
} from "@/lib/revenuecat";

/**
 * Links the signed-in Better Auth user id to RevenueCat (`Purchases.logIn`),
 * so webhook + REST subscriber lookups use the same `app_user_id`.
 */
export function RevenueCatBootstrap() {
  const identity = useQuery(api.auth.getCurrentUser);

  useEffect(() => {
    ensureRevenueCatConfigured();
  }, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!isRevenueCatSupportedPlatform()) return;

    let cancelled = false;
    void (async () => {
      ensureRevenueCatConfigured();
      if (identity === undefined) return;

      try {
        if (!identity?.subject) {
          await revenueCatLogOut();
          return;
        }
        if (cancelled) return;
        await revenueCatLogIn(identity.subject);
      } catch (err) {
        console.warn("[revenuecat] user sync failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [identity]);

  return null;
}
