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
        <View className="flex-1 justify-center px-6" style={{ backgroundColor: "#fef2f2" }}>
          <Text className="text-lg font-semibold text-red-900">Something went wrong</Text>
          <Text className="mt-2 text-red-800">{this.state.error.message}</Text>
          <Pressable
            className="mt-6 rounded-xl bg-red-700 px-4 py-3 active:opacity-90"
            onPress={this.clear}
            accessibilityRole="button"
          >
            <Text className="text-center font-semibold text-white">Try again</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}
