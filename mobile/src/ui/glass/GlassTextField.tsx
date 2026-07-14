import { useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { glass, ls } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

/**
 * Glass-outline form field (web `.glass-field`, ref 13d): for inputs inside
 * glass panels/sheets. The cream `TextField` survives on not-yet-converted
 * screens only.
 */
export function GlassTextField({ label, error, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ width: "100%" }}>
      {label ? (
        <Text
          style={{
            marginBottom: 6,
            fontFamily: APP_FONT_FAMILIES.sansBold,
            fontSize: 10,
            letterSpacing: ls(0.16, 10),
            textTransform: "uppercase",
            color: glass.text.fg70,
          }}
        >
          {label}
        </Text>
      ) : null}
      <TextInput
        style={{
          minHeight: 44,
          borderWidth: 1,
          borderColor: error
            ? glass.text.danger
            : focused
              ? glass.border.strong
              : glass.border.overlay,
          borderRadius: 10,
          backgroundColor: glass.surface.field,
          paddingHorizontal: 12,
          paddingVertical: 12,
          fontFamily: APP_FONT_FAMILIES.sansRegular,
          fontSize: 15,
          color: glass.text.fg,
        }}
        placeholderTextColor={glass.text.fg55}
        keyboardAppearance="dark"
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...rest}
      />
      {error ? (
        <Text
          style={{
            marginTop: 6,
            fontFamily: APP_FONT_FAMILIES.sansRegular,
            fontSize: 12,
            color: glass.text.danger,
          }}
        >
          {error}
        </Text>
      ) : null}
    </View>
  );
}
