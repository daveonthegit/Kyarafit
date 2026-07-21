import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { useTranslation } from "react-i18next";
import { glass, ls, borderWidth } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { useOfflineMutation } from "@/offline";
import { parseIsoDateOnly } from "@/screens/conventions/utils";
import { GlassDateField } from "@/screens/conventions/GlassDateField";
import { GlassPanel, GlassTextField, PhotoBackdrop, PhotoPill } from "@/ui/glass";

type ConventionFormValues = {
  name: string;
  location?: string;
  startDate: string;
  endDate: string;
  imageStorageId?: Id<"_storage">;
  imageUrl?: string;
};

type Props = {
  title: string;
  eyebrow: string;
  subtitle: string;
  submitLabel: string;
  submittingLabel: string;
  initialValues?: Partial<ConventionFormValues>;
  onSubmit: (values: ConventionFormValues) => Promise<void>;
};

/** Convention create/edit form — glass form grammar (ref 13d). */
export function ConventionForm({
  title,
  eyebrow,
  subtitle,
  submitLabel,
  submittingLabel,
  initialValues,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const generateUploadUrl = useOfflineMutation(api.files.generateUploadUrl);
  const [name, setName] = useState(initialValues?.name ?? "");
  const [location, setLocation] = useState(initialValues?.location ?? "");
  const [startDate, setStartDate] = useState(initialValues?.startDate ?? "");
  const [endDate, setEndDate] = useState(initialValues?.endDate ?? "");
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | undefined>(
    initialValues?.imageStorageId
  );
  const [imageUrl, setImageUrl] = useState(initialValues?.imageUrl);
  const [busy, setBusy] = useState(false);

  const hasImage = Boolean(pickedUri || imageStorageId || imageUrl);

  const pickImage = useCallback(async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });

    if (result.canceled || !result.assets[0]) return;
    setPickedUri(result.assets[0].uri);
    setImageStorageId(undefined);
    setImageUrl(undefined);
  }, []);

  const removeImage = useCallback(() => {
    setPickedUri(null);
    setImageStorageId(undefined);
    setImageUrl(undefined);
  }, []);

  const disabled = useMemo(
    () => busy || !name.trim() || !startDate.trim() || !endDate.trim(),
    [busy, endDate, name, startDate]
  );

  const handleSubmit = useCallback(async () => {
    if (disabled) return;
    setBusy(true);
    try {
      let uploadedStorageId = imageStorageId;
      let uploadedImageUrl = imageUrl;
      if (pickedUri) {
        const uploadUrl = await generateUploadUrl();
        uploadedStorageId = await uploadUriToConvexStorage(pickedUri, uploadUrl);
        uploadedImageUrl = undefined;
      }

      await onSubmit({
        name: name.trim(),
        location: location.trim() || undefined,
        startDate: startDate.trim(),
        endDate: endDate.trim(),
        imageStorageId: uploadedStorageId,
        imageUrl: uploadedImageUrl,
      });
    } finally {
      setBusy(false);
    }
  }, [
    disabled,
    endDate,
    generateUploadUrl,
    imageStorageId,
    imageUrl,
    location,
    name,
    onSubmit,
    pickedUri,
    startDate,
  ]);

  return (
    <View style={{ flex: 1 }}>
      <PhotoBackdrop kenBurns={false} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 20,
          paddingBottom: insets.bottom + 48,
          gap: 18,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 6 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 10,
              letterSpacing: ls(0.24, 10),
              textTransform: "uppercase",
              color: glass.text.fg70,
              marginBottom: 8,
            }}
          >
            {eyebrow}
          </Text>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontSize: 34,
              lineHeight: 38,
              letterSpacing: ls(-0.02, 34),
              color: glass.text.fg,
            }}
          >
            {title}
          </Text>
          <Text
            style={{
              marginTop: 8,
              fontFamily: APP_FONT_FAMILIES.sansRegular,
              fontSize: 12,
              lineHeight: 18,
              color: glass.text.fg70,
            }}
          >
            {subtitle}
          </Text>
        </View>

        <GlassPanel style={{ padding: 16 }}>
          <View style={{ gap: 14 }}>
            <GlassTextField
              value={name}
              onChangeText={setName}
              label={t("conventions.fieldName")}
              placeholder={t("conventions.fieldNamePlaceholder")}
            />
            <GlassTextField
              value={location}
              onChangeText={setLocation}
              label={t("conventions.fieldLocation")}
              placeholder={t("conventions.fieldLocationPlaceholder")}
            />
            <View style={{ flexDirection: "row", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <GlassDateField
                  label={t("conventions.fieldStartDate")}
                  value={startDate}
                  placeholder={t("conventions.fieldDatePlaceholder")}
                  onChange={(iso) => {
                    setStartDate(iso);
                    setEndDate((prev) => (prev && prev < iso ? iso : prev));
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <GlassDateField
                  label={t("conventions.fieldEndDate")}
                  value={endDate}
                  placeholder={t("conventions.fieldDatePlaceholder")}
                  minimumDate={parseIsoDateOnly(startDate) ?? undefined}
                  onChange={(iso) => setEndDate(startDate && iso < startDate ? startDate : iso)}
                />
              </View>
            </View>
          </View>
        </GlassPanel>

        <GlassPanel style={{ padding: 16 }}>
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.sansBold,
              fontSize: 10,
              letterSpacing: ls(0.16, 10),
              textTransform: "uppercase",
              color: glass.text.fg70,
            }}
          >
            {t("conventions.fieldCover")}
          </Text>
          <Pressable
            onPress={() => void pickImage()}
            accessibilityRole="button"
            accessibilityLabel={t("conventions.chooseImageAction")}
            className="active:opacity-80"
            style={{
              marginTop: 12,
              overflow: "hidden",
              borderRadius: 12,
              // Dashed border = add affordance; once an image exists it is a
              // plain hairline frame.
              borderWidth: hasImage ? borderWidth.hairline : 1,
              borderStyle: hasImage ? "solid" : "dashed",
              borderColor: hasImage ? glass.border.default : glass.border.strong,
              backgroundColor: glass.surface.bar,
            }}
          >
            {pickedUri ? (
              <Image
                source={{ uri: pickedUri }}
                style={{ height: 200, width: "100%" }}
                resizeMode="cover"
              />
            ) : imageStorageId || imageUrl ? (
              <ConvexStorageImage
                storageId={imageStorageId}
                imageUrl={imageUrl}
                className="h-[200px] w-full"
                accessibilityLabel={name || title}
              />
            ) : (
              <View
                style={{
                  height: 200,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 24,
                }}
              >
                <Text
                  style={{
                    textAlign: "center",
                    fontFamily: APP_FONT_FAMILIES.sansRegular,
                    fontSize: 12,
                    lineHeight: 18,
                    color: glass.text.fg55,
                  }}
                >
                  {t("conventions.fieldCoverHint")}
                </Text>
              </View>
            )}
          </Pressable>

          <View style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <PhotoPill
              variant="outline"
              size="sm"
              icon="image-outline"
              label={t("conventions.chooseImageAction")}
              onPress={() => void pickImage()}
            />
            {hasImage ? (
              <PhotoPill
                variant="text"
                size="sm"
                label={t("conventions.removeImageAction")}
                onPress={removeImage}
              />
            ) : null}
          </View>
        </GlassPanel>

        {/* Footer: outline Cancel + the form's one solid primary. */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 10,
            paddingHorizontal: 6,
          }}
        >
          <PhotoPill
            variant="outline"
            label={t("common.cancel")}
            disabled={busy}
            onPress={() => router.back()}
          />
          <PhotoPill
            variant="solid"
            label={busy ? submittingLabel : submitLabel}
            disabled={disabled}
            onPress={() => void handleSubmit()}
          />
        </View>
      </ScrollView>
    </View>
  );
}
