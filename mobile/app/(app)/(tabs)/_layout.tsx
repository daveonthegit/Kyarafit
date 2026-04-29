import { Tabs } from "expo-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { View } from "react-native";
import { type NavSectionId } from "@kyarafit/design-system";
import { api } from "convex/_generated/api";
import { APP_HREF } from "@/lib/appRoutes";
import { NAV_SECTION_MATERIAL_ICON } from "@/lib/navIconsMobile";
import { MobileBackButton } from "@/components/navigation/MobileBackButton";
import { MobileSponsoredAdStrip } from "@/components/ads/MobileSponsoredAdStrip";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { APP_FONT_FAMILIES, navHeaderTitleStyle } from "@/theme/appFonts";

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
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;

  const getTabOptions = (route: keyof typeof TAB_SECTION_BY_ROUTE) => {
    const sectionId = TAB_SECTION_BY_ROUTE[route];
    const iconName = (NAV_SECTION_MATERIAL_ICON[sectionId] ??
      "circle") as keyof typeof MaterialIcons.glyphMap;
    const navTitleKey = sectionId === "menu" ? "menu" : sectionId;
    const navTitle = t(`nav.${navTitleKey}`);
    const headerTitle = route === "index" ? t("home.title") : navTitle;

    return {
      title: navTitle,
      headerTitle,
      headerBackVisible: false,
      headerLeft:
        route === "index" ? undefined : () => <MobileBackButton fallbackHref={APP_HREF.home} />,
      tabBarIcon: ({ color, size }: { color: string; size: number }) => (
        <MaterialIcons name={iconName} size={size} color={color} />
      ),
    };
  };

  return (
    <View className="flex-1">
      <Tabs
        screenOptions={{
          headerShown: true,
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: colors.bg,
          },
          headerTitleStyle: navHeaderTitleStyle(colors.text),
          sceneStyle: {
            backgroundColor: colors.bg,
          },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.meta,
          tabBarLabelStyle: {
            fontFamily: APP_FONT_FAMILIES.sansMedium,
            fontSize: 11,
          },
          tabBarStyle: {
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
          },
        }}
      >
        <Tabs.Screen name="index" options={getTabOptions("index")} />
        <Tabs.Screen name="builds" options={getTabOptions("builds")} />
        <Tabs.Screen name="elements" options={getTabOptions("elements")} />
        <Tabs.Screen name="planner" options={getTabOptions("planner")} />
        <Tabs.Screen name="more" options={getTabOptions("more")} />
      </Tabs>
      <View className="absolute bottom-[49px] left-0 right-0">
        <MobileSponsoredAdStrip userId={userId} />
      </View>
    </View>
  );
}
