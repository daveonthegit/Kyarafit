import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { useTranslation } from "react-i18next";

export function ConnectivityBanner() {
  const { t } = useTranslation();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state: NetInfoState) => {
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return () => {
      unsub();
    };
  }, []);

  if (!offline) return null;

  return (
    <View className="border-b border-amber-800 bg-amber-100 px-4 py-2">
      <Text className="text-center text-sm font-medium text-amber-950">
        {t("common.offlineBanner")}
      </Text>
    </View>
  );
}
