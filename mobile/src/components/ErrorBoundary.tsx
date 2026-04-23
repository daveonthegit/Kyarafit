import React, { type ErrorInfo, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

type Props = { children: ReactNode };

type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error.message, info.componentStack);
  }

  private clear = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      return (
        <View className="flex-1 justify-center bg-kyar-bg px-6 dark:bg-kyar-dark-bg">
          <Text className="text-lg font-semibold text-kyar-danger dark:text-kyar-dark-danger">
            Something went wrong
          </Text>
          <Text className="mt-2 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {this.state.error.message}
          </Text>
          <Pressable
            className="mt-6 rounded-xl bg-kyar-text px-4 py-3 active:opacity-90 dark:bg-kyar-dark-text"
            onPress={this.clear}
            accessibilityRole="button"
          >
            <Text className="text-center font-semibold text-kyar-bg dark:text-kyar-dark-bg">
              Try again
            </Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
