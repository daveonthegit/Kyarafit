import { Tabs } from "expo-router";
import { View, Text, Pressable } from "react-native";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../src/i18n";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { UnifiedAddFAB } from "../../src/components/ui/UnifiedAddFAB";
import { MobileNavMenu } from "../../src/components/layout/MobileNavMenu";
import { KyarIcon, type KyarIconName } from "../../src/components/shared";

type TabIconProps = {
  focused: boolean;
  icon: KyarIconName;
  label: string;
};

function TabIcon({ focused, icon, label }: TabIconProps) {
  const active = "#000000";
  const inactive = "rgba(0,0,0,0.38)";
  return (
    <View className="relative items-center justify-center h-full w-full pt-2">
      {focused ? <View className="absolute top-0 w-8 h-[3px] bg-black rounded-b-sm" /> : null}
      <View className="items-center justify-center gap-1">
        <KyarIcon name={icon} size={24} color={focused ? active : inactive} />
        <Text
          className={`text-[9px] uppercase tracking-[0.25em] font-semibold ${
            focused ? "text-black font-bold" : "text-black/40"
          }`}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const menuSheetRef = useRef<BottomSheetModal>(null);

  return (
    <View className="flex-1 bg-white">
      <Tabs
        key={i18n.language}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: "#F4F4F4",
            borderTopWidth: 1,
            borderTopColor: "rgba(0,0,0,0.06)",
            height: 60 + Math.max(12, insets.bottom),
            paddingBottom: Math.max(12, insets.bottom),
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            elevation: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: t("Nav.home"),
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="home" label={t("Nav.home")} />
            ),
          }}
        />
        <Tabs.Screen
          name="builds"
          options={{
            title: t("Nav.builds"),
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="layers" label={t("Nav.builds")} />
            ),
          }}
        />
        <Tabs.Screen
          name="closet"
          options={{
            title: t("Nav.elements"),
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="checkroom" label={t("Nav.elements")} />
            ),
          }}
        />
        <Tabs.Screen
          name="planner"
          options={{
            title: t("Nav.planner"),
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="event_note" label={t("Nav.planner")} />
            ),
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: t("Nav.menu"),
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="menu" label={t("Nav.menu")} />
            ),
            /** Open nav sheet without navigating — `tabPress` + preventDefault is unreliable in Expo Router. */
            tabBarButton: (props: BottomTabBarButtonProps) => (
              <Pressable
                accessibilityRole={props.accessibilityRole}
                accessibilityState={props.accessibilityState}
                accessibilityLabel={props.accessibilityLabel}
                testID={props.testID}
                onPress={() => menuSheetRef.current?.present()}
                style={props.style}
              >
                {props.children}
              </Pressable>
            ),
          }}
        />
      </Tabs>
      <UnifiedAddFAB />
      <MobileNavMenu ref={menuSheetRef} />
    </View>
  );
}
