import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { Link, type Href, usePathname, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import {
  NAV_SECTIONS_PRIMARY,
  NAV_SECTION_SETTINGS,
  type NavSection,
  type NavSectionId,
} from "@kyarafit/design-system";
import { api } from "convex/_generated/api";
import { signOut, useSession } from "@/lib/auth/client";
import { APP_HREF } from "@/lib/appRoutes";
import { getMobileNavActiveSection } from "@/lib/getMobileNavActiveSection";
import { NAV_SECTION_MATERIAL_ICON } from "@/lib/navIconsMobile";
import { ProfileAvatar } from "@/components/social/ProfileAvatar";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { DataBoundary } from "@/ui";

function hrefForMenuSection(id: NavSectionId): Href {
  switch (id) {
    case "home":
      return "/(app)/(tabs)" as Href;
    case "builds":
      return "/(app)/(tabs)/builds" as Href;
    case "elements":
      return "/(app)/(tabs)/elements" as Href;
    case "events":
      return APP_HREF.conventions;
    case "groups":
      return APP_HREF.groups;
    case "planner":
      return "/(app)/(tabs)/planner" as Href;
    case "discover":
      return APP_HREF.discover;
    case "feed":
      return APP_HREF.feed;
    case "settings":
      return APP_HREF.settings;
    default:
      return "/(app)/(tabs)" as Href;
  }
}

export default function MoreScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const { colors, spacing } = useDesignTheme();
  const active = getMobileNavActiveSection(pathname);
  const [signingOut, setSigningOut] = useState(false);

  const onSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/(auth)/sign-in");
    } finally {
      setSigningOut(false);
    }
  }, [router]);

  return (
    <ScrollView
      className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
      contentContainerStyle={{
        flexGrow: 1,
        paddingBottom: spacing[10],
        paddingHorizontal: 16,
        paddingTop: 24,
        gap: 8,
      }}
    >
      <View className="flex-1 gap-2">
        {NAV_SECTIONS_PRIMARY.map((section) => (
          <MenuNavRow
            key={section.id}
            section={section}
            href={hrefForMenuSection(section.id)}
            isActive={active === section.id}
            colors={colors}
          />
        ))}

        <View
          className="my-6 border-t border-kyar-borderSubtle dark:border-kyar-dark-borderSubtle"
          accessibilityRole="none"
        />

        <MenuNavRow
          section={NAV_SECTION_SETTINGS}
          href={hrefForMenuSection("settings")}
          isActive={active === "settings"}
          colors={colors}
        />

        <View className="mt-auto pt-8">
          <MenuProfileFooter />
          <Pressable
            className="mt-4 min-h-[44px] items-center justify-center rounded-sm py-2 active:opacity-80"
            onPress={() => void onSignOut()}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityLabel={t("common.signOut")}
          >
            {signingOut ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text className="text-[11px] font-semibold uppercase tracking-[0.25em] text-kyar-meta dark:text-kyar-dark-meta">
                {t("common.signOut")}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function MenuNavRow({
  section,
  href,
  isActive,
  colors,
}: {
  section: NavSection;
  href: Href;
  isActive: boolean;
  colors: { text: string; meta: string };
}) {
  const { t } = useTranslation();
  const iconName = (NAV_SECTION_MATERIAL_ICON[section.id] ??
    "circle") as keyof typeof MaterialIcons.glyphMap;
  const label = t(`nav.${section.id}`);

  const row = (
    <Pressable className="min-h-[44px] flex-row items-center gap-4 rounded-sm px-4 py-2 active:bg-kyar-muted dark:active:bg-kyar-dark-muted">
      <MaterialIcons
        name={iconName}
        size={20}
        color={isActive ? colors.text : colors.meta}
        style={{ opacity: isActive ? 1 : 0.85 }}
      />
      <View className="relative min-w-0 flex-1">
        <Text
          className={`text-[11px] uppercase tracking-[0.25em] ${
            isActive
              ? "font-bold text-kyar-text dark:text-kyar-dark-text"
              : "font-semibold text-kyar-meta dark:text-kyar-dark-meta"
          }`}
          numberOfLines={1}
        >
          {label}
        </Text>
        {isActive ? (
          <View className="absolute -bottom-1 left-0 h-[1.5px] w-full rounded-full bg-kyar-text dark:bg-kyar-dark-text" />
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <Link href={href} asChild>
      {row}
    </Link>
  );
}

function MenuProfileFooter() {
  const { session } = useSession();
  const { colors } = useDesignTheme();
  const user = session?.user as
    | { name?: string | null; email?: string | null; image?: string | null; username?: string | null }
    | undefined;
  if (!user) return null;

  return <MenuProfileFooterWithData user={user} colors={colors} />;
}

function MenuProfileFooterWithData({
  user,
  colors,
}: {
  user: { name?: string | null; email?: string | null; image?: string | null; username?: string | null };
  colors: { text: string };
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
        <View className="min-h-[44px] flex-row items-center gap-3 px-3 py-2">
          <ActivityIndicator color={colors.text} />
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
          <View className="gap-1">
            <Link href={APP_HREF.settingsAccount} asChild>
              <Pressable className="min-h-[44px] flex-row items-center gap-3 rounded-sm px-3 py-2 active:bg-kyar-muted dark:active:bg-kyar-dark-muted">
                <ProfileAvatar
                  imageStorageId={profileImageStorageId}
                  imageUrl={profileImageUrl}
                  label={displayName}
                  size={36}
                />
                <View className="min-w-0 flex-1">
                  <Text
                    className="text-sm font-medium text-kyar-text dark:text-kyar-dark-text"
                    numberOfLines={1}
                  >
                    {displayName}
                  </Text>
                  {username ? (
                    <Text
                      className="mt-0.5 text-xs text-kyar-textTertiary dark:text-kyar-dark-textTertiary"
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
                <Pressable className="px-3 py-2 active:opacity-80">
                  <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
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
