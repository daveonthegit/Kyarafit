import { Alert } from "react-native";
import * as WebBrowser from "expo-web-browser";
import type { TFunction } from "i18next";
import { EXPO_PUBLIC_WEB_APP_URL } from "@/config/env";

/** Opens a path on the deployed web app (privacy, terms, etc.). Shows an alert if `EXPO_PUBLIC_WEB_APP_URL` is unset. */
export async function openWebAppPath(path: string, t: TFunction): Promise<void> {
  const base = EXPO_PUBLIC_WEB_APP_URL.trim().replace(/\/$/, "");
  if (!base) {
    Alert.alert(t("more.webUnavailableTitle"), t("more.webUnavailableBody"));
    return;
  }
  const normalized = path.startsWith("/") ? path : `/${path}`;
  try {
    await WebBrowser.openBrowserAsync(`${base}${normalized}`);
  } catch (e: unknown) {
    Alert.alert(t("common.errorTitle"), String(e instanceof Error ? e.message : e));
  }
}
