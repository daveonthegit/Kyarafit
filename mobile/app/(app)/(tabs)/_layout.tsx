import { useState } from "react";
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { type NavSectionId } from "@kyarafit/design-system";
import { APP_HREF } from "@/lib/appRoutes";
import { GlassTabBar } from "@/components/navigation/GlassTabBar";
import { MobileNavDrawer } from "@/components/navigation/MobileNavDrawer";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { useDesignTheme } from "@/theme/useDesignTheme";
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
  const { colors } = useDesignTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  const getTabOptions = (route: keyof typeof TAB_SECTION_BY_ROUTE) => {
    const sectionId = TAB_SECTION_BY_ROUTE[route];
    const navTitleKey = sectionId === "menu" ? "menu" : sectionId;
    const navTitle = t(`nav.${navTitleKey}`);
    const headerTitle = route === "index" ? t("home.title") : navTitle;

    return {
      title: navTitle,
      headerTitle,
      headerBackVisible: false,
      headerLeft:
        route === "index"
          ? undefined
          : () => <MobileBackButton surface="glass" fallbackHref={APP_HREF.home} />,
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
          sceneStyle: {
            backgroundColor: colors.bg,
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
