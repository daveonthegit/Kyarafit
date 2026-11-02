import { Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { borderWidth, glass, ls } from "@kyarafit/design-system/rn";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { useOnlineStatus } from "@/lib/useOnlineStatus";

type Props = {
  /** Optional retry handler (e.g. refetch the surface). The banner always offers a re-check action. */
  onRetry?: () => void;
  /** Merged onto the strip root — margins only apply while the banner is visible. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Non-blocking banner for online-only surfaces (social, groups, billing — REQ-082/101).
 *
 * These surfaces are intentionally never available offline, so when the device is disconnected we
 * surface a clear, non-blocking notice plus a retry affordance instead of failing silently. It
 * renders nothing while online, so callers can mount it unconditionally at the top of the surface.
 *
 * Glass Studio 7.4: compact glass strip (icon + text + underline retry) — the mobile equivalent of
 * web `OnlineOnlyBanner surface="glass"`. Opaque bar fallback keeps it legible over any photo.
 */
export function OfflineBanner({ onRetry, style }: Props) {
  const { t } = useTranslation();
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <View
      accessibilityRole="alert"
      accessibilityLabel={t("offline.onlineOnlyBanner", {
        defaultValue: "You're offline — this section needs a connection.",
      })}
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderRadius: 10,
          borderWidth: borderWidth.hairline,
          borderColor: glass.border.default,
          backgroundColor: glass.fallback.bar,
          paddingHorizontal: 14,
          paddingVertical: 6,
        },
        style,
      ]}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={glass.text.fg55} />
      <Text
        numberOfLines={2}
        style={{
          minWidth: 0,
          flex: 1,
          fontFamily: APP_FONT_FAMILIES.sansMedium,
          fontSize: 12,
          lineHeight: 17,
          color: glass.text.fg70,
        }}
      >
        {t("offline.onlineOnlyBanner", {
          defaultValue: "You're offline — this section needs a connection.",
        })}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        className="active:opacity-80"
        style={{ minHeight: 44, justifyContent: "center" }}
      >
        <Text
          style={{
            fontFamily: APP_FONT_FAMILIES.sansBold,
            fontSize: 9,
            letterSpacing: ls(0.16, 9),
            textTransform: "uppercase",
            color: glass.text.fg,
            borderBottomWidth: 1,
            borderBottomColor: glass.border.strong,
            paddingBottom: 2,
          }}
        >
          {t("offline.retry", { defaultValue: "Retry" })}
        </Text>
      </Pressable>
    </View>
  );
}
