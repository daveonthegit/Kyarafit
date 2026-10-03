import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { GlassPanel, PhotoBackdrop } from "@/ui/glass";

/** G1 screen-local presentation. Shared glass primitives and sync chrome remain unchanged. */
export function SettingsGlassFrame({
  title,
  eyebrow,
  description,
  children,
}: {
  title: string;
  eyebrow: string;
  description?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title,
          headerLargeTitle: false,
          headerTransparent: true,
          headerTintColor: glass.text.fg,
          headerStyle: { backgroundColor: "transparent" },
        }}
      />
      <PhotoBackdrop scrim="off" kenBurns={false} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: insets.top + 58,
          paddingBottom: insets.bottom + 40,
          alignItems: "center",
        }}
      >
        <GlassPanel onWall style={{ width: "100%", maxWidth: 600 }}>
          <View style={settingsGlassStyles.section}>
            <SettingsGlassLabel>{eyebrow}</SettingsGlassLabel>
            <Text accessibilityRole="header" style={settingsGlassStyles.title}>
              {title}
            </Text>
            {description ? <Text style={settingsGlassStyles.body}>{description}</Text> : null}
          </View>
          {children}
        </GlassPanel>
      </ScrollView>
    </View>
  );
}

export function SettingsGlassSection({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <View style={settingsGlassStyles.section}>
      {label ? <SettingsGlassLabel>{label}</SettingsGlassLabel> : null}
      {children}
    </View>
  );
}

export function SettingsGlassLabel({ children }: { children: ReactNode }) {
  return <Text style={settingsGlassStyles.label}>{children}</Text>;
}

export const settingsGlassStyles = StyleSheet.create({
  section: {
    padding: 22,
    gap: 12,
    borderBottomWidth: borderWidth.hairline,
    borderBottomColor: glass.border.divider,
  },
  label: {
    color: glass.text.fg70,
    fontFamily: APP_FONT_FAMILIES.sansBold,
    fontSize: 10,
    letterSpacing: ls(0.16, 10),
    textTransform: "uppercase",
  },
  title: {
    color: glass.text.fg,
    fontFamily: APP_FONT_FAMILIES.displayItalic,
    fontSize: 36,
    lineHeight: 42,
  },
  body: {
    color: glass.text.fg70,
    fontFamily: APP_FONT_FAMILIES.sansRegular,
    fontSize: 14,
    lineHeight: 23,
  },
  value: {
    color: glass.text.fg,
    fontFamily: APP_FONT_FAMILIES.sansSemiBold,
    fontSize: 16,
    lineHeight: 24,
    fontVariant: ["tabular-nums"],
  },
  count: {
    color: glass.text.fg,
    fontFamily: APP_FONT_FAMILIES.displayItalic,
    fontSize: 36,
    lineHeight: 42,
  },
  action: { marginTop: 4 },
});
