import type { ReactNode } from "react";
import { View, Text, Pressable, type ViewProps } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, font, layout } from "@kyarafit/design-system/rn";
import { KyarIcon } from "./KyarIcon";
import { MetaLabel } from "./MetaLabel";

export type ScreenHeaderProps = ViewProps & {
  /** Large editorial title (Bodoni / serif-elegant). */
  title: string;
  /** Small uppercase line above title. */
  meta?: string;
  subtitle?: string;
  onBack?: () => void;
  /** Trailing actions (e.g. icon buttons). */
  trailing?: ReactNode;
  /** Extra bottom padding when not using sticky chrome. */
  bottomPadding?: number;
};

export function ScreenHeader({
  title,
  meta,
  subtitle,
  onBack,
  trailing,
  bottomPadding = 16,
  style,
  children,
  ...rest
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const top = Math.max(insets.top, 12);

  return (
    <View
      style={[
        {
          paddingTop: top,
          paddingHorizontal: layout.screenPaddingX,
          paddingBottom: bottomPadding,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
          backgroundColor: colors.bg,
        },
        style,
      ]}
      {...rest}
    >
      <View
        style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <KyarIcon name="arrow_back" size={24} color={colors.text} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1 }}>
            {meta ? (
              <View style={{ marginBottom: 4 }}>
                <MetaLabel>{meta}</MetaLabel>
              </View>
            ) : null}
            <Text
              style={{
                fontFamily: font.family.serifElegant,
                fontSize: 28,
                fontStyle: "italic",
                fontWeight: "400",
                color: colors.text,
                letterSpacing: -0.5,
              }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{
                  marginTop: 4,
                  fontSize: 11,
                  color: colors.textSecondary,
                }}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>
        {trailing ? <View style={{ marginLeft: 8 }}>{trailing}</View> : null}
      </View>
      {children}
    </View>
  );
}
