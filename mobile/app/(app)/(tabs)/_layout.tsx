import { useState } from "react";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { type NavSectionId } from "@kyarafit/design-system";
import { GlassTabBar } from "@/components/navigation/GlassTabBar";
import { MobileNavDrawer } from "@/components/navigation/MobileNavDrawer";
import { glass } from "@kyarafit/design-system/rn";
import { glassHeaderOptions } from "@/theme/glassNavigation";

const TAB_SECTION_BY_ROUTE = {
  index: "home",
  builds: "builds",
  elements: "elements",
  planner: "planner",
  more: "menu",
} as const satisfies Record<string, NavSectionId>;

export default function TabsLayout() {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  const getTabOptions = (route: keyof typeof TAB_SECTION_BY_ROUTE) => {
    const sectionId = TAB_SECTION_BY_ROUTE[route];
    const navTitleKey = sectionId === "menu" ? "menu" : sectionId;
    const navTitle = t(`nav.${navTitleKey}`);

    // Converted studio tabs draw their own headline over the photo (7a/7b/
    // 7e + closet) — no navigation header.
    return {
      title: navTitle,
      headerShown: false as const,
    };
  };

  return (
    <View className="flex-1">
      <Tabs
        tabBar={(props) => (
          <GlassTabBar
            {...props}
            sectionByRoute={TAB_SECTION_BY_ROUTE}
            onMenuPress={() => setMenuOpen(true)}
          />
        )}
        screenOptions={{
          ...glassHeaderOptions(),
          // Studio-wall dark behind full-bleed scenes — never a cream flash.
          sceneStyle: {
            backgroundColor: glass.scrim.studioWall.stops[0].color,
          },
        }}
      >
        <Tabs.Screen name="index" options={getTabOptions("index")} />
        <Tabs.Screen name="builds" options={getTabOptions("builds")} />
        <Tabs.Screen name="elements" options={getTabOptions("elements")} />
        <Tabs.Screen name="planner" options={getTabOptions("planner")} />
        <Tabs.Screen name="more" options={{ ...getTabOptions("more"), headerShown: false }} />
      </Tabs>
      <MobileNavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />
    </View>
  );
}
