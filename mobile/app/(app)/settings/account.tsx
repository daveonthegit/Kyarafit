import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { api } from "convex/_generated/api";
import {
  authClient,
  deleteAccount,
  getSession,
  setCredentialPassword,
  useSession,
} from "@/lib/auth/client";
import { startSocialLink } from "@/lib/auth/startSocialSignIn";
import { APP_HREF } from "@/lib/appRoutes";
import { uploadUriToConvexStorage } from "@/lib/uploadConvexStorage";
import { openWebAppPath } from "@/lib/openWebAppPath";
import { APP_FONT_FAMILIES } from "@/theme/appFonts";
import { useDesignTheme } from "@/theme/useDesignTheme";
import { ProfileAvatar } from "@/components/social/ProfileAvatar";
import { Button, DataBoundary, TextField } from "@/ui";

const SESSION_EMAIL_VISIBLE_KEY = "kyar_account_email_visible";

const LINKABLE_SOCIAL_PROVIDERS = [{ id: "google" as const }, { id: "apple" as const }];

type LinkedAccountRow = {
  id: string;
  providerId: string;
  accountId: string;
};

type AuthAccountExtensions = typeof authClient & {
  updateUser: (input: { name?: string; username?: string }) => Promise<{
    error?: { message?: string } | null;
  }>;
  isUsernameAvailable: (input: { username: string }) => Promise<{
    error?: { message?: string } | null;
    data?: { available?: boolean };
  }>;
  listAccounts: () => Promise<{
    error?: { message?: string } | null;
    data?: LinkedAccountRow[];
  }>;
  unlinkAccount: (input: { providerId: string; accountId: string }) => Promise<{
    error?: { message?: string } | null;
  }>;
};

const authX = authClient as AuthAccountExtensions;

function labelForProvider(t: TFunction, providerId: string): string {
  if (providerId === "credential") return t("settings.accountPage.providerCredential");
  if (providerId === "google") return t("settings.accountPage.providerGoogle");
  if (providerId === "apple") return t("settings.accountPage.providerApple");
  return providerId;
}

function oauthLinkErrorMessage(t: TFunction, error: string, description: string | null): string {
  const key = error.toLowerCase().replace(/\+/g, " ");
  switch (key) {
    case "email_doesn't_match":
    case "email_doesnt_match":
      return t("settings.accountPage.oauthErrorEmailMismatch");
    case "account_not_linked":
      return t("settings.accountPage.oauthErrorAccountNotLinked");
    case "unable_to_link_account":
      return t("settings.accountPage.oauthErrorUnableToLink");
    case "account_already_linked_to_different_user":
      return t("settings.accountPage.oauthErrorAlreadyLinked");
    default:
      if (description) return decodeURIComponent(description.replace(/\+/g, " "));
      return t("settings.accountPage.oauthErrorGeneric", { error });
  }
}

function AccountSection({ children }: { children: import("react").ReactNode }) {
  return (
    <View className="border-b border-kyar-borderSubtle py-4 dark:border-kyar-dark-borderSubtle">
      {children}
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Text className="mb-1 text-[11px] uppercase tracking-widest text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
      {children}
    </Text>
  );
}

function LinkText({
  children,
  onPress,
  disabled,
}: {
  children: import("react").ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      className="min-h-[44px] justify-center active:opacity-80"
    >
      <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
        {children}
      </Text>
    </Pressable>
  );
}

export default function SettingsAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string; error_description?: string }>();
  const { colors } = useDesignTheme();
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

  const sessionUser = session?.user as
    | {
        name?: string | null;
        email?: string | null;
        image?: string | null;
        username?: string | null;
      }
    | undefined;

  const [emailRevealed, setEmailRevealed] = useState(false);
  const [displayNameEdit, setDisplayNameEdit] = useState<string | null>(null);
  const [displayNameLoading, setDisplayNameLoading] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);
  const [usernameEdit, setUsernameEdit] = useState<string | null>(null);
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [bioEdit, setBioEdit] = useState<string | null>(null);
  const [bioLoading, setBioLoading] = useState(false);
  const [profileVisibilityEdit, setProfileVisibilityEdit] = useState<string | null>(null);
  const [profileVisibilityError, setProfileVisibilityError] = useState<string | null>(null);

  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountRow[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsActionError, setAccountsActionError] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [unlinkBusy, setUnlinkBusy] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSetupLoading, setPasswordSetupLoading] = useState(false);
  const [passwordSetupError, setPasswordSetupError] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [updatingPhoto, setUpdatingPhoto] = useState(false);

  const usernameEditTrimmed = (usernameEdit ?? "").trim().toLowerCase();
  const usernameCheck = useQuery(
    api.users.checkUsernameAvailability,
    usernameEdit !== null && usernameEditTrimmed.length >= 3
      ? { username: usernameEditTrimmed, currentExternalId: userId ?? undefined }
      : "skip"
  );

  const loadLinkedAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsActionError(null);
    try {
      const res = await authX.listAccounts();
      if (res.error) {
        setAccountsActionError(res.error.message ?? t("settings.accountPage.accountsLoadError"));
        setLinkedAccounts([]);
        return;
      }
      const rows = res.data;
      setLinkedAccounts(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setAccountsActionError(
        e instanceof Error ? e.message : t("settings.accountPage.accountsLoadError")
      );
      setLinkedAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void (async () => {
      try {
        const v = await AsyncStorage.getItem(SESSION_EMAIL_VISIBLE_KEY);
        if (v === "true") setEmailRevealed(true);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!userId) return;
    void loadLinkedAccounts();
  }, [userId, loadLinkedAccounts]);

  useFocusEffect(
    useCallback(() => {
      if (userId) void loadLinkedAccounts();
    }, [userId, loadLinkedAccounts])
  );

  useEffect(() => {
    const err = typeof params.error === "string" ? params.error : undefined;
    if (!err) return;
    const desc = typeof params.error_description === "string" ? params.error_description : null;
    setAccountsActionError(oauthLinkErrorMessage(t, err, desc));
    router.replace(APP_HREF.settingsAccount);
  }, [params.error, params.error_description, router, t]);

  const hasCredentialAccount = linkedAccounts.some((a) => a.providerId === "credential");
  const oauthAccountRows = linkedAccounts.filter((a) => a.providerId !== "credential");
  const canUnlinkOAuth =
    oauthAccountRows.length === 0 ? false : hasCredentialAccount || oauthAccountRows.length > 1;

  const displayLabel =
    profile?.displayName ??
    sessionUser?.name ??
    profile?.username ??
    sessionUser?.email ??
    t("settings.accountFallback");

  const usernameForDisplay =
    sessionUser?.username != null && sessionUser.username !== ""
      ? sessionUser.username
      : profile?.username != null && profile.username !== ""
        ? profile.username
        : null;

  const userEmail = sessionUser?.email ?? null;

  const handlePickProfileImage = async () => {
    if (updatingPhoto || !userId) return;
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

  const handleSaveDisplayName = async () => {
    const trimmed = (displayNameEdit ?? "").trim();
    setDisplayNameError(null);
    setDisplayNameLoading(true);
    try {
      const { error } = await authX.updateUser({ name: trimmed || undefined });
      if (error) {
        setDisplayNameError(error.message ?? t("settings.accountPage.displayNameUpdateError"));
      } else {
        await updateProfile({ displayName: trimmed || undefined });
        setDisplayNameEdit(null);
        await getSession();
      }
    } catch {
      setDisplayNameError(t("settings.accountPage.displayNameUpdateError"));
    } finally {
      setDisplayNameLoading(false);
    }
  };

  const handleSaveUsername = async () => {
    const raw = (usernameEdit ?? "").trim().toLowerCase();
    setUsernameError(null);

    const sessionUsername = (sessionUser?.username ?? "").trim().toLowerCase();
    if (raw.length === 0) {
      if (profile?.username || sessionUsername) {
        setUsernameError(t("settings.accountPage.usernameEmptyError"));
        return;
      }
      setUsernameEdit(null);
      return;
    }

    setUsernameLoading(true);
    try {
      if (raw !== sessionUsername) {
        const check = await authX.isUsernameAvailable({ username: raw });
        if (check.error) {
          setUsernameError(check.error.message ?? t("settings.accountPage.usernameVerifyError"));
          return;
        }
        const available = check.data?.available;
        if (available === false) {
          setUsernameError(t("settings.accountPage.usernameTakenShort"));
          return;
        }
      }

      const authRes = await authX.updateUser({ username: raw });
      if (authRes?.error) {
        setUsernameError(authRes.error.message ?? t("settings.accountPage.usernameUpdateError"));
        return;
      }

      await updateProfile({ username: raw });
      setUsernameEdit(null);
      await getSession();
    } catch (e) {
      setUsernameError(
        e instanceof Error ? e.message : t("settings.accountPage.usernameUpdateError")
      );
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleLinkSocial = async (provider: "google" | "apple") => {
    setAccountsActionError(null);
    setLinkBusy(provider);
    try {
      await startSocialLink(provider);
      await loadLinkedAccounts();
      await getSession();
    } catch (e) {
      setAccountsActionError(e instanceof Error ? e.message : t("settings.accountPage.linkError"));
    } finally {
      setLinkBusy(null);
    }
  };

  const handleUnlink = async (providerId: string, accountId: string, rowId: string) => {
    setAccountsActionError(null);
    setUnlinkBusy(rowId);
    try {
      const res = await authX.unlinkAccount({ providerId, accountId });
      if (res?.error) {
        setAccountsActionError(res.error.message ?? t("settings.accountPage.unlinkError"));
        return;
      }
      await loadLinkedAccounts();
      await getSession();
    } catch (e) {
      setAccountsActionError(
        e instanceof Error ? e.message : t("settings.accountPage.unlinkError")
      );
    } finally {
      setUnlinkBusy(null);
    }
  };

  const handleCreatePassword = async () => {
    setPasswordSetupError(null);
    if (newPassword.length < 8) {
      setPasswordSetupError(t("settings.accountPage.passwordMinError"));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordSetupError(t("settings.accountPage.passwordMismatch"));
      return;
    }
    setPasswordSetupLoading(true);
    try {
      const res = await setCredentialPassword({ newPassword });
      if (res?.error) {
        setPasswordSetupError(res.error.message ?? t("settings.accountSaveError"));
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      await loadLinkedAccounts();
      await getSession();
    } catch (e) {
      setPasswordSetupError(e instanceof Error ? e.message : t("settings.accountSaveError"));
    } finally {
      setPasswordSetupLoading(false);
    }
  };

  const handleSaveBio = async () => {
    const trimmed = (bioEdit ?? "").trim();
    setBioLoading(true);
    try {
      await updateProfile({ bio: trimmed || undefined });
      setBioEdit(null);
    } finally {
      setBioLoading(false);
    }
  };

  const handleSaveProfileVisibility = async (value: "private" | "public") => {
    setProfileVisibilityError(null);
    try {
      await updateProfile({ profileVisibility: value });
      setProfileVisibilityEdit(null);
    } catch (e) {
      setProfileVisibilityError(
        e instanceof Error ? e.message : t("settings.accountPage.visibilitySaveError")
      );
      setProfileVisibilityEdit(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      setDeleteError(t("settings.accountPage.typeDeleteError"));
      return;
    }
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const { error } = await deleteAccount();
      if (error) {
        setDeleteError(error.message ?? t("settings.accountDeleteError"));
      } else {
        router.replace(APP_HREF.signIn);
      }
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : t("settings.accountDeleteError"));
    } finally {
      setDeleteLoading(false);
    }
  };

  const usernameFieldError = useMemo(() => {
    if (usernameEdit === null) return undefined;
    if (usernameEditTrimmed.length === 0) return undefined;
    if (usernameEditTrimmed.length < 3) return t("auth.usernameMinLength");
    if (usernameCheck && !usernameCheck.valid)
      return usernameCheck.reason ?? t("settings.usernameInvalid");
    if (usernameCheck && !usernameCheck.available) return t("settings.usernameTaken");
    return undefined;
  }, [usernameEdit, usernameEditTrimmed, usernameCheck, t]);

  const inputUnderlineCls =
    "border-b border-kyar-borderSubtle bg-transparent px-0 py-3 text-sm text-kyar-text dark:border-kyar-dark-borderSubtle dark:text-kyar-dark-text";

  return (
    <>
      <Stack.Screen options={{ title: t("settings.accountDetails"), headerLargeTitle: false }} />
      <DataBoundary status={status} data={{ ready: true }}>
        {() => (
          <ScrollView
            className="flex-1 bg-kyar-bg dark:bg-kyar-dark-bg"
            contentContainerClassName="px-5 pb-12 pt-4"
          >
            <Text className="text-[10px] uppercase tracking-meta text-kyar-meta opacity-80 dark:text-kyar-dark-meta">
              {t("common.settings")}
            </Text>
            <Text
              style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
              className="mt-1 text-3xl italic text-kyar-text dark:text-kyar-dark-text"
            >
              {t("settings.accountDetails")}
            </Text>
            <Text className="mt-3 text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
              {t("settings.accountSubtitle")}
            </Text>

            <View className="mt-6">
              <AccountSection>
                <SectionLabel>{t("settings.accountPage.sectionProfilePicture")}</SectionLabel>
                <View className="mt-2 flex-row items-center gap-4">
                  <Pressable
                    onPress={() => void handlePickProfileImage()}
                    className="active:opacity-90"
                  >
                    <ProfileAvatar
                      imageStorageId={profile?.imageStorageId}
                      imageUrl={profile?.image ?? sessionUser?.image}
                      label={displayLabel}
                    />
                  </Pressable>
                  <View className="min-w-0 flex-1">
                    <LinkText
                      onPress={() => void handlePickProfileImage()}
                      disabled={updatingPhoto}
                    >
                      {updatingPhoto
                        ? t("settings.profileImageUploading")
                        : t("settings.accountPage.changePicture")}
                    </LinkText>
                    <Text className="mt-1 text-[11px] text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                      {t("settings.accountPage.imageFormats")}
                    </Text>
                  </View>
                </View>
              </AccountSection>

              <AccountSection>
                <View className="flex-row flex-wrap items-start justify-between gap-3">
                  <View className="min-w-0 flex-1">
                    <SectionLabel>{t("settings.accountPage.sectionEmail")}</SectionLabel>
                    <Text
                      className={`text-sm ${userEmail && !emailRevealed ? "text-kyar-textSecondary dark:text-kyar-dark-textSecondary" : "text-kyar-text dark:text-kyar-dark-text"}`}
                      selectable={!!userEmail && emailRevealed}
                    >
                      {!userEmail
                        ? t("settings.accountPage.dash")
                        : emailRevealed
                          ? userEmail
                          : t("settings.accountPage.emailHidden")}
                    </Text>
                    {userEmail ? (
                      <Text className="mt-1 text-[11px] leading-relaxed text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                        {t("settings.accountPage.emailHiddenHint")}
                      </Text>
                    ) : null}
                  </View>
                  {userEmail ? (
                    <Pressable
                      onPress={() => {
                        setEmailRevealed((prev) => {
                          const next = !prev;
                          void AsyncStorage.setItem(
                            SESSION_EMAIL_VISIBLE_KEY,
                            next ? "true" : "false"
                          );
                          return next;
                        });
                      }}
                      className="shrink-0 justify-center pt-1 active:opacity-80"
                    >
                      <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
                        {emailRevealed
                          ? t("settings.accountPage.hide")
                          : t("settings.accountPage.show")}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </AccountSection>

              <AccountSection>
                <SectionLabel>{t("settings.displayName")}</SectionLabel>
                {displayNameEdit === null ? (
                  <View className="mt-1 flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm text-kyar-text dark:text-kyar-dark-text">
                      {sessionUser?.name ?? t("settings.accountPage.dash")}
                    </Text>
                    <LinkText onPress={() => setDisplayNameEdit(sessionUser?.name ?? "")}>
                      {t("settings.accountPage.edit")}
                    </LinkText>
                  </View>
                ) : (
                  <View className="mt-2 gap-2">
                    <TextInput
                      value={displayNameEdit}
                      onChangeText={(v) => {
                        setDisplayNameEdit(v);
                        setDisplayNameError(null);
                      }}
                      placeholder={t("settings.accountPage.displayNamePlaceholder")}
                      placeholderTextColor={colors.textTertiary}
                      className={inputUnderlineCls}
                      editable={!displayNameLoading}
                      maxLength={500}
                    />
                    {displayNameError ? (
                      <Text className="text-xs text-kyar-danger dark:text-kyar-dark-danger">
                        {displayNameError}
                      </Text>
                    ) : null}
                    <View className="flex-row gap-4">
                      <LinkText
                        onPress={() => void handleSaveDisplayName()}
                        disabled={displayNameLoading}
                      >
                        {displayNameLoading ? t("settings.savingAction") : t("common.save")}
                      </LinkText>
                      <Pressable
                        onPress={() => {
                          setDisplayNameEdit(null);
                          setDisplayNameError(null);
                        }}
                        disabled={displayNameLoading}
                        className="min-h-[44px] justify-center active:opacity-80"
                      >
                        <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                          {t("common.cancel")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </AccountSection>

              <AccountSection>
                <SectionLabel>{t("settings.username")}</SectionLabel>
                {usernameEdit === null ? (
                  <View className="mt-1 flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm text-kyar-text dark:text-kyar-dark-text">
                      {usernameForDisplay
                        ? `@${usernameForDisplay}`
                        : t("settings.accountPage.dash")}
                    </Text>
                    <LinkText onPress={() => setUsernameEdit(profile?.username ?? "")}>
                      {t("settings.accountPage.edit")}
                    </LinkText>
                  </View>
                ) : (
                  <View className="mt-2 gap-2">
                    <TextInput
                      value={usernameEdit}
                      onChangeText={(v) => {
                        setUsernameEdit(v.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                        setUsernameError(null);
                      }}
                      placeholder={t("settings.accountPage.usernamePlaceholder")}
                      placeholderTextColor={colors.textTertiary}
                      className={inputUnderlineCls}
                      editable={!usernameLoading}
                      autoCapitalize="none"
                      maxLength={80}
                    />
                    <Text className="text-[11px] text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                      {t("settings.accountPage.usernameRules")}
                    </Text>
                    {usernameError ? (
                      <Text className="text-xs text-kyar-danger dark:text-kyar-dark-danger">
                        {usernameError}
                      </Text>
                    ) : null}
                    {usernameFieldError ? (
                      <Text className="text-xs text-kyar-danger dark:text-kyar-dark-danger">
                        {usernameFieldError}
                      </Text>
                    ) : null}
                    <View className="flex-row gap-4">
                      <LinkText
                        onPress={() => void handleSaveUsername()}
                        disabled={
                          usernameLoading ||
                          usernameEditTrimmed.length < 3 ||
                          Boolean(usernameFieldError)
                        }
                      >
                        {usernameLoading ? t("settings.savingAction") : t("common.save")}
                      </LinkText>
                      <Pressable
                        onPress={() => {
                          setUsernameEdit(null);
                          setUsernameError(null);
                        }}
                        disabled={usernameLoading}
                        className="min-h-[44px] justify-center active:opacity-80"
                      >
                        <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                          {t("common.cancel")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </AccountSection>

              <AccountSection>
                <SectionLabel>{t("settings.accountPage.signInMethodsTitle")}</SectionLabel>
                <Text className="mt-1 text-[11px] leading-relaxed text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {t("settings.accountPage.signInMethodsBody")}
                </Text>
                {accountsActionError ? (
                  <Text className="mt-2 text-xs text-kyar-danger dark:text-kyar-dark-danger">
                    {accountsActionError}
                  </Text>
                ) : null}
                {accountsLoading ? (
                  <View className="mt-3 flex-row items-center gap-2">
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                    <Text className="text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {t("settings.accountPage.signInMethodsLoading")}
                    </Text>
                  </View>
                ) : (
                  <View className="mt-3 gap-3">
                    {linkedAccounts.map((acc) => (
                      <View
                        key={acc.id}
                        className="flex-row flex-wrap items-center justify-between gap-2 rounded-xl border border-kyar-borderSubtle px-4 py-3 dark:border-kyar-dark-borderSubtle"
                      >
                        <View className="min-w-0 flex-1">
                          <Text className="text-sm font-medium text-kyar-text dark:text-kyar-dark-text">
                            {labelForProvider(t, acc.providerId)}
                          </Text>
                          <Text
                            className="mt-0.5 max-w-[240px] font-mono text-[11px] text-kyar-textTertiary dark:text-kyar-dark-textTertiary"
                            numberOfLines={1}
                          >
                            {acc.providerId === "credential"
                              ? t("settings.accountPage.passwordOnFile")
                              : t("settings.accountPage.connectedLine", { id: acc.accountId })}
                          </Text>
                        </View>
                        {acc.providerId !== "credential" ? (
                          <Pressable
                            onPress={() => void handleUnlink(acc.providerId, acc.accountId, acc.id)}
                            disabled={!canUnlinkOAuth || unlinkBusy === acc.id}
                            className="py-2 active:opacity-70"
                          >
                            <Text
                              className={`text-[11px] font-medium uppercase tracking-widest ${
                                !canUnlinkOAuth || unlinkBusy === acc.id
                                  ? "text-kyar-textTertiary dark:text-kyar-dark-textTertiary"
                                  : "text-kyar-textSecondary dark:text-kyar-dark-textSecondary"
                              }`}
                            >
                              {unlinkBusy === acc.id
                                ? t("settings.accountPage.disconnecting")
                                : t("settings.accountPage.disconnect")}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                    <View className="mt-2 gap-2">
                      <Text className="text-[11px] uppercase tracking-widest text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                        {t("settings.accountPage.connectAnother")}
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {LINKABLE_SOCIAL_PROVIDERS.map((p) => {
                          const linked = linkedAccounts.some((a) => a.providerId === p.id);
                          const busy = linkBusy === p.id;
                          return (
                            <Pressable
                              key={p.id}
                              onPress={() => void handleLinkSocial(p.id)}
                              disabled={linked || !!linkBusy}
                              className={`min-h-[40px] items-center justify-center rounded-full border border-kyar-borderSubtle px-4 py-2 dark:border-kyar-dark-borderSubtle ${
                                linked || linkBusy ? "opacity-40" : "active:opacity-80"
                              }`}
                            >
                              <Text className="text-[11px] font-bold uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                                {busy
                                  ? t("settings.accountPage.redirectingLink")
                                  : linked
                                    ? p.id === "google"
                                      ? t("settings.accountPage.linkedGoogle")
                                      : t("settings.accountPage.linkedApple")
                                    : p.id === "google"
                                      ? t("settings.accountPage.linkGoogle")
                                      : t("settings.accountPage.linkApple")}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                    {!hasCredentialAccount && oauthAccountRows.length > 0 ? (
                      <Text className="mt-2 text-[11px] text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                        {t("settings.accountPage.oauthOnlyDisconnectHint")}
                      </Text>
                    ) : null}
                  </View>
                )}
              </AccountSection>

              <AccountSection>
                <SectionLabel>{t("settings.accountPage.sectionBio")}</SectionLabel>
                {bioEdit === null ? (
                  <View className="mt-1 flex-row items-start gap-2">
                    <Text className="min-w-0 flex-1 whitespace-pre-wrap text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {profile?.bio?.trim() ? profile.bio : t("settings.accountPage.dash")}
                    </Text>
                    <LinkText onPress={() => setBioEdit(profile?.bio ?? "")}>
                      {t("settings.accountPage.edit")}
                    </LinkText>
                  </View>
                ) : (
                  <View className="mt-2 gap-2">
                    <TextInput
                      value={bioEdit}
                      onChangeText={setBioEdit}
                      placeholder={t("settings.bioPlaceholder")}
                      placeholderTextColor={colors.textTertiary}
                      className={`${inputUnderlineCls} min-h-[88px]`}
                      multiline
                      textAlignVertical="top"
                      editable={!bioLoading}
                      maxLength={500}
                    />
                    <View className="flex-row gap-4">
                      <LinkText onPress={() => void handleSaveBio()} disabled={bioLoading}>
                        {bioLoading ? t("settings.savingAction") : t("common.save")}
                      </LinkText>
                      <Pressable
                        onPress={() => setBioEdit(null)}
                        disabled={bioLoading}
                        className="min-h-[44px] justify-center active:opacity-80"
                      >
                        <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                          {t("common.cancel")}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                )}
              </AccountSection>

              <AccountSection>
                <SectionLabel>{t("settings.accountPage.sectionPublicProfile")}</SectionLabel>
                {profileVisibilityEdit === null ? (
                  <View className="mt-1 flex-row flex-wrap items-center gap-2">
                    <Text className="text-sm text-kyar-text dark:text-kyar-dark-text">
                      {profile?.profileVisibility === "public"
                        ? t("settings.profilePublic")
                        : t("settings.profilePrivate")}
                    </Text>
                    <LinkText
                      onPress={() =>
                        setProfileVisibilityEdit(profile?.profileVisibility ?? "private")
                      }
                    >
                      {t("settings.accountPage.change")}
                    </LinkText>
                    {profile?.profileVisibility === "public" && profile?.username ? (
                      <LinkText
                        onPress={() => {
                          const u = profile.username;
                          if (u) router.push(APP_HREF.profile(u));
                        }}
                      >
                        {t("settings.viewPublicProfile")}
                      </LinkText>
                    ) : null}
                  </View>
                ) : (
                  <View className="mt-2 flex-row flex-wrap gap-2">
                    <Pressable
                      onPress={() => void handleSaveProfileVisibility("public")}
                      className="rounded-full border border-kyar-borderSubtle px-5 py-2.5 dark:border-kyar-dark-borderSubtle active:opacity-80"
                    >
                      <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                        {t("settings.profilePublic")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void handleSaveProfileVisibility("private")}
                      className="rounded-full border border-kyar-borderSubtle px-5 py-2.5 dark:border-kyar-dark-borderSubtle active:opacity-80"
                    >
                      <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-text dark:text-kyar-dark-text">
                        {t("settings.profilePrivate")}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setProfileVisibilityEdit(null);
                        setProfileVisibilityError(null);
                      }}
                      className="min-h-[44px] justify-center px-2 active:opacity-80"
                    >
                      <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                        {t("common.cancel")}
                      </Text>
                    </Pressable>
                  </View>
                )}
                {profileVisibilityError ? (
                  <Text className="mt-2 text-xs text-kyar-danger dark:text-kyar-dark-danger">
                    {profileVisibilityError}
                  </Text>
                ) : null}
                <Text className="mt-2 text-[11px] text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                  {t("settings.accountPage.visibilityExplainer")}
                </Text>
              </AccountSection>

              <View className="border-b border-kyar-borderSubtle py-4 dark:border-kyar-dark-borderSubtle">
                <SectionLabel>{t("settings.accountPage.sectionEmailPassword")}</SectionLabel>
                {accountsLoading ? (
                  <Text className="mt-2 text-sm text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                    {t("settings.accountPage.emailPasswordLoading")}
                  </Text>
                ) : hasCredentialAccount ? (
                  <View className="mt-2">
                    <LinkText onPress={() => router.push(APP_HREF.resetPassword)}>
                      {t("settings.accountPage.changePassword")}
                    </LinkText>
                    <Text className="mt-1 text-[11px] text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {t("settings.accountPage.changePasswordHint")}
                    </Text>
                  </View>
                ) : (
                  <View className="mt-2 gap-3">
                    <Text className="text-[11px] leading-relaxed text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                      {t("settings.accountPage.oauthOnlyPasswordIntro")}
                    </Text>
                    <TextField
                      secureTextEntry
                      value={newPassword}
                      onChangeText={(v) => {
                        setNewPassword(v);
                        setPasswordSetupError(null);
                      }}
                      placeholder={t("settings.accountPage.newPasswordPlaceholder")}
                      editable={!passwordSetupLoading}
                    />
                    <TextField
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={(v) => {
                        setConfirmPassword(v);
                        setPasswordSetupError(null);
                      }}
                      placeholder={t("settings.accountPage.confirmPasswordPlaceholder")}
                      editable={!passwordSetupLoading}
                    />
                    {passwordSetupError ? (
                      <Text className="text-xs text-kyar-danger dark:text-kyar-dark-danger">
                        {passwordSetupError}
                      </Text>
                    ) : null}
                    <LinkText
                      onPress={() => void handleCreatePassword()}
                      disabled={passwordSetupLoading}
                    >
                      {passwordSetupLoading
                        ? t("settings.savingAction")
                        : t("settings.accountPage.savePassword")}
                    </LinkText>
                    <View className="mt-1 flex-row flex-wrap items-center gap-x-1">
                      <Text className="text-[11px] text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                        {t("settings.accountPage.forgotPasswordPart1")}
                      </Text>
                      <Pressable onPress={() => router.push(APP_HREF.resetPassword)}>
                        <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
                          {t("settings.accountPage.forgotPasswordLink")}
                        </Text>
                      </Pressable>
                      <Text className="text-[11px] text-kyar-textTertiary dark:text-kyar-dark-textTertiary">
                        {t("settings.accountPage.forgotPasswordPart2", {
                          email: userEmail ?? t("settings.accountPage.yourEmailFallback"),
                        })}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View className="border-t border-kyar-borderSubtle pt-4 dark:border-kyar-dark-borderSubtle">
                <SectionLabel>{t("settings.accountPage.sectionDataPrivacy")}</SectionLabel>
                <Text className="mt-2 text-[11px] leading-5 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("settings.accountPage.dataPrivacyBody")}
                </Text>
                <View className="mt-3 flex-row flex-wrap gap-4">
                  <Pressable
                    onPress={() => void openWebAppPath("/terms", t)}
                    className="active:opacity-80"
                  >
                    <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
                      {t("settings.accountPage.termsOfService")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void openWebAppPath("/privacy", t)}
                    className="active:opacity-80"
                  >
                    <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
                      {t("settings.accountPage.privacyPolicy")}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      void Linking.openURL(
                        "mailto:kyarafit@kyarafit.com?subject=Kyarafit%20privacy%20request"
                      )
                    }
                    className="active:opacity-80"
                  >
                    <Text className="text-[11px] font-medium uppercase tracking-widest text-kyar-accent">
                      {t("settings.accountPage.securitySupport")}
                    </Text>
                  </Pressable>
                </View>
                <Text className="mt-3 text-[11px] leading-5 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                  {t("settings.accountPage.deleteExplainer")}
                </Text>
                {!showDeleteConfirm ? (
                  <Pressable
                    onPress={() => {
                      setShowDeleteConfirm(true);
                      setDeleteError(null);
                    }}
                    className="mt-4 self-start rounded-full border border-kyar-danger/25 px-5 py-2.5 active:opacity-90 dark:border-kyar-dark-danger/40"
                  >
                    <Text className="text-[10px] font-bold uppercase tracking-widest text-kyar-danger dark:text-kyar-dark-danger">
                      {t("settings.accountPage.deleteAction")}
                    </Text>
                  </Pressable>
                ) : (
                  <View className="mt-5 overflow-hidden rounded-2xl border border-kyar-danger/20 bg-kyar-surface dark:border-kyar-dark-danger/30 dark:bg-kyar-dark-surface">
                    <View className="border-b border-kyar-danger/15 bg-kyar-danger/6 px-4 py-3 dark:border-kyar-dark-danger/20 dark:bg-kyar-dark-danger/10">
                      <Text className="text-[11px] uppercase tracking-[0.2em] text-kyar-danger/80 dark:text-kyar-dark-danger">
                        {t("settings.accountPage.deletePermanentLabel")}
                      </Text>
                      <Text
                        style={{ fontFamily: APP_FONT_FAMILIES.displayItalic }}
                        className="mt-1 text-2xl italic text-kyar-text dark:text-kyar-dark-text"
                      >
                        {t("settings.accountPage.deleteConfirmTitle")}
                      </Text>
                    </View>
                    <View className="gap-4 px-4 py-4">
                      <Text className="text-sm leading-6 text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                        {t("settings.accountPage.deleteConfirmBody")}
                      </Text>
                      <Text className="text-[11px] uppercase tracking-widest text-kyar-textSecondary dark:text-kyar-dark-textSecondary">
                        {t("settings.accountPage.typeDeleteLabel")}
                      </Text>
                      <TextInput
                        value={deleteConfirmation}
                        onChangeText={(v) => {
                          setDeleteConfirmation(v);
                          setDeleteError(null);
                        }}
                        placeholder={t("settings.accountPage.typeDeletePlaceholder")}
                        placeholderTextColor={colors.textTertiary}
                        className="rounded-xl border border-kyar-danger/20 bg-kyar-bg px-4 py-3 text-sm text-kyar-text dark:border-kyar-dark-danger/30 dark:bg-kyar-dark-bg dark:text-kyar-dark-text"
                        editable={!deleteLoading}
                        autoCapitalize="characters"
                      />
                      {deleteError ? (
                        <Text className="text-xs text-kyar-danger dark:text-kyar-dark-danger">
                          {deleteError}
                        </Text>
                      ) : null}
                      <View className="flex-row flex-wrap gap-3">
                        <Button
                          title={
                            deleteLoading
                              ? t("settings.accountDeleting")
                              : t("settings.accountPage.confirmDelete")
                          }
                          onPress={() => void handleDeleteAccount()}
                          loading={deleteLoading}
                          disabled={deleteLoading}
                        />
                        <Button
                          title={t("common.cancel")}
                          variant="secondary"
                          onPress={() => {
                            setShowDeleteConfirm(false);
                            setDeleteConfirmation("");
                            setDeleteError(null);
                          }}
                          disabled={deleteLoading}
                        />
                      </View>
                    </View>
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        )}
      </DataBoundary>
    </>
  );
}
