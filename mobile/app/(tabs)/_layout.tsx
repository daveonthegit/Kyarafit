import { Tabs } from "expo-router";
import { View, Text } from "react-native";
import { useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { UnifiedAddFAB } from "../../src/components/ui/UnifiedAddFAB";
import { MobileNavMenu } from "../../src/components/layout/MobileNavMenu";

type TabIconProps = {
  focused: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
};

function TabIcon({ focused, icon, label }: TabIconProps) {
  return (
    <View className="relative items-center justify-center h-full w-full pt-2">
      {focused && <View className="absolute top-0 w-8 h-[3px] bg-black rounded-b-sm" />}
      <View className="items-center justify-center gap-1">
        <Ionicons name={icon} size={24} color={focused ? "#000" : "#9CA3AF"} />
        <Text
          className={`text-[10px] uppercase tracking-widest font-semibold ${
            focused ? "text-black" : "text-gray-400"
          }`}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const menuSheetRef = useRef<BottomSheetModal>(null);

  return (
    <View className="flex-1 bg-white">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: "#F4F4F4",
            borderTopWidth: 1,
            borderTopColor: "rgba(0,0,0,0.05)",
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
            title: "Home",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="home-outline" label="Home" />
            ),
          }}
        />
        <Tabs.Screen
          name="builds"
          options={{
            title: "Outfits",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="layers-outline" label="Outfits" />
            ),
          }}
        />
        <Tabs.Screen
          name="closet"
          options={{
            title: "Closet",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="shirt-outline" label="Closet" />
            ),
          }}
        />
        <Tabs.Screen
          name="planner"
          options={{
            title: "Planner",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="checkbox-outline" label="Planner" />
            ),
          }}
        />
        <Tabs.Screen
          name="menu"
          options={{
            title: "Menu",
            tabBarIcon: ({ focused }) => (
              <TabIcon focused={focused} icon="menu-outline" label="Menu" />
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              menuSheetRef.current?.present();
            },
          }}
        />
      </Tabs>
      <UnifiedAddFAB />
      <MobileNavMenu ref={menuSheetRef} />
    </View>
  );
}
