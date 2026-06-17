import { Pressable, type PressableProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useNavigation, type Href } from "expo-router";
import { useDesignTheme } from "@/theme/useDesignTheme";

type Props = Omit<PressableProps, "onPress"> & {
  fallbackHref?: Href;
  label?: string;
};

export function MobileBackButton({ fallbackHref, label = "Back", className, ...rest }: Props) {
  const navigation = useNavigation();
  const { colors } = useDesignTheme();

  const handlePress = () => {
    if (navigation.canGoBack()) {
      router.back();
      return;
    }
    if (fallbackHref) {
      router.replace(fallbackHref);
    }
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={10}
      onPress={handlePress}
      className={[
        "h-11 w-11 items-center justify-center rounded-none bg-transparent active:bg-kyar-muted dark:active:bg-kyar-dark-muted",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </Pressable>
  );
}
