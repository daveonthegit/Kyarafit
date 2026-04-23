import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/lib/auth/client";
import { useDesignTheme } from "@/theme/useDesignTheme";

export default function Index() {
  const { session, loading } = useSession();
  const { colors } = useDesignTheme();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-kyar-bg dark:bg-kyar-dark-bg">
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }

  if (session?.user) {
    return <Redirect href="/(app)/(tabs)" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
