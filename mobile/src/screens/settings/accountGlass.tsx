import type { ReactNode } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { glass, ls } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { PhotoBackdrop, PhotoPill } from "@/ui/glass";

/** Presentation shared only by the G2 account and subscription screens. */
export function AccountFrame({ children }: { children: ReactNode }) {
  return (
    <View style={{ flex: 1 }}>
      <PhotoBackdrop scrim="off" />
      {children}
    </View>
  );
}

export function AccountScroll({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{
        paddingHorizontal: 16,
        paddingTop: insets.top + 58,
        paddingBottom: insets.bottom + 120,
        gap: 16,
        width: "100%",
        maxWidth: 640,
        alignSelf: "center",
      }}
    >
      {children}
    </ScrollView>
  );
}

export function AccountHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={{ paddingHorizontal: 6, marginBottom: 8 }}>
      <Text
        accessibilityRole="header"
        style={{
          fontFamily: APP_FONT_FAMILIES.displayItalic,
          fontSize: 34,
          lineHeight: 40,
          color: glass.text.fg,
        }}
      >
        {title}
      </Text>
      <AccountText style={{ marginTop: 12 }}>{subtitle}</AccountText>
    </View>
  );
}

export function AccountSection({ children }: { children: ReactNode }) {
  return <View style={accountStyles.section}>{children}</View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={accountStyles.label}>{children}</Text>;
}

export function AccountText({ style, danger = false, ...props }: TextProps & { danger?: boolean }) {
  return (
    <Text {...props} style={[accountStyles.body, danger && { color: glass.text.danger }, style]} />
  );
}

export function AccountAction({
  children,
  onPress,
  disabled,
  label,
}: {
  children: string;
  onPress: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <PhotoPill
      variant="text"
      label={children}
      accessibilityLabel={label ?? children}
      onPress={onPress}
      disabled={disabled}
    />
  );
}

export function AccountLoading({ label }: { label: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <ActivityIndicator color={glass.text.fg} accessibilityLabel={label} />
      <AccountText>{label}</AccountText>
    </View>
  );
}

export const accountStyles = StyleSheet.create({
  section: {
    borderBottomWidth: 1,
    borderBottomColor: glass.border.divider,
    paddingVertical: 20,
    gap: 10,
  },
  label: {
    fontFamily: APP_FONT_FAMILIES.sansBold,
    fontSize: 10,
    letterSpacing: ls(0.16, 10),
    textTransform: "uppercase",
    color: glass.text.fg70,
  },
  body: {
    fontFamily: APP_FONT_FAMILIES.sansRegular,
    fontSize: 14,
    lineHeight: 22,
    color: glass.text.fg70,
  },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12 },
  stack: { gap: 12 },
});
