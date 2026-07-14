import { Pressable, Text, View } from "react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useTranslation } from "react-i18next";
import { type NavSectionId } from "@kyarafit/design-system";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { NAV_SECTION_MATERIAL_ICON } from "@/lib/navIconsMobile";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { GlassBar } from "@/ui/glass";

/**
 * Glass tab bar (web `BottomNav` mirror): bar-weight glass on the studio
 * wall, top hairline, light top-notch active state, 55% inactive, full-cell
 * ≥44pt targets (QA-5). Labeled tabs — web kept labels, prototype icon-only
 * loses.
 */
export function GlassTabBar({
  state,
  descriptors,
  navigation,
  sectionByRoute,
  onMenuPress,
}: BottomTabBarProps & {
  sectionByRoute: Record<string, NavSectionId>;
  onMenuPress: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  return (
    <GlassBar
      style={{
        // Overlays the scene so full-bleed photo backdrops run under the bar
        // (converted screens pad their scroll content with GLASS_TAB_BAR_SPACE).
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        borderWidth: 0,
        borderTopWidth: borderWidth.hairline,
        borderColor: glass.border.dividerStrong,
        borderRadius: 0,
      }}
    >
      <View style={{ flexDirection: "row", paddingBottom: Math.max(insets.bottom, 8) }}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const sectionId = sectionByRoute[route.name] ?? "home";
          const isMenu = sectionId === "menu";
          const isActive = !isMenu && state.index === index;
          const iconName = (NAV_SECTION_MATERIAL_ICON[sectionId] ??
            "circle") as keyof typeof MaterialIcons.glyphMap;
          const label =
            typeof options.title === "string" ? options.title : t(`nav.${sectionId}`);

          const onPress = () => {
            if (isMenu) {
              onMenuPress();
              return;
            }
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!isActive && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole={isMenu ? "button" : "tab"}
              accessibilityState={isMenu ? undefined : { selected: isActive }}
              accessibilityLabel={label}
              style={{
                flex: 1,
                minHeight: 56,
                alignItems: "center",
                justifyContent: "center",
                paddingVertical: 8,
              }}
            >
              {isActive ? (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    width: 28,
                    height: 2,
                    borderBottomLeftRadius: 2,
                    borderBottomRightRadius: 2,
                    backgroundColor: glass.text.fg,
                  }}
                />
              ) : null}
              <MaterialIcons
                name={iconName}
                size={24}
                color={isActive ? glass.text.fg : glass.text.fg55}
                style={{ marginBottom: 2 }}
              />
              <Text
                style={{
                  fontFamily: isActive
                    ? APP_FONT_FAMILIES.sansBold
                    : APP_FONT_FAMILIES.sansSemiBold,
                  fontSize: 10,
                  letterSpacing: ls(0.16, 10),
                  textTransform: "uppercase",
                  color: isActive ? glass.text.fg : glass.text.fg55,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </GlassBar>
  );
}
