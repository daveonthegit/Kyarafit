import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/lib/auth/client";
import { useDesignTheme } from "@/theme/useDesignTheme";

export default function AuthGroupLayout() {
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

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTitle: "",
        headerShadowVisible: false,
        headerTintColor: colors.text,
        headerStyle: { backgroundColor: colors.bg },
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
