import { useCallback, useMemo, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useMutation } from "convex/react";
import type { Id } from "convex/_generated/dataModel";
import { api } from "convex/_generated/api";
import { useTranslation } from "react-i18next";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { Button, MetaLabel, SectionHeading, SurfaceCard, TextField } from "@/ui";

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
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
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
    <ScrollView
      className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 20 }}
      keyboardShouldPersistTaps="handled"
    >
      <View>
        <SectionHeading eyebrow={eyebrow} title={title} />
        <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
          {subtitle}
        </Text>
      </View>

      <SurfaceCard className="px-4 py-4">
        <View className="gap-4">
          <TextField
            value={name}
            onChangeText={setName}
            label={t("conventions.fieldName")}
            placeholder={t("conventions.fieldNamePlaceholder")}
          />
          <TextField
            value={location}
            onChangeText={setLocation}
            label={t("conventions.fieldLocation")}
            placeholder={t("conventions.fieldLocationPlaceholder")}
          />
          <View className="flex-row gap-3">
            <View className="flex-1">
              <TextField
                value={startDate}
                onChangeText={setStartDate}
                label={t("conventions.fieldStartDate")}
                placeholder={t("conventions.fieldDatePlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
            <View className="flex-1">
              <TextField
                value={endDate}
                onChangeText={setEndDate}
                label={t("conventions.fieldEndDate")}
                placeholder={t("conventions.fieldDatePlaceholder")}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard className="px-4 py-4">
        <MetaLabel>{t("conventions.fieldCover")}</MetaLabel>
        <Pressable
          onPress={() => void pickImage()}
          className="mt-4 overflow-hidden rounded-[28px] border border-dashed border-kyar-borderSubtle bg-kyar-panel dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-panel"
        >
          {pickedUri ? (
            <Image source={{ uri: pickedUri }} className="h-56 w-full" resizeMode="cover" />
          ) : imageStorageId || imageUrl ? (
            <ConvexStorageImage
              storageId={imageStorageId}
              imageUrl={imageUrl}
              className="h-56 w-full"
              accessibilityLabel={name || title}
            />
          ) : (
            <View className="h-56 items-center justify-center px-6">
              <Text className="text-center text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("conventions.fieldCoverHint")}
              </Text>
            </View>
          )}
        </Pressable>

        <View className="mt-4 flex-row gap-3">
          <Button
            title={t("conventions.chooseImageAction")}
            variant="secondary"
            onPress={() => void pickImage()}
            className="flex-1"
          />
          {hasImage ? (
            <Button
              title={t("conventions.removeImageAction")}
              variant="secondary"
              onPress={removeImage}
              className="flex-1"
            />
          ) : null}
        </View>
      </SurfaceCard>

      <Button
        title={busy ? submittingLabel : submitLabel}
        onPress={() => void handleSubmit()}
        disabled={disabled}
      />
    </ScrollView>
  );
}
