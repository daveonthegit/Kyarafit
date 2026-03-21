import React, { useRef, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { BottomSheetModal, BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import { colors, font, shadow, spacing } from "@kyarafit/design-system/rn";
import { ADD_MENU_ITEMS, type AddMenuItem } from "@kyarafit/design-system";

export function UnifiedAddFAB() {
  const router = useRouter();
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  const handlePresentModalPress = useCallback(() => {
    bottomSheetModalRef.current?.present();
  }, []);

  const handleCloseModalPress = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
  }, []);

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

  const getIconForAddType = (labelKey: string): keyof typeof Ionicons.glyphMap => {
    if (labelKey === "addOutfit") return "layers-outline";
    if (labelKey === "addItem") return "shirt-outline";
    if (labelKey === "addEvent") return "calendar-outline";
    return "add-outline";
  };

  const getTitleForAddType = (labelKey: string): string => {
    if (labelKey === "addOutfit") return "New Outfit";
    if (labelKey === "addItem") return "New Closet Item";
    if (labelKey === "addEvent") return "New Event";
    return labelKey;
  };

  return (
    <>
      <Pressable
        style={styles.fab}
        onPress={handlePresentModalPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>

      <BottomSheetModal
        ref={bottomSheetModalRef}
        index={0}
        snapPoints={["35%"]}
        backdropComponent={renderBackdrop}
        handleIndicatorStyle={styles.handleIndicator}
        backgroundStyle={styles.bottomSheetBackground}
      >
        <View style={styles.contentContainer}>
          <Text style={styles.sheetTitle}>Create New</Text>
          <View style={styles.optionsList}>
            {ADD_MENU_ITEMS.map((item: AddMenuItem) => (
              <Pressable
                key={item.href}
                style={({ pressed }) => [
                  styles.optionButton,
                  pressed && styles.optionButtonPressed,
                ]}
                onPress={() => handleOptionPress(item.href)}
              >
                <View style={styles.iconContainer}>
                  <Ionicons
                    name={getIconForAddType(item.labelKey)}
                    size={24}
                    color={colors.black}
                  />
                </View>
                <Text style={styles.optionText}>{getTitleForAddType(item.labelKey)}</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </View>
      </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    bottom: 90, // Above tab bar
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.black,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.fab,
    zIndex: 999,
  },
  bottomSheetBackground: {
    backgroundColor: colors.white,
    borderRadius: 24,
  },
  handleIndicator: {
    backgroundColor: colors.border,
    width: 40,
    height: 4,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  sheetTitle: {
    fontFamily: font.serif,
    fontSize: font.size["2xl"],
    color: colors.black,
    marginBottom: spacing[6],
  },
  optionsList: {
    gap: spacing[2],
  },
  optionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    backgroundColor: colors.muted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  optionButtonPressed: {
    backgroundColor: colors.borderSubtle,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.white,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing[4],
    ...shadow.soft,
    elevation: 0,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  optionText: {
    flex: 1,
    fontFamily: font.sansSerif,
    fontSize: font.size.base,
    fontWeight: "500",
    color: colors.text,
  },
});
