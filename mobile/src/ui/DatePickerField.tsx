import { useCallback, useMemo, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { parseIsoDateOnly, formatIsoDateOnly } from "@/screens/conventions/utils";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { TextField } from "./TextField";

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

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder,
  minimumDate,
  maximumDate,
}: Props) {
  const { t } = useTranslation();
  const { colors, scheme } = useDesignTheme();
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
      <TextField
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
    <View className="w-full">
      <Text className="mb-1 text-sm font-medium text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
        {label}
      </Text>
      <Pressable
        onPress={onPressField}
        accessibilityRole="button"
        className="flex-row items-center rounded-xl border border-kyar-border bg-kyar-surface px-3 py-3 dark:border-kyar-dark-border dark:bg-kyar-dark-surface"
      >
        <Text
          className={`min-w-0 flex-1 text-base ${displayText ? "text-kyar-text dark:text-kyar-dark-text" : "text-kyar-textTertiary dark:text-kyar-dark-textTertiary"}`}
          numberOfLines={1}
        >
          {displayText || placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={22} color={colors.textSecondary} />
      </Pressable>

      {Platform.OS === "ios" ? (
        <Modal visible={iosOpen} animationType="slide" transparent>
          <Pressable
            className="flex-1 justify-end bg-kyar-text/40 dark:bg-kyar-dark-text/40"
            onPress={() => setIosOpen(false)}
          >
            <Pressable
              className="rounded-t-[28px] bg-kyar-bg pb-2 pt-3 dark:bg-kyar-dark-bg"
              style={{ paddingBottom: Math.max(insets.bottom, 12) }}
              onPress={(ev) => ev.stopPropagation()}
            >
              <View className="flex-row items-center justify-between border-b border-kyar-borderSubtle px-4 pb-3 dark:border-kyar-dark-borderSubtle">
                <Pressable onPress={() => setIosOpen(false)} hitSlop={12}>
                  <Text className="text-base text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                    {t("common.cancel")}
                  </Text>
                </Pressable>
                <Pressable onPress={commitIos} hitSlop={12}>
                  <Text className="text-base font-semibold text-kyar-accent">
                    {t("common.done")}
                  </Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="inline"
                themeVariant={scheme === "dark" ? "dark" : "light"}
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
