import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { api } from "convex/_generated/api";
import { glass } from "@kyarafit/design-system/rn";
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
import { ConvexStorageImage } from "@/components/ConvexStorageImage";
import { DataBoundary } from "@/ui";
import { GlassOverlay, GlassPanel, GlassTextField, PhotoPill } from "@/ui/glass";
import {
  AccountAction,
  AccountFrame,
  AccountHeading,
  AccountLoading,
  AccountScroll,
  AccountSection,
  AccountText,
  SectionLabel,
  accountStyles as styles,
} from "@/screens/settings/accountGlass";

const SESSION_EMAIL_VISIBLE_KEY = "kyar_account_email_visible";
const LINKABLE_SOCIAL_PROVIDERS = [{ id: "google" as const }, { id: "apple" as const }];

type LinkedAccountRow = { id: string; providerId: string; accountId: string };
type AuthAccountExtensions = typeof authClient & {
  updateUser: (input: {
    name?: string;
    username?: string;
  }) => Promise<{ error?: { message?: string } | null }>;
  isUsernameAvailable: (input: {
    username: string;
  }) => Promise<{ error?: { message?: string } | null; data?: { available?: boolean } }>;
  listAccounts: () => Promise<{ error?: { message?: string } | null; data?: LinkedAccountRow[] }>;
  unlinkAccount: (input: {
    providerId: string;
    accountId: string;
  }) => Promise<{ error?: { message?: string } | null }>;
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

export default function SettingsAccountScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ error?: string; error_description?: string }>();
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
      if (error)
        setDisplayNameError(error.message ?? t("settings.accountPage.displayNameUpdateError"));
      else {
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
      if (error) setDeleteError(error.message ?? t("settings.accountDeleteError"));
      else router.replace(APP_HREF.signIn);
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

  const avatarImage = profile?.image ?? sessionUser?.image;
  const hasAvatar = !!(profile?.imageStorageId || avatarImage);
  const initials = displayLabel
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <AccountFrame>
      <Stack.Screen options={{ title: t("settings.accountDetails"), headerLargeTitle: false }} />
      <DataBoundary
        status={status}
        data={{ ready: true }}
        loading={<AccountLoading label={t("common.loading")} />}
      >
        {() => (
          <AccountScroll>
            <AccountHeading
              title={t("settings.accountDetails")}
              subtitle={t("settings.accountSubtitle")}
            />
            <GlassPanel blur={false} style={{ paddingHorizontal: 18 }}>
              <AccountSection>
                <SectionLabel>{t("settings.accountPage.sectionProfilePicture")}</SectionLabel>
                <View style={styles.row}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("settings.accountPage.changePicture")}
                    accessibilityState={{ disabled: updatingPhoto, busy: updatingPhoto }}
                    disabled={updatingPhoto}
                    onPress={() => void handlePickProfileImage()}
                    className="active:opacity-80"
                    style={{
                      width: 88,
                      height: 88,
                      borderRadius: 44,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderStyle: hasAvatar ? "solid" : "dashed",
                      borderColor: glass.border.strong,
                      backgroundColor: glass.surface.field,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {hasAvatar ? (
                      <ConvexStorageImage
                        storageId={profile?.imageStorageId}
                        imageUrl={avatarImage}
                        className="h-full w-full"
                      />
                    ) : (
                      <AccountText style={{ color: glass.text.fg, fontSize: 22 }}>
                        {initials || "?"}
                      </AccountText>
                    )}
                  </Pressable>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <AccountAction
                      onPress={() => void handlePickProfileImage()}
                      disabled={updatingPhoto}
                    >
                      {updatingPhoto
                        ? t("settings.profileImageUploading")
                        : t("settings.accountPage.changePicture")}
                    </AccountAction>
                    <AccountText>{t("settings.accountPage.imageFormats")}</AccountText>
                  </View>
                </View>
              </AccountSection>
              <AccountSection>
                <SectionLabel>{t("settings.accountPage.sectionEmail")}</SectionLabel>
                <AccountText selectable={!!userEmail && emailRevealed}>
                  {!userEmail
                    ? t("settings.accountPage.dash")
                    : emailRevealed
                      ? userEmail
                      : t("settings.accountPage.emailHidden")}
                </AccountText>
                {userEmail ? (
                  <>
                    <AccountText>{t("settings.accountPage.emailHiddenHint")}</AccountText>
                    <AccountAction
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
                    >
                      {emailRevealed
                        ? t("settings.accountPage.hide")
                        : t("settings.accountPage.show")}
                    </AccountAction>
                  </>
                ) : null}
              </AccountSection>
              <AccountSection>
                <SectionLabel>{t("settings.displayName")}</SectionLabel>
                {displayNameEdit === null ? (
                  <>
                    <AccountText>{sessionUser?.name ?? t("settings.accountPage.dash")}</AccountText>
                    <AccountAction
                      label={t("settings.accountGlass.editDisplayName", {
                        defaultValue: "Edit display name",
                      })}
                      onPress={() => setDisplayNameEdit(sessionUser?.name ?? "")}
                    >
                      {t("settings.accountPage.edit")}
                    </AccountAction>
                  </>
                ) : (
                  <>
                    <GlassTextField
                      accessibilityLabel={t("settings.displayName")}
                      value={displayNameEdit}
                      onChangeText={(v) => {
                        setDisplayNameEdit(v);
                        setDisplayNameError(null);
                      }}
                      placeholder={t("settings.accountPage.displayNamePlaceholder")}
                      editable={!displayNameLoading}
                      maxLength={500}
                      error={displayNameError ?? undefined}
                    />
                    <View style={styles.row}>
                      <AccountAction
                        onPress={() => void handleSaveDisplayName()}
                        disabled={displayNameLoading}
                      >
                        {displayNameLoading ? t("settings.savingAction") : t("common.save")}
                      </AccountAction>
                      <AccountAction
                        onPress={() => {
                          setDisplayNameEdit(null);
                          setDisplayNameError(null);
                        }}
                        disabled={displayNameLoading}
                      >
                        {t("common.cancel")}
                      </AccountAction>
                    </View>
                  </>
                )}
              </AccountSection>
              <AccountSection>
                <SectionLabel>{t("settings.username")}</SectionLabel>
                {usernameEdit === null ? (
                  <>
                    <AccountText>
                      {usernameForDisplay
                        ? `@${usernameForDisplay}`
                        : t("settings.accountPage.dash")}
                    </AccountText>
                    <AccountAction
                      label={t("settings.accountGlass.editUsername", {
                        defaultValue: "Edit username",
                      })}
                      onPress={() => setUsernameEdit(profile?.username ?? "")}
                    >
                      {t("settings.accountPage.edit")}
                    </AccountAction>
                  </>
                ) : (
                  <>
                    <GlassTextField
                      accessibilityLabel={t("settings.username")}
                      value={usernameEdit}
                      onChangeText={(v) => {
                        setUsernameEdit(v.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                        setUsernameError(null);
                      }}
                      placeholder={t("settings.accountPage.usernamePlaceholder")}
                      editable={!usernameLoading}
                      autoCapitalize="none"
                      maxLength={80}
                      error={usernameError ?? usernameFieldError}
                    />
                    <AccountText>{t("settings.accountPage.usernameRules")}</AccountText>
                    <View style={styles.row}>
                      <AccountAction
                        onPress={() => void handleSaveUsername()}
                        disabled={
                          usernameLoading ||
                          usernameEditTrimmed.length < 3 ||
                          Boolean(usernameFieldError)
                        }
                      >
                        {usernameLoading ? t("settings.savingAction") : t("common.save")}
                      </AccountAction>
                      <AccountAction
                        onPress={() => {
                          setUsernameEdit(null);
                          setUsernameError(null);
                        }}
                        disabled={usernameLoading}
                      >
                        {t("common.cancel")}
                      </AccountAction>
                    </View>
                  </>
                )}
              </AccountSection>
              <AccountSection>
                <SectionLabel>{t("settings.accountPage.signInMethodsTitle")}</SectionLabel>
                <AccountText>{t("settings.accountPage.signInMethodsBody")}</AccountText>
                {accountsActionError ? (
                  <AccountText danger>{accountsActionError}</AccountText>
                ) : null}
                {accountsLoading ? (
                  <View style={styles.row}>
                    <ActivityIndicator color={glass.text.fg70} />
                    <AccountText>{t("settings.accountPage.signInMethodsLoading")}</AccountText>
                  </View>
                ) : (
                  <>
                    {linkedAccounts.map((acc) => (
                      <View
                        key={acc.id}
                        style={{
                          borderBottomWidth: 1,
                          borderBottomColor: glass.border.divider,
                          paddingVertical: 12,
                          gap: 4,
                        }}
                      >
                        <AccountText style={{ color: glass.text.fg }}>
                          {labelForProvider(t, acc.providerId)}
                        </AccountText>
                        <AccountText numberOfLines={1}>
                          {acc.providerId === "credential"
                            ? t("settings.accountPage.passwordOnFile")
                            : t("settings.accountPage.connectedLine", { id: acc.accountId })}
                        </AccountText>
                        {acc.providerId !== "credential" ? (
                          <AccountAction
                            label={t("settings.accountGlass.disconnectProvider", {
                              defaultValue: "Disconnect {{provider}}",
                              provider: labelForProvider(t, acc.providerId),
                            })}
                            onPress={() => void handleUnlink(acc.providerId, acc.accountId, acc.id)}
                            disabled={!canUnlinkOAuth || unlinkBusy === acc.id}
                          >
                            {unlinkBusy === acc.id
                              ? t("settings.accountPage.disconnecting")
                              : t("settings.accountPage.disconnect")}
                          </AccountAction>
                        ) : null}
                      </View>
                    ))}
                    <SectionLabel>{t("settings.accountPage.connectAnother")}</SectionLabel>
                    <View style={styles.row}>
                      {LINKABLE_SOCIAL_PROVIDERS.map((p) => {
                        const linked = linkedAccounts.some((a) => a.providerId === p.id);
                        const busy = linkBusy === p.id;
                        return (
                          <PhotoPill
                            key={p.id}
                            variant="outline"
                            onPress={() => void handleLinkSocial(p.id)}
                            disabled={linked || !!linkBusy}
                            label={
                              busy
                                ? t("settings.accountPage.redirectingLink")
                                : linked
                                  ? p.id === "google"
                                    ? t("settings.accountPage.linkedGoogle")
                                    : t("settings.accountPage.linkedApple")
                                  : p.id === "google"
                                    ? t("settings.accountPage.linkGoogle")
                                    : t("settings.accountPage.linkApple")
                            }
                          />
                        );
                      })}
                    </View>
                    {!hasCredentialAccount && oauthAccountRows.length > 0 ? (
                      <AccountText>{t("settings.accountPage.oauthOnlyDisconnectHint")}</AccountText>
                    ) : null}
                  </>
                )}
              </AccountSection>
              <AccountSection>
                <SectionLabel>{t("settings.accountPage.sectionBio")}</SectionLabel>
                {bioEdit === null ? (
                  <>
                    <AccountText>
                      {profile?.bio?.trim() ? profile.bio : t("settings.accountPage.dash")}
                    </AccountText>
                    <AccountAction
                      label={t("settings.accountGlass.editBio", { defaultValue: "Edit bio" })}
                      onPress={() => setBioEdit(profile?.bio ?? "")}
                    >
                      {t("settings.accountPage.edit")}
                    </AccountAction>
                  </>
                ) : (
                  <>
                    <GlassTextField
                      accessibilityLabel={t("settings.accountPage.sectionBio")}
                      value={bioEdit}
                      onChangeText={setBioEdit}
                      placeholder={t("settings.bioPlaceholder")}
                      multiline
                      textAlignVertical="top"
                      editable={!bioLoading}
                      maxLength={500}
                    />
                    <View style={styles.row}>
                      <AccountAction onPress={() => void handleSaveBio()} disabled={bioLoading}>
                        {bioLoading ? t("settings.savingAction") : t("common.save")}
                      </AccountAction>
                      <AccountAction onPress={() => setBioEdit(null)} disabled={bioLoading}>
                        {t("common.cancel")}
                      </AccountAction>
                    </View>
                  </>
                )}
              </AccountSection>
              <AccountSection>
                <SectionLabel>{t("settings.accountPage.sectionPublicProfile")}</SectionLabel>
                {profileVisibilityEdit === null ? (
                  <>
                    <AccountText>
                      {profile?.profileVisibility === "public"
                        ? t("settings.profilePublic")
                        : t("settings.profilePrivate")}
                    </AccountText>
                    <AccountAction
                      onPress={() =>
                        setProfileVisibilityEdit(profile?.profileVisibility ?? "private")
                      }
                    >
                      {t("settings.accountPage.change")}
                    </AccountAction>
                    {profile?.profileVisibility === "public" && profile?.username ? (
                      <AccountAction
                        onPress={() => {
                          const u = profile.username;
                          if (u) router.push(APP_HREF.profile(u));
                        }}
                      >
                        {t("settings.viewPublicProfile")}
                      </AccountAction>
                    ) : null}
                  </>
                ) : (
                  <>
                    <View
                      accessibilityRole="radiogroup"
                      accessibilityLabel={t("settings.accountPage.sectionPublicProfile")}
                      style={styles.row}
                    >
                      {(["public", "private"] as const).map((value) => (
                        <PhotoPill
                          key={value}
                          label={
                            value === "public"
                              ? t("settings.profilePublic")
                              : t("settings.profilePrivate")
                          }
                          variant={profileVisibilityEdit === value ? "solid" : "outline"}
                          accessibilityRole="radio"
                          accessibilityState={{ checked: profileVisibilityEdit === value }}
                          onPress={() => void handleSaveProfileVisibility(value)}
                        />
                      ))}
                    </View>
                    <AccountAction
                      onPress={() => {
                        setProfileVisibilityEdit(null);
                        setProfileVisibilityError(null);
                      }}
                    >
                      {t("common.cancel")}
                    </AccountAction>
                  </>
                )}
                {profileVisibilityError ? (
                  <AccountText danger>{profileVisibilityError}</AccountText>
                ) : null}
                <AccountText>{t("settings.accountPage.visibilityExplainer")}</AccountText>
              </AccountSection>
              <AccountSection>
                <SectionLabel>{t("settings.accountPage.sectionEmailPassword")}</SectionLabel>
                {accountsLoading ? (
                  <AccountText>{t("settings.accountPage.emailPasswordLoading")}</AccountText>
                ) : hasCredentialAccount ? (
                  <>
                    <AccountAction onPress={() => router.push(APP_HREF.resetPassword)}>
                      {t("settings.accountPage.changePassword")}
                    </AccountAction>
                    <AccountText>{t("settings.accountPage.changePasswordHint")}</AccountText>
                  </>
                ) : (
                  <>
                    <AccountText>{t("settings.accountPage.oauthOnlyPasswordIntro")}</AccountText>
                    <GlassTextField
                      label={t("settings.accountPage.newPasswordPlaceholder")}
                      accessibilityLabel={t("settings.accountPage.newPasswordPlaceholder")}
                      secureTextEntry
                      value={newPassword}
                      onChangeText={(v) => {
                        setNewPassword(v);
                        setPasswordSetupError(null);
                      }}
                      placeholder={t("settings.accountPage.newPasswordPlaceholder")}
                      editable={!passwordSetupLoading}
                    />
                    <GlassTextField
                      label={t("settings.accountPage.confirmPasswordPlaceholder")}
                      accessibilityLabel={t("settings.accountPage.confirmPasswordPlaceholder")}
                      secureTextEntry
                      value={confirmPassword}
                      onChangeText={(v) => {
                        setConfirmPassword(v);
                        setPasswordSetupError(null);
                      }}
                      placeholder={t("settings.accountPage.confirmPasswordPlaceholder")}
                      editable={!passwordSetupLoading}
                      error={passwordSetupError ?? undefined}
                    />
                    <AccountAction
                      onPress={() => void handleCreatePassword()}
                      disabled={passwordSetupLoading}
                    >
                      {passwordSetupLoading
                        ? t("settings.savingAction")
                        : t("settings.accountPage.savePassword")}
                    </AccountAction>
                    <AccountText>{t("settings.accountPage.forgotPasswordPart1")}</AccountText>
                    <AccountAction onPress={() => router.push(APP_HREF.resetPassword)}>
                      {t("settings.accountPage.forgotPasswordLink")}
                    </AccountAction>
                    <AccountText>
                      {t("settings.accountPage.forgotPasswordPart2", {
                        email: userEmail ?? t("settings.accountPage.yourEmailFallback"),
                      })}
                    </AccountText>
                  </>
                )}
              </AccountSection>
              <AccountSection>
                <SectionLabel>{t("settings.accountPage.sectionDataPrivacy")}</SectionLabel>
                <AccountText>{t("settings.accountPage.dataPrivacyBody")}</AccountText>
                <AccountAction onPress={() => void openWebAppPath("/terms", t)}>
                  {t("settings.accountPage.termsOfService")}
                </AccountAction>
                <AccountAction onPress={() => void openWebAppPath("/privacy", t)}>
                  {t("settings.accountPage.privacyPolicy")}
                </AccountAction>
                <AccountAction
                  onPress={() =>
                    void Linking.openURL(
                      "mailto:kyarafit@kyarafit.com?subject=Kyarafit%20privacy%20request"
                    )
                  }
                >
                  {t("settings.accountPage.securitySupport")}
                </AccountAction>
                <AccountText>{t("settings.accountPage.deleteExplainer")}</AccountText>
                {!showDeleteConfirm ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setShowDeleteConfirm(true);
                      setDeleteError(null);
                    }}
                    className="active:opacity-80"
                    style={{ minHeight: 44, justifyContent: "center" }}
                  >
                    <AccountText danger>{t("settings.accountPage.deleteAction")}</AccountText>
                  </Pressable>
                ) : null}
              </AccountSection>
            </GlassPanel>
            {showDeleteConfirm ? (
              <GlassOverlay blur={false} surfaceStyle={{ padding: 18, gap: 14 }}>
                <AccountText danger>{t("settings.accountPage.deletePermanentLabel")}</AccountText>
                <AccountHeading
                  title={t("settings.accountPage.deleteConfirmTitle")}
                  subtitle={t("settings.accountPage.deleteConfirmBody")}
                />
                <GlassTextField
                  label={t("settings.accountPage.typeDeleteLabel")}
                  accessibilityLabel={t("settings.accountPage.typeDeleteLabel")}
                  value={deleteConfirmation}
                  onChangeText={(v) => {
                    setDeleteConfirmation(v);
                    setDeleteError(null);
                  }}
                  placeholder={t("settings.accountPage.typeDeletePlaceholder")}
                  editable={!deleteLoading}
                  autoCapitalize="characters"
                  error={deleteError ?? undefined}
                />
                <View style={styles.stack}>
                  <PhotoPill
                    label={
                      deleteLoading
                        ? t("settings.accountDeleting")
                        : t("settings.accountPage.confirmDelete")
                    }
                    onPress={() => void handleDeleteAccount()}
                    disabled={deleteLoading}
                    accessibilityState={{ busy: deleteLoading, disabled: deleteLoading }}
                  />
                  <PhotoPill
                    label={t("common.cancel")}
                    variant="outline"
                    onPress={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmation("");
                      setDeleteError(null);
                    }}
                    disabled={deleteLoading}
                  />
                </View>
              </GlassOverlay>
            ) : null}
          </AccountScroll>
        )}
      </DataBoundary>
    </AccountFrame>
  );
}
