import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import { api } from "convex/_generated/api";
import { deleteAccount, authClient, useSession } from "@/lib/auth/client";
import { APP_HREF } from "@/lib/appRoutes";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { ProfileAvatar } from "@/components/social/ProfileAvatar";
import { Button, DataBoundary, MetaLabel, SectionHeading, SurfaceCard, TextField } from "@/ui";

type BetterAuthClientWithUpdate = typeof authClient & {
  updateUser: (input: { name?: string; username?: string }) => Promise<{
    error?: { message?: string } | null;
  }>;
};

export default function SettingsAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { session } = useSession();
  const identity = useQuery(api.auth.getCurrentUser);
  const userId = identity?.subject;
  const profile = useQuery(api.users.getByExternalId, userId ? { externalId: userId } : "skip");
  const updateProfile = useMutation(api.users.updateProfile);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const updateProfileImage = useMutation(api.users.updateProfileImage);
  const status =
    identity === undefined || (userId && profile === undefined) || session === undefined
      ? "loading"
      : "ready";

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [hasHydratedForm, setHasHydratedForm] = useState(false);
  const usernameCheck = useQuery(api.users.checkUsernameAvailability, {
    username,
    currentExternalId: userId ?? undefined,
  });

  const hydratedValues = useMemo(() => {
    const sessionUser = session?.user;
    const nextDisplayName = profile?.displayName ?? sessionUser?.name ?? "";
    const nextUsername = profile?.username ?? "";
    const nextBio = profile?.bio ?? "";
    const nextVisibility: "private" | "public" =
      profile?.profileVisibility === "public" ? "public" : "private";
    return {
      nextDisplayName,
      nextUsername,
      nextBio,
      nextVisibility,
      ready: Boolean(sessionUser),
    };
  }, [
    profile?.bio,
    profile?.displayName,
    profile?.profileVisibility,
    profile?.username,
    session?.user,
  ]);

  useEffect(() => {
    if (hasHydratedForm || !session?.user) return;
    setDisplayName(hydratedValues.nextDisplayName);
    setUsername(hydratedValues.nextUsername);
    setBio(hydratedValues.nextBio);
    setVisibility(hydratedValues.nextVisibility);
    setHasHydratedForm(true);
  }, [
    hasHydratedForm,
    hydratedValues.nextBio,
    hydratedValues.nextDisplayName,
    hydratedValues.nextUsername,
    hydratedValues.nextVisibility,
    session?.user,
  ]);

  const displayLabel =
    profile?.displayName ??
    session?.user?.name ??
    profile?.username ??
    session?.user?.email ??
    t("settings.accountFallback");
  const publicUsername = profile?.username ?? "";
  const normalizedUsername = username.trim().toLowerCase();
  const usernameError =
    normalizedUsername.length === 0
      ? undefined
      : normalizedUsername.length < 3
        ? t("auth.usernameMinLength")
        : usernameCheck && !usernameCheck.valid
          ? (usernameCheck.reason ?? t("settings.usernameInvalid"))
          : usernameCheck && !usernameCheck.available
            ? t("settings.usernameTaken")
            : undefined;
  const usernameStatusText =
    normalizedUsername.length === 0
      ? t("settings.usernameHelper")
      : usernameError
        ? usernameError
        : usernameCheck?.available
          ? usernameCheck.reason === "current_user"
            ? t("settings.usernameCurrent")
            : t("settings.usernameAvailable")
          : t("settings.usernameChecking");
  const canSave = !saving && !updatingPhoto && normalizedUsername.length >= 3 && !usernameError;

  const handlePickProfileImage = async () => {
    if (updatingPhoto) return;
    setUpdatingPhoto(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(t("common.errorTitle"), t("settings.profileImagePermission"));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const uploadUrl = await generateUploadUrl();
      const storageId = await uploadUriToConvexStorage(
        asset.uri,
        uploadUrl,
        asset.mimeType ?? "image/jpeg"
      );
      await updateProfileImage({ storageId });
      Alert.alert(t("settings.profileImageSavedTitle"), t("settings.profileImageSavedBody"));
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setUpdatingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!userId || !canSave) return;
    setSaving(true);
    try {
      const authResult = await (authClient as BetterAuthClientWithUpdate).updateUser({
        name: displayName.trim() || undefined,
        username: username.trim().toLowerCase() || undefined,
      });
      if (authResult?.error) {
        throw new Error(authResult.error.message ?? t("settings.accountSaveError"));
      }

      await updateProfile({
        displayName: displayName.trim() || undefined,
        username: username.trim().toLowerCase() || undefined,
        bio: bio.trim() || undefined,
        profileVisibility: visibility,
      });
      Alert.alert(t("settings.accountSavedTitle"), t("settings.accountSavedBody"));
    } catch (error) {
      Alert.alert(t("common.errorTitle"), String(error instanceof Error ? error.message : error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    Alert.alert(t("settings.accountDeleteTitle"), t("settings.accountDeleteBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("settings.accountDeleteAction"),
        style: "destructive",
        onPress: () => {
          void (async () => {
            setDeleting(true);
            try {
              const result = await deleteAccount();
              if (result?.error) {
                throw new Error(result.error.message ?? t("settings.accountDeleteError"));
              }
              router.replace("/(auth)/sign-in");
            } catch (error) {
              Alert.alert(
                t("common.errorTitle"),
                String(error instanceof Error ? error.message : error)
              );
            } finally {
              setDeleting(false);
            }
          })();
        },
      },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ title: t("settings.accountDetails"), headerLargeTitle: false }} />
      <DataBoundary status={status} data={{ ready: true }}>
        {() => (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerClassName="px-5 pb-12 pt-4"
          >
            <SectionHeading eyebrow={t("common.settings")} title={t("settings.accountDetails")} />
            <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("settings.accountSubtitle")}
            </Text>

            <SurfaceCard className="mt-5 px-4 py-4">
              <MetaLabel>{t("settings.profileIdentity")}</MetaLabel>
              <View className="mt-4 flex-row items-center gap-4">
                <Pressable
                  onPress={() => void handlePickProfileImage()}
                  className="active:opacity-90"
                >
                  <ProfileAvatar
                    imageStorageId={profile?.imageStorageId}
                    imageUrl={profile?.image ?? session?.user?.image}
                    label={displayLabel}
                  />
                </Pressable>
                <View className="min-w-0 flex-1">
                  <Text
                    style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
                    className="text-[28px] italic text-kyar-text dark:text-kyar-dark-text"
                    numberOfLines={2}
                  >
                    {displayLabel}
                  </Text>
                  {profile?.username ? (
                    <Text className="mt-1 text-xs uppercase tracking-wide text-kyar-meta dark:text-kyar-dark-meta">
                      @{profile.username}
                    </Text>
                  ) : null}
                  <Pressable onPress={() => void handlePickProfileImage()}>
                    <Text className="mt-3 text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
                      {updatingPhoto
                        ? t("settings.profileImageUploading")
                        : t("settings.profileImageAction")}
                    </Text>
                  </Pressable>
                  {profile?.profileVisibility === "public" && publicUsername ? (
                    <Pressable onPress={() => router.push(APP_HREF.profile(publicUsername))}>
                      <Text className="mt-3 text-sm font-semibold text-kyar-text dark:text-kyar-dark-text">
                        {t("settings.viewPublicProfile")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </SurfaceCard>

            <SurfaceCard className="mt-4 gap-4 px-4 py-4">
              <TextField
                label={t("settings.displayName")}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={t("auth.namePlaceholder")}
              />
              <TextField
                label={t("settings.username")}
                value={username}
                onChangeText={(value) =>
                  setUsername(value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                }
                placeholder={t("auth.usernamePlaceholder")}
                autoCapitalize="none"
                error={usernameError}
              />
              <Text className="mt-1 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {usernameStatusText}
              </Text>
              <TextField
                label={t("settings.bio")}
                value={bio}
                onChangeText={setBio}
                placeholder={t("settings.bioPlaceholder")}
                multiline
                className="min-h-[112px]"
              />

              <View>
                <Text className="mb-3 text-sm font-medium text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("settings.publicProfile")}
                </Text>
                <View className="flex-row gap-2">
                  {(
                    [
                      ["private", t("settings.profilePrivate")],
                      ["public", t("settings.profilePublic")],
                    ] as const
                  ).map(([value, label]) => (
                    <Pressable
                      key={value}
                      onPress={() => setVisibility(value)}
                      className={`rounded-full border px-4 py-3 ${
                        visibility === value
                          ? "border-kyar-text bg-kyar-text dark:border-kyar-dark-text dark:bg-kyar-dark-text"
                          : "border-kyar-borderSubtle bg-kyar-surface dark:border-kyar-dark-borderSubtle dark:bg-kyar-dark-surface"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold uppercase tracking-wide ${
                          visibility === value
                            ? "text-kyar-bg dark:text-kyar-dark-bg"
                            : "text-kyar-text dark:text-kyar-dark-text"
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Button
                title={saving ? t("settings.savingAction") : t("settings.saveAction")}
                onPress={() => void handleSave()}
                loading={saving}
                disabled={!canSave}
              />
            </SurfaceCard>

            <SurfaceCard className="mt-4 px-4 py-4">
              <MetaLabel>{t("settings.dataPrivacy")}</MetaLabel>
              <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                {t("settings.accountPrivacyBody")}
              </Text>
              <Button
                title={deleting ? t("settings.accountDeleting") : t("settings.accountDeleteAction")}
                variant="secondary"
                onPress={() => void handleDelete()}
                className="mt-4"
                disabled={deleting}
              />
            </SurfaceCard>
          </ScrollView>
        )}
      </DataBoundary>
    </>
  );
}
