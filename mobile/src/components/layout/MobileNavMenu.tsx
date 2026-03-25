import React, { forwardRef, useCallback } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { BottomSheetModal, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { KyarIcon, type KyarIconName } from "../shared/KyarIcon";
import { colors, font } from "@kyarafit/design-system/rn";

export type MobileNavMenuRef = BottomSheetModal;

type MenuItem = {
  labelKey: string;
  href: string;
  icon: KyarIconName;
};

const MENU_ITEMS: MenuItem[] = [
  { labelKey: "Nav.profile", icon: "person", href: "/profile" },
  { labelKey: "Nav.events", icon: "calendar_today", href: "/plan" },
  { labelKey: "Nav.groups", icon: "groups", href: "/groups" },
  { labelKey: "Nav.discover", icon: "explore", href: "/discover" },
  { labelKey: "Nav.feed", icon: "rss_feed", href: "/feed" },
  { labelKey: "Nav.settings", icon: "settings", href: "/settings" },
];

export const MobileNavMenu = forwardRef<MobileNavMenuRef>((props, ref) => {
  const { t } = useTranslation();
  const router = useRouter();

  const handleCloseModalPress = useCallback(() => {
    if (ref && "current" in ref && ref.current) {
      ref.current.dismiss();
    }
  }, [ref]);

  const handleOptionPress = useCallback(
    (href: string) => {
      handleCloseModalPress();
      setTimeout(() => {
        router.push(href as "/profile");
      }, 280);
    },
    [router, handleCloseModalPress]
  );

  const renderBackdrop = useCallback(
    (backdropProps: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop
        {...backdropProps}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={["58%"]}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.bg, borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: "rgba(0,0,0,0.1)", width: 40, height: 4 }}
    >
      <ScrollView
        className="flex-1 px-6 pt-3"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontFamily: font.family.serifElegant,
            fontSize: 24,
            fontStyle: "italic",
            color: colors.text,
            marginBottom: 20,
          }}
        >
          {t("Nav.menu")}
        </Text>
        <View className="gap-2">
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.href}
              className="flex-row items-center py-3 px-4 bg-[#F9F9F9] rounded-xl border border-black/5 active:bg-black/5"
              onPress={() => handleOptionPress(item.href)}
              accessibilityRole="button"
              accessibilityLabel={t(item.labelKey)}
            >
              <View className="w-10 h-10 rounded-full bg-white items-center justify-center mr-4 border border-black/5 shadow-sm">
                <KyarIcon name={item.icon} size={22} color={colors.text} />
              </View>
              <Text className="flex-1 font-sans text-base font-medium text-black">
                {t(item.labelKey)}
              </Text>
              <KyarIcon name="chevron_right" size={20} color="rgba(0,0,0,0.4)" />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
});

MobileNavMenu.displayName = "MobileNavMenu";
