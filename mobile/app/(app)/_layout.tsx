import { Redirect, Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "@/lib/auth/client";
import { APP_HREF } from "@/lib/appRoutes";

export default function AppGroupLayout() {
  const { session, loading } = useSession();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-kyar-bg dark:bg-kyar-dark-bg">
        <ActivityIndicator />
      </View>
    );
  }

  if (!session?.user) {
    return <Redirect href={APP_HREF.signIn} />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
