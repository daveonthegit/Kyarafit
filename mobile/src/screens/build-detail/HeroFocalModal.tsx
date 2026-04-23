import { useState } from "react";
import { Image, Modal, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";

type Props = {
  visible: boolean;
  imageUri: string;
  initialFocalX?: number | null;
  initialFocalY?: number | null;
  onClose: () => void;
  onSave: (fx: number, fy: number) => void;
};

/** Tap anywhere on the hero preview to set focal point (normalized 0–1). Parity with web crop UX (simplified). */
export function HeroFocalModal({
  visible,
  imageUri,
  initialFocalX,
  initialFocalY,
  onClose,
  onSave,
}: Props) {
  const { t } = useTranslation();
  const [layout, setLayout] = useState({ w: 1, h: 1 });
  const [draft, setDraft] = useState<{ x: number; y: number } | null>(null);

  const fx = draft?.x ?? initialFocalX ?? 0.5;
  const fy = draft?.y ?? initialFocalY ?? 0.5;

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-kyar-text/55 dark:bg-kyar-dark-bg/75">
        <View className="max-h-[85%] rounded-t-3xl bg-kyar-surface px-4 pb-8 pt-4 dark:bg-kyar-dark-surface">
          <Text
            style={{ fontFamily: APP_FONT_FAMILIES.sansSemiBold }}
            className="text-lg text-kyar-text dark:text-kyar-dark-text"
          >
            {t("buildDetail.heroFocalTitle")}
          </Text>
          <Text className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
            {t("buildDetail.heroFocalHint")}
          </Text>

          <Pressable
            className="relative mt-4 aspect-[4/5] w-full overflow-hidden rounded-3xl bg-kyar-muted dark:bg-kyar-dark-muted"
            onPress={(e) => {
              const { locationX, locationY } = e.nativeEvent;
              const x = Math.max(0, Math.min(1, locationX / layout.w));
              const y = Math.max(0, Math.min(1, locationY / layout.h));
              setDraft({ x, y });
            }}
            onLayout={(ev) => {
              const { width, height } = ev.nativeEvent.layout;
              setLayout({ w: width || 1, h: height || 1 });
            }}
          >
            <Image
              source={{ uri: imageUri }}
              className="absolute inset-0 h-full w-full"
              resizeMode="cover"
            />
            <View
              pointerEvents="none"
              className="absolute h-4 w-4 rounded-full border-2 border-kyar-surface bg-kyar-text/35 dark:border-kyar-dark-surface dark:bg-kyar-dark-text/35"
              style={{
                left: `${fx * 100}%`,
                top: `${fy * 100}%`,
                marginLeft: -8,
                marginTop: -8,
              }}
            />
          </Pressable>

          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={onClose}
              className="flex-1 items-center rounded-2xl border border-kyar-border py-3 active:opacity-80 dark:border-kyar-dark-border"
            >
              <Text className="font-semibold text-kyar-text dark:text-kyar-dark-text">
                {t("common.cancel")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onSave(fx, fy);
                setDraft(null);
                onClose();
              }}
              className="flex-1 items-center rounded-2xl bg-kyar-text py-3 active:opacity-90 dark:bg-kyar-dark-text"
            >
              <Text className="font-semibold text-kyar-bg dark:text-kyar-dark-bg">
                {t("common.save")}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
