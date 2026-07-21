import { useCallback, useMemo, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { glass, ls, borderWidth } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { parseIsoDateOnly, formatIsoDateOnly } from "@/screens/conventions/utils";
import { GlassTextField } from "@/ui/glass";

type Props = {
  label: string;
  /** `YYYY-MM-DD` or empty. */
  value: string;
  onChange: (iso: string) => void;
  placeholder: string;
  minimumDate?: Date;
  maximumDate?: Date;
};

function defaultDate(): Date {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

/**
 * Glass-outline date field (ref 13d form grammar) — local to the convention
 * form, the shared `DatePickerField`'s only consumer. Same platform-picker
 * logic; only the presentation moved onto glass.
 */
export function GlassDateField({
  label,
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
}: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(() => parseIsoDateOnly(value) ?? defaultDate());

  const displayText = useMemo(() => {
    const d = parseIsoDateOnly(value);
    if (!d) return "";
    return d.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }, [value]);

  const baseDate = useMemo(() => parseIsoDateOnly(value) ?? defaultDate(), [value]);

  const openAndroid = useCallback(() => {
    DateTimePickerAndroid.open({
      value: baseDate,
      mode: "date",
      display: "calendar",
      minimumDate,
      maximumDate,
      onChange: (event: DateTimePickerEvent, selected?: Date) => {
        if (event.type === "dismissed") return;
        if (selected) onChange(formatIsoDateOnly(selected));
      },
    });
  }, [baseDate, maximumDate, minimumDate, onChange]);

  const openIos = useCallback(() => {
    setIosDraft(parseIsoDateOnly(value) ?? defaultDate());
    setIosOpen(true);
  }, [value]);

  const onPressField = useCallback(() => {
    if (Platform.OS === "android") openAndroid();
    else openIos();
  }, [openAndroid, openIos]);

  const onIosChange = useCallback((_e: DateTimePickerEvent, selected?: Date) => {
    if (selected) setIosDraft(selected);
  }, []);

  const commitIos = useCallback(() => {
    onChange(formatIsoDateOnly(iosDraft));
    setIosOpen(false);
  }, [iosDraft, onChange]);

  if (Platform.OS === "web") {
    return (
      <GlassTextField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        autoCapitalize="none"
        autoCorrect={false}
      />
    );
  }

  return (
    <View style={{ width: "100%" }}>
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
      <Pressable
        onPress={onPressField}
        accessibilityRole="button"
        className="active:opacity-80"
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          minHeight: 44,
          borderWidth: 1,
          borderColor: glass.border.overlay,
          borderRadius: 10,
          backgroundColor: glass.surface.field,
          paddingHorizontal: 12,
        }}
      >
        <Text
          style={{
            minWidth: 0,
            flex: 1,
            fontFamily: APP_FONT_FAMILIES.sansRegular,
            fontSize: 15,
            color: displayText ? glass.text.fg : glass.text.fg55,
          }}
          numberOfLines={1}
        >
          {displayText || placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={glass.text.fg55} />
      </Pressable>

      {Platform.OS === "ios" ? (
        <Modal visible={iosOpen} animationType="slide" transparent>
          <Pressable
            style={{ flex: 1, justifyContent: "flex-end", backgroundColor: glass.scrimDim }}
            onPress={() => setIosOpen(false)}
          >
            <Pressable
              style={{
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                backgroundColor: glass.fallback.overlay,
                borderTopWidth: borderWidth.hairline,
                borderTopColor: glass.border.overlay,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 12),
              }}
              onPress={(ev) => ev.stopPropagation()}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 16,
                  paddingBottom: 12,
                  borderBottomWidth: borderWidth.hairline,
                  borderBottomColor: glass.border.divider,
                }}
              >
                <Pressable onPress={() => setIosOpen(false)} hitSlop={12}>
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansRegular,
                      fontSize: 15,
                      color: glass.text.fg70,
                    }}
                  >
                    {t("common.cancel")}
                  </Text>
                </Pressable>
                <Pressable onPress={commitIos} hitSlop={12}>
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                      fontSize: 15,
                      color: glass.text.fg,
                    }}
                  >
                    {t("common.done")}
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="inline"
                themeVariant="dark"
                onChange={onIosChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                style={{ alignSelf: "stretch" }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </View>
  );
}
