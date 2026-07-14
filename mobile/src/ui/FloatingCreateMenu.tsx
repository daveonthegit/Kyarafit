import { useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { glass, ls, shadow } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { GlassSheet } from "./glass/GlassSheet";

export type FloatingCreateAction = {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

/**
 * Contextual create control (web `GlobalFAB` mirror): solid-light pill above
 * the tab bar — the screen's ONE primary (QA-3). First action is the
 * screen's primary add; extra actions open a glass sheet menu.
 */
export function FloatingCreateMenu({
  actions,
  bottomOffset = 84,
}: {
  actions: FloatingCreateAction[];
  bottomOffset?: number;
}) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const menuActions = useMemo(() => actions.filter(Boolean), [actions]);

  if (menuActions.length === 0) {
    return null;
  }

  const [primary, ...others] = menuActions;

  return (
    <>
      <View
        pointerEvents="box-none"
        className="absolute right-5 items-end"
        style={{ bottom: insets.bottom + bottomOffset }}
      >
        <View
          style={[
            shadow.fab,
            {
              flexDirection: "row",
              alignItems: "center",
              borderRadius: 999,
              backgroundColor: glass.surface.solid,
              overflow: "hidden",
            },
          ]}
        >
          <Pressable
            onPress={primary.onPress}
            accessibilityRole="button"
            accessibilityLabel={primary.label}
            style={({ pressed }) => ({
              minHeight: 44,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              paddingLeft: 20,
              paddingRight: others.length > 0 ? 14 : 20,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Ionicons name={primary.icon} size={16} color={glass.text.ink} />
            <Text
              style={{
                fontFamily: APP_FONT_FAMILIES.sansBold,
                fontSize: 10,
                letterSpacing: ls(0.16, 10),
                textTransform: "uppercase",
                color: glass.text.ink,
              }}
            >
              {primary.label}
            </Text>
          </Pressable>
          {others.length > 0 ? (
            <>
              <View
                style={{
                  width: 1,
                  height: 24,
                  backgroundColor: glass.text.ink,
                  opacity: 0.25,
                }}
              />
              <Pressable
                onPress={() => setOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={t("common.moreCreateOptions")}
                style={({ pressed }) => ({
                  minHeight: 44,
                  minWidth: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Ionicons name="chevron-up" size={18} color={glass.text.ink} />
              </Pressable>
            </>
          ) : null}
        </View>
      </View>

      <GlassSheet open={open} onClose={() => setOpen(false)} closeLabel={t("common.closeCreateMenu")}>
        <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>
          {others.map((action) => (
            <Pressable
              key={action.key}
              onPress={() => {
                setOpen(false);
                action.onPress();
              }}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={({ pressed }) => ({
                minHeight: 52,
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingHorizontal: 12,
                borderRadius: 10,
                backgroundColor: pressed ? glass.surface.active : "transparent",
              })}
            >
              <View
                style={{
                  height: 36,
                  width: 36,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  backgroundColor: glass.surface.bar,
                }}
              >
                <Ionicons name={action.icon} size={18} color={glass.text.fg} />
              </View>
              <Text
                style={{
                  flex: 1,
                  fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                  fontSize: 14,
                  color: glass.text.fg,
                }}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </GlassSheet>
    </>
  );
}
