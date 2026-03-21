import React, { forwardRef, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BottomSheetModal, BottomSheetBackdrop } from "@gorhom/bottom-sheet";

export type MobileNavMenuRef = BottomSheetModal;

export const MobileNavMenu = forwardRef<MobileNavMenuRef>((props, ref) => {
  const router = useRouter();

  const handleCloseModalPress = useCallback(() => {
    if (ref && "current" in ref && ref.current) {
      ref.current.dismiss();
    }
  }, [ref]);

  const handleOptionPress = useCallback(
    (href: string) => {
      handleCloseModalPress();
      // Need a slight delay to allow bottom sheet to close smoothly before navigating
      setTimeout(() => {
        router.push(href as any);
      }, 300);
    },
    [router, handleCloseModalPress]
  );

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        pressBehavior="close"
      />
    ),
    []
  );

  const MENU_ITEMS = [
    { label: "Profile", icon: "person-outline", href: "/profile" },
    { label: "Events & Circuit", icon: "calendar-outline", href: "/plan" },
    { label: "Settings", icon: "settings-outline", href: "/settings" },
  ];

  return (
    <BottomSheetModal
      ref={ref}
      index={0}
      snapPoints={["40%"]}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: "#FFFFFF", borderRadius: 24 }}
      handleIndicatorStyle={{ backgroundColor: "rgba(0,0,0,0.1)", width: 40, height: 4 }}
    >
      <View className="flex-1 px-6 pt-3">
        <Text className="font-serif text-2xl text-black mb-6">Menu</Text>
        <View className="gap-2">
          {MENU_ITEMS.map((item) => (
            <Pressable
              key={item.href}
              className="flex-row items-center py-3 px-4 bg-[#F9F9F9] rounded-xl border border-black/5 active:bg-black/5"
              onPress={() => handleOptionPress(item.href)}
            >
              <View className="w-10 h-10 rounded-full bg-white items-center justify-center mr-4 border border-black/5 shadow-sm">
                <Ionicons name={item.icon as any} size={24} color="#000" />
              </View>
              <Text className="flex-1 font-sans text-base font-medium text-black">
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={20} color="rgba(0,0,0,0.4)" />
            </Pressable>
          ))}
        </View>
      </View>
    </BottomSheetModal>
  );
});
