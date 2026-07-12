import { ScrollView, Text, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { glass, ls } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { APP_HREF } from "@/lib/appRoutes";
import {
  GlassBar,
  GlassEmptyState,
  GlassOverlay,
  GlassPanel,
  GlassStatusChip,
  GlassTextField,
  PhotoBackdrop,
  PhotoPill,
} from "@/ui/glass";

function GallerySectionLabel({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: APP_FONT_FAMILIES.sansBold,
        fontSize: 10,
        letterSpacing: ls(0.2, 10),
        textTransform: "uppercase",
        color: glass.text.fg55,
        marginBottom: 10,
        marginTop: 28,
      }}
    >
      {children}
    </Text>
  );
}

function SurfaceCaption({ children }: { children: string }) {
  return (
    <Text
      style={{
        fontFamily: APP_FONT_FAMILIES.sansRegular,
        fontSize: 12,
        color: glass.text.fg70,
      }}
    >
      {children}
    </Text>
  );
}

/** KFM-025 — Glass Studio primitive previews for on-device QA (phase 7.0). */
export default function DevGalleryScreen() {
  const { t } = useTranslation();

  if (!__DEV__) {
    return <Redirect href={APP_HREF.settings} />;
  }

  return (
    <>
      <Stack.Screen options={{ title: t("settings.devGallery") }} />
      <View style={{ flex: 1 }}>
        <PhotoBackdrop scrim="off" kenBurns={false} />
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 48 }}
        >
          <Text
            style={{
              fontFamily: APP_FONT_FAMILIES.displayItalic,
              fontSize: 34,
              color: glass.text.fg,
            }}
          >
            {t("devGallery.title")}
          </Text>
          <SurfaceCaption>{t("devGallery.subtitle")}</SurfaceCaption>

          <GallerySectionLabel>{t("devGallery.surfaces")}</GallerySectionLabel>
          <GlassBar style={{ padding: 14 }}>
            <SurfaceCaption>{t("devGallery.surfaceBar")}</SurfaceCaption>
          </GlassBar>
          <GlassPanel style={{ padding: 14, marginTop: 12 }}>
            <SurfaceCaption>{t("devGallery.surfacePanel")}</SurfaceCaption>
          </GlassPanel>
          <GlassOverlay style={{ marginTop: 12 }}>
            <View style={{ padding: 14 }}>
              <SurfaceCaption>{t("devGallery.surfaceOverlay")}</SurfaceCaption>
            </View>
          </GlassOverlay>
          <GlassPanel blur={false} style={{ padding: 14, marginTop: 12 }}>
            <SurfaceCaption>{t("devGallery.surfaceFallback")}</SurfaceCaption>
          </GlassPanel>

          <GallerySectionLabel>{t("devGallery.buttons")}</GallerySectionLabel>
          <View style={{ gap: 12 }}>
            <PhotoPill variant="solid" icon="add" label={t("devGallery.buttonPrimary")} />
            <PhotoPill variant="outline" label={t("devGallery.buttonSecondary")} />
            <PhotoPill variant="text" label={t("devGallery.buttonTertiary")} />
            <PhotoPill variant="solid" size="sm" label={t("devGallery.buttonSmall")} />
            <PhotoPill variant="outline" disabled label={t("devGallery.buttonDisabled")} />
          </View>

          <GallerySectionLabel>{t("devGallery.chips")}</GallerySectionLabel>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <GlassStatusChip tone="success" label={t("devGallery.chipDone")} />
            <GlassStatusChip tone="active" label={t("devGallery.chipActive")} />
            <GlassStatusChip tone="warning" label={t("devGallery.chipWarn")} />
            <GlassStatusChip tone="neutral" label={t("devGallery.chipNeutral")} />
          </View>

          <GallerySectionLabel>{t("devGallery.field")}</GallerySectionLabel>
          <GlassPanel style={{ padding: 14, gap: 14 }}>
            <GlassTextField
              label={t("devGallery.fieldLabel")}
              placeholder={t("devGallery.fieldPlaceholder")}
            />
            <GlassTextField
              label={t("devGallery.fieldErrorLabel")}
              error={t("devGallery.fieldError")}
            />
          </GlassPanel>

          <GallerySectionLabel>{t("devGallery.emptyState")}</GallerySectionLabel>
          <GlassPanel>
            <GlassEmptyState
              icon="images-outline"
              message={t("devGallery.emptyMessage")}
              secondary={t("devGallery.emptySecondary")}
              action={<PhotoPill variant="outline" size="sm" label={t("devGallery.emptyCta")} />}
            />
          </GlassPanel>
        </ScrollView>
      </View>
    </>
  );
}
