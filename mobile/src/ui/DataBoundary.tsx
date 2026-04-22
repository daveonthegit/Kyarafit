import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

type Status = "loading" | "empty" | "error" | "ready";

type Props<T> = {
  status: Status;
  data?: T;
  loading?: ReactNode;
  empty?: ReactNode;
  error?: Error | null;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
};

/**
 * Standard data states for screens (blueprint §3.12). Prefer this over ad-hoc spinners.
 */
export function DataBoundary<T>(props: Props<T>): ReactNode {
  const { status, data, loading, empty, error, onRetry, children } = props;

  if (status === "loading") {
    return (
      loading ?? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator accessibilityLabel="Loading" />
        </View>
      )
    );
  }

  if (status === "error") {
    return (
      <View className="flex-1 justify-center px-6">
        <Text className="text-base font-semibold text-red-900">Could not load</Text>
        <Text className="mt-2 text-red-800">{error?.message ?? "Unknown error"}</Text>
        {onRetry ? (
          <Pressable
            className="mt-4 self-start rounded-xl bg-neutral-900 px-4 py-3 active:opacity-90"
            onPress={onRetry}
            accessibilityRole="button"
          >
            <Text className="font-semibold text-white">Retry</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (status === "empty") {
    return (
      empty ?? (
        <View className="flex-1 items-center justify-center px-6 py-12">
          <Text className="text-center text-neutral-600">Nothing here yet.</Text>
        </View>
      )
    );
  }

  if (data === undefined) {
    return null;
  }

  return <>{children(data)}</>;
}
