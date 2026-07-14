import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, type Href, usePathname, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  NAV_SECTIONS_PRIMARY,
  NAV_SECTION_SETTINGS,
  type NavSection,
  type NavSectionId,
} from "@kyarafit/design-system";
import { borderWidth, glass, ls, motion } from "@kyarafit/design-system/rn";
import { api } from "convex/_generated/api";
import { signOut, useSession } from "@/lib/auth/client";
import { APP_HREF } from "@/lib/appRoutes";
import { getMobileNavActiveSection } from "@/lib/getMobileNavActiveSection";
import { NAV_SECTION_MATERIAL_ICON } from "@/lib/navIconsMobile";
import { ProfileAvatar } from "@/components/social/ProfileAvatar";
import { APP_FONT_FAMILIES } from "@/theme/fontFamilies";
import { DataBoundary } from "@/ui";
import { GlassOverlay, useReducedMotion } from "@/ui/glass";

const DRAWER_WIDTH = 300;
/** `--ease-out-strong` (motion.easing.standard). */
const EASE_OUT_STRONG = Easing.bezier(0.23, 1, 0.32, 1);

export function hrefForMenuSection(id: NavSectionId): Href {
  switch (id) {
    case "home":
      return APP_HREF.home;
    case "builds":
      return APP_HREF.builds;
    case "elements":
      return APP_HREF.elements;
    case "events":
      return APP_HREF.conventions;
    case "groups":
      return APP_HREF.groups;
    case "planner":
      return APP_HREF.planner;
    case "discover":
      return APP_HREF.discover;
    case "feed":
      return APP_HREF.feed;
    case "settings":
      return APP_HREF.settings;
    default:
      return APP_HREF.home;
  }
}

/**
 * v2 mobile menu (web `MobileNavMenu`, ref 13e): right-side glass drawer over
 * the dimmed screen — full `NAV_SECTIONS_PRIMARY`, divider, Settings, and the
 * profile footer.
 */
export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const active = getMobileNavActiveSection(pathname);
  const [signingOut, setSigningOut] = useState(false);
  const [mounted, setMounted] = useState(open);
  const translateX = useRef(new Animated.Value(DRAWER_WIDTH)).current;
  const dim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const duration = reducedMotion ? 0 : open ? motion.duration.baseMs : motion.duration.fastMs;
    if (open) setMounted(true);
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: open ? 0 : DRAWER_WIDTH,
        duration,
        easing: EASE_OUT_STRONG,
        useNativeDriver: true,
      }),
      Animated.timing(dim, { toValue: open ? 1 : 0, duration, useNativeDriver: true }),
    ]).start(() => {
      if (!open) setMounted(false);
    });
  }, [open, reducedMotion, translateX, dim]);

  const onSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
      onClose();
      router.replace(APP_HREF.signIn);
    } finally {
      setSigningOut(false);
    }
  }, [router, onClose]);

  if (!mounted) return null;

  return (
    <Modal transparent statusBarTranslucent visible onRequestClose={onClose}>
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: glass.scrimDim, opacity: dim }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t("common.closeMenu")}
        />
      </Animated.View>
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          right: 0,
          width: DRAWER_WIDTH,
          transform: [{ translateX }],
        }}
      >
        {/* Real blur (overlay weight) — the screen behind reads through the
            frost; iOS UIVisualEffectView blurs through the Modal layer. */}
        <GlassOverlay
          style={{ flex: 1, borderRadius: 0 }}
          surfaceStyle={{
            flex: 1,
            borderRadius: 0,
            borderWidth: 0,
            borderLeftWidth: borderWidth.hairline,
            borderColor: glass.border.overlay,
          }}
        >
          <View style={{ flex: 1, paddingTop: insets.top + 12 }}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, gap: 2 }}>
              {NAV_SECTIONS_PRIMARY.map((section) => (
                <DrawerNavRow
                  key={section.id}
                  section={section}
                  isActive={active === section.id}
                  onClose={onClose}
                />
              ))}
              <View
                style={{
                  marginVertical: 14,
                  marginHorizontal: 16,
                  height: borderWidth.hairline,
                  backgroundColor: glass.border.dividerStrong,
                }}
              />
              <DrawerNavRow
                section={NAV_SECTION_SETTINGS}
                isActive={active === "settings"}
                onClose={onClose}
              />
            </ScrollView>
            <View
              style={{
                borderTopWidth: borderWidth.hairline,
                borderTopColor: glass.border.dividerStrong,
                paddingHorizontal: 16,
                paddingTop: 12,
                paddingBottom: Math.max(insets.bottom, 12),
              }}
            >
              <DrawerProfileFooter onClose={onClose} />
              <Pressable
                style={{
                  minHeight: 44,
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 4,
                }}
                onPress={() => void onSignOut()}
                disabled={signingOut}
                accessibilityRole="button"
                accessibilityLabel={t("common.signOut")}
              >
                {signingOut ? (
                  <ActivityIndicator color={glass.text.fg} />
                ) : (
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                      fontSize: 11,
                      letterSpacing: ls(0.25, 11),
                      textTransform: "uppercase",
                      color: glass.text.fg55,
                    }}
                  >
                    {t("common.signOut")}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        </GlassOverlay>
      </Animated.View>
    </Modal>
  );
}

function DrawerNavRow({
  section,
  isActive,
  onClose,
}: {
  section: NavSection;
  isActive: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const iconName = (NAV_SECTION_MATERIAL_ICON[section.id] ??
    "circle") as keyof typeof MaterialIcons.glyphMap;
  const label = t(`nav.${section.id}`);

  return (
    <Link href={hrefForMenuSection(section.id)} asChild>
      <Pressable
        onPress={onClose}
        accessibilityRole="link"
        accessibilityState={isActive ? { selected: true } : undefined}
        className="active:opacity-80"
        style={{
          minHeight: 44,
          flexDirection: "row",
          alignItems: "center",
          gap: 16,
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: isActive ? glass.surface.bar : "transparent",
        }}
      >
        <MaterialIcons
          name={iconName}
          size={20}
          color={isActive ? glass.text.fg : glass.text.fg55}
        />
        <Text
          style={{
            fontFamily: isActive ? APP_FONT_FAMILIES.sansBold : APP_FONT_FAMILIES.sansSemiBold,
            fontSize: 11,
            letterSpacing: ls(0.22, 11),
            textTransform: "uppercase",
            color: isActive ? glass.text.fg : glass.text.fg70,
          }}
          numberOfLines={1}
        >
          {label}
        </Text>
      </Pressable>
    </Link>
  );
}

function DrawerProfileFooter({ onClose }: { onClose: () => void }) {
  const { session } = useSession();
  const user = session?.user as
    | {
        name?: string | null;
        email?: string | null;
        image?: string | null;
        username?: string | null;
      }
    | undefined;
  if (!user) return null;

  return <DrawerProfileFooterWithData user={user} onClose={onClose} />;
}

function DrawerProfileFooterWithData({
  user,
  onClose,
}: {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    username?: string | null;
  };
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const profile = useQuery(api.users.getByExternalId, userId ? { externalId: userId } : "skip");

  const waitingIdentity = identity === undefined;
  const waitingProfile = Boolean(userId) && profile === undefined;
  const status = waitingIdentity || waitingProfile ? "loading" : "ready";

  const displayName = user.name ?? user.email ?? "Account";

  return (
    <DataBoundary
      status={status}
      data={{ profile: profile ?? null, user }}
      loading={
        <View
          style={{
            minHeight: 44,
            flexDirection: "row",
            alignItems: "center",
            gap: 12,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <ActivityIndicator color={glass.text.fg} />
        </View>
      }
    >
      {({ profile: profileRow }) => {
        const username =
          user.username != null && user.username !== ""
            ? user.username
            : profileRow?.username != null && profileRow.username !== ""
              ? profileRow.username
              : null;
        const profileIsPublic = profileRow?.profileVisibility === "public";
        const profileImageStorageId = profileRow?.imageStorageId ?? undefined;
        const profileImageUrl =
          !profileImageStorageId && profileRow?.image
            ? profileRow.image
            : (user.image ?? undefined);

        return (
          <View style={{ gap: 4 }}>
            <Link href={APP_HREF.settingsAccount} asChild>
              <Pressable
                onPress={onClose}
                className="active:opacity-80"
                style={{
                  minHeight: 44,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 10,
                  backgroundColor: "transparent",
                }}
              >
                <ProfileAvatar
                  imageStorageId={profileImageStorageId}
                  imageUrl={profileImageUrl}
                  label={displayName}
                  size={36}
                />
                <View style={{ minWidth: 0, flex: 1 }}>
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansMedium,
                      fontSize: 14,
                      color: glass.text.fg,
                    }}
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  {username ? (
                    <Text
                      style={{
                        marginTop: 2,
                        fontFamily: APP_FONT_FAMILIES.sansRegular,
                        fontSize: 12,
                        color: glass.text.fg55,
                      }}
                      numberOfLines={1}
                    >
                      @{username}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </Link>
            {profileIsPublic && username ? (
              <Link href={APP_HREF.profile(username)} asChild>
                <Pressable
                  onPress={onClose}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    minHeight: 44,
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: APP_FONT_FAMILIES.sansSemiBold,
                      fontSize: 11,
                      letterSpacing: ls(0.22, 11),
                      textTransform: "uppercase",
                      color: glass.text.fg70,
                    }}
                  >
                    {t("settings.viewPublicProfile")}
                  </Text>
                </Pressable>
              </Link>
            ) : null}
          </View>
        );
      }}
    </DataBoundary>
  );
}
