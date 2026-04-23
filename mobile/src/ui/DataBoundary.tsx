import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { useDesignTheme } from "@/theme/useDesignTheme";

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
  const { colors } = useDesignTheme();

  if (status === "loading") {
    return (
      loading ?? (
        <View className="flex-1 items-center justify-center py-12">
          <ActivityIndicator accessibilityLabel="Loading" color={colors.text} />
        </View>
      )
    );
  }

  if (status === "error") {
    return (
      <View className="flex-1 justify-center bg-kyar-bg px-6 dark:bg-kyar-dark-bg">
        <Text className="text-base font-semibold text-kyar-danger dark:text-kyar-dark-danger">
          Could not load
        </Text>
        <Text className="mt-2 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {error?.message ?? "Unknown error"}
        </Text>
        {onRetry ? (
          <Pressable
            className="mt-4 self-start rounded-xl bg-kyar-text px-4 py-3 active:opacity-90 dark:bg-kyar-dark-text"
            onPress={onRetry}
            accessibilityRole="button"
          >
            <Text className="font-semibold text-kyar-bg dark:text-kyar-dark-bg">Retry</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (status === "empty") {
    return (
      empty ?? (
        <View className="flex-1 items-center justify-center bg-kyar-bg px-6 py-12 dark:bg-kyar-dark-bg">
          <Text className="text-center text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            Nothing here yet.
          </Text>
        </View>
      )
    );
  }

  if (data === undefined) {
    return null;
  }

  return <>{children(data)}</>;
}
