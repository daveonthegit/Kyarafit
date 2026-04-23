import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";

export type FloatingCreateAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function FloatingCreateMenu({
  actions,
  bottomOffset = 84,
}: {
  actions: FloatingCreateAction[];
  bottomOffset?: number;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useDesignTheme();

  const menuActions = useMemo(() => actions.filter(Boolean), [actions]);

  if (menuActions.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" className="absolute inset-0">
      {open ? (
        <Pressable
          className="absolute inset-0 bg-kyar-text/6 dark:bg-kyar-dark-text/8"
          onPress={() => setOpen(false)}
        />
      ) : null}

      <View
        pointerEvents="box-none"
        className="absolute right-5 items-end"
        style={{ bottom: insets.bottom + bottomOffset }}
      >
        {open ? (
          <View className="mb-3 min-w-[204px] gap-2 rounded-3xl border border-kyar-borderSubtle bg-kyar-surface p-2 shadow-fab dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface">
            {menuActions.map((action) => (
              <Pressable
                key={action.key}
                onPress={() => {
                  setOpen(false);
                  action.onPress();
                }}
                className="min-h-[52px] flex-row items-center gap-3 rounded-2xl px-4 py-3 active:bg-kyar-panel dark:active:bg-kyar-dark-panel"
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-kyar-panel dark:bg-kyar-dark-panel">
                  <Ionicons name={action.icon} size={18} color={colors.text} />
                </View>
                <Text
                  style={{ fontFamily: APP_FONT_FAMILIES.sansSemiBold }}
                  className="flex-1 text-sm text-kyar-text dark:text-kyar-dark-text"
                >
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <Pressable
          onPress={() => setOpen((value) => !value)}
          className="h-16 w-16 items-center justify-center rounded-full bg-kyar-text shadow-fab active:opacity-90 dark:bg-kyar-dark-text"
          accessibilityRole="button"
          accessibilityLabel={open ? "Close create menu" : "Open create menu"}
        >
          <Ionicons
            name={open ? "close" : "add"}
            size={30}
            color={scheme === "dark" ? "#171726" : "#F7F3EB"}
          />
        </Pressable>
      </View>
    </View>
  );
}
