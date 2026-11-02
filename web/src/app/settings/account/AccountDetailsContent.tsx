"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { isAllowedImageType } from "@/lib/imageUtils";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { ProfilePictureCropModal } from "@/components/settings/ProfilePictureCropModal";
import { authClient, setCredentialPassword } from "@/lib/auth/auth-client";

const EMAIL_HIDDEN_PLACEHOLDER = "••••••••••••••••";

const LINKABLE_SOCIAL_PROVIDERS = [
  { id: "google" as const, label: "Google" },
  { id: "apple" as const, label: "Apple" },
];

type LinkedAccountRow = {
  id: string;
  providerId: string;
  accountId: string;
};

function labelForProvider(providerId: string): string {
  if (providerId === "credential") return "Email & password";
  const match = LINKABLE_SOCIAL_PROVIDERS.find((p) => p.id === providerId);
  return match?.label ?? providerId;
}

function messageForOAuthLinkError(error: string, description: string | null): string {
  const key = error.toLowerCase().replace(/\+/g, " ");
  switch (key) {
    case "email_doesn't_match":
    case "email_doesnt_match":
      return "The provider email did not match this account. Try Connect again; with Apple, use “Share My Email” if you want the same address as your Kyarafit login.";
    case "account_not_linked":
      return "That provider can’t be linked automatically. Sign in with your existing method, then use Connect from this page.";
    case "unable_to_link_account":
      return "Could not connect that sign-in method. It may already be used on another Kyarafit account.";
    case "account_already_linked_to_different_user":
      return "That provider is already linked to a different Kyarafit account.";
    default:
      if (description) return decodeURIComponent(description.replace(/\+/g, " "));
      return `Could not connect (${error}). Try again or use another sign-in method.`;
  }
}
const SESSION_EMAIL_VISIBLE_KEY = "kyar_account_email_visible";

export type UserWithUsername = {
  id?: string;
  username?: string;
  displayUsername?: string;
  name?: string;
  email?: string | null;
  image?: string | null;
};

type Props = {
  user: UserWithUsername;
  onUpdateDisplayName: (name: string) => Promise<{ error: { message?: string } | null }>;
  onDeleteAccount: () => Promise<{ error: { message?: string } | null }>;
};

export function AccountDetailsContent({ user, onUpdateDisplayName, onDeleteAccount }: Props) {
  const externalId = user.id ?? null;
  const convexUser = useQuery(api.users.getByExternalId, externalId ? { externalId } : "skip");
  const usernameDisplay = user.displayUsername ?? user.username ?? convexUser?.username ?? null;

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const updateProfileImage = useMutation(api.users.updateProfileImage);
  const updateProfile = useMutation(api.users.updateProfile);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string>("");
  const [emailRevealed, setEmailRevealed] = useState(false);

  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountRow[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsActionError, setAccountsActionError] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState<string | null>(null);
  const [unlinkBusy, setUnlinkBusy] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSetupLoading, setPasswordSetupLoading] = useState(false);
  const [passwordSetupError, setPasswordSetupError] = useState<string | null>(null);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(SESSION_EMAIL_VISIBLE_KEY) === "true") {
        setEmailRevealed(true);
      }
    } catch {
      /* private mode / denied */
    }
  }, []);

  const loadLinkedAccounts = useCallback(async () => {
    setAccountsLoading(true);
    setAccountsActionError(null);
    try {
      const res = await authClient.listAccounts();
      const err = res.error as { message?: string } | null | undefined;
      if (err) {
        setAccountsActionError(err.message ?? "Could not load sign-in methods.");
        setLinkedAccounts([]);
        return;
      }
      const rows = res.data as LinkedAccountRow[] | undefined;
      setLinkedAccounts(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setAccountsActionError(e instanceof Error ? e.message : "Could not load sign-in methods.");
      setLinkedAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!externalId) return;
    void loadLinkedAccounts();
  }, [externalId, loadLinkedAccounts]);

  /** OAuth link flow returns ?error=… on errorCallbackURL (e.g. email mismatch before allowDifferentEmails). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (!err) return;
    const desc = params.get("error_description");
    setAccountsActionError(messageForOAuthLinkError(err, desc));
    window.history.replaceState({}, "", "/settings/account");
  }, []);

  const hasCredentialAccount = linkedAccounts.some((a) => a.providerId === "credential");
  const oauthAccountRows = linkedAccounts.filter((a) => a.providerId !== "credential");
  const canUnlinkOAuth =
    oauthAccountRows.length === 0 ? false : hasCredentialAccount || oauthAccountRows.length > 1;

  const profileImageStorageId = convexUser?.imageStorageId ?? undefined;
  const profileImageUrl =
    !profileImageStorageId && convexUser?.image ? convexUser.image : (user?.image ?? undefined);

  const handleProfileImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !externalId) return;
    if (!isAllowedImageType(file.type)) {
      setUploadError("Use JPG, PNG, WebP, or GIF.");
      return;
    }
    setUploadError(null);
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc(URL.createObjectURL(file));
    setCropModalOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeCropModal = () => {
    if (cropImageSrc) URL.revokeObjectURL(cropImageSrc);
    setCropImageSrc("");
    setCropModalOpen(false);
  };

  const handleCropConfirm = async (blob: Blob) => {
    if (!externalId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const uploadUrl = await generateUploadUrl();
      const response = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
      await updateProfileImage({ storageId });
      closeCropModal();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleCropError = (message: string) => {
    setUploadError(message);
  };

  const handleSaveDisplayName = async () => {
    const trimmed = (displayNameEdit ?? "").trim();
    setDisplayNameError(null);
    setDisplayNameLoading(true);
    try {
      const { error } = await onUpdateDisplayName(trimmed);
      if (error) {
        setDisplayNameError(error.message ?? "Could not update name.");
      } else {
        await updateProfile({ displayName: trimmed || undefined });
        setDisplayNameEdit(null);
      }
    } catch {
      setDisplayNameError("Something went wrong. Please try again.");
    } finally {
      setDisplayNameLoading(false);
    }
  };

  const handleCancelDisplayName = () => {
    setDisplayNameEdit(null);
    setDisplayNameError(null);
  };

  const handleSaveUsername = async () => {
    const raw = (usernameEdit ?? "").trim().toLowerCase();
    setUsernameError(null);

    const sessionUsername = (user.username ?? "").trim().toLowerCase();
    if (raw.length === 0) {
      if (convexUser?.username || sessionUsername) {
        setUsernameError("Username cannot be empty.");
        return;
      }
      setUsernameEdit(null);
      return;
    }

    setUsernameLoading(true);
    try {
      if (raw !== sessionUsername) {
        const check = await authClient.isUsernameAvailable({ username: raw });
        if (check.error) {
          setUsernameError(check.error.message ?? "Could not verify username availability.");
          return;
        }
        const available = (check.data as { available?: boolean } | undefined)?.available;
        if (available === false) {
          setUsernameError("That username is already taken. Try another.");
          return;
        }
      }

      const authRes = await authClient.updateUser({ username: raw });
      if (authRes?.error) {
        setUsernameError(authRes.error.message ?? "Could not update username for sign-in.");
        return;
      }

      await updateProfile({ username: raw });
      setUsernameEdit(null);
      await authClient.getSession();
    } catch (e) {
      setUsernameError(e instanceof Error ? e.message : "Could not update username.");
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleLinkSocial = async (provider: "google" | "apple") => {
    setAccountsActionError(null);
    setLinkBusy(provider);
    try {
      const origin = window.location.origin;
      const res = await authClient.linkSocial({
        provider,
        callbackURL: `${origin}/settings/account`,
        errorCallbackURL: `${origin}/settings/account`,
      });
      if (res?.error) {
        setAccountsActionError(res.error.message ?? "Could not connect that account.");
      }
      // Successful OAuth continues via redirect (see auth client redirect plugin).
    } catch (e) {
      setAccountsActionError(e instanceof Error ? e.message : "Could not connect that account.");
    } finally {
      setLinkBusy(null);
    }
  };

  const handleUnlink = async (providerId: string, accountId: string) => {
    setAccountsActionError(null);
    setUnlinkBusy(accountId);
    try {
      const res = await authClient.unlinkAccount({ providerId, accountId });
      if (res?.error) {
        setAccountsActionError(res.error.message ?? "Could not disconnect that account.");
        return;
      }
      await loadLinkedAccounts();
      await authClient.getSession();
    } catch (e) {
      setAccountsActionError(e instanceof Error ? e.message : "Could not disconnect that account.");
    } finally {
      setUnlinkBusy(null);
    }
  };

  const handleCreatePassword = async () => {
    setPasswordSetupError(null);
    if (newPassword.length < 8) {
      setPasswordSetupError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordSetupError("Passwords do not match.");
      return;
    }
    setPasswordSetupLoading(true);
    try {
      const res = await setCredentialPassword({ newPassword });
      if (res?.error) {
        setPasswordSetupError(res.error.message ?? "Could not save password.");
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      await loadLinkedAccounts();
      await authClient.getSession();
    } catch (e) {
      setPasswordSetupError(e instanceof Error ? e.message : "Could not save password.");
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
      setProfileVisibilityError(e instanceof Error ? e.message : "Could not save. Try again.");
      setProfileVisibilityEdit(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== "DELETE") {
      setDeleteError("Type DELETE to confirm you want to permanently remove your account.");
      return;
    }

    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const { error } = await onDeleteAccount();
      if (error) {
        setDeleteError(error.message ?? "We couldn't delete your account. Please try again.");
      }
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "We couldn't delete your account. Please try again."
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="py-4 border-b border-glass-divider">
        <p className="text-[11px] uppercase tracking-[0.16em] text-media-fg-70 mb-2">
          Profile picture
        </p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border border-glass-border-strong bg-glass flex-shrink-0">
            {profileImageStorageId ? (
              <ResolvedImage
                imageStorageId={profileImageStorageId}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : profileImageUrl ? (
              <img src={profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-3xl text-media-fg-55 w-full h-full flex items-center justify-center">
                person
              </span>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="sr-only"
              aria-label="Upload profile picture"
              onChange={handleProfileImageSelect}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg disabled:opacity-50 disabled:no-underline"
            >
              {uploading ? "Uploading…" : "Change picture"}
            </button>
            <p className="text-[11px] text-media-fg-55 mt-0.5">JPG, PNG, WebP, GIF</p>
            {uploadError && (
              <p className="text-xs text-on-glass-danger mt-1" role="alert">
                {uploadError}
              </p>
            )}
          </div>
        </div>
      </div>
      <ProfilePictureCropModal
        open={cropModalOpen}
        imageSrc={cropImageSrc}
        onClose={closeCropModal}
        onConfirm={handleCropConfirm}
        onError={handleCropError}
      />
      <div className="py-4 border-b border-glass-divider">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] uppercase tracking-[0.16em] text-media-fg-70 mb-1">Email</p>
            <p
              className={`text-sm break-all ${user.email && !emailRevealed ? "select-none text-media-fg-70" : ""}`}
              data-testid="account-email"
              aria-label={user.email && !emailRevealed ? "Email address hidden." : undefined}
            >
              {!user.email ? "—" : emailRevealed ? user.email : EMAIL_HIDDEN_PLACEHOLDER}
            </p>
          </div>
          {user.email ? (
            <button
              type="button"
              onClick={() => {
                setEmailRevealed((prev) => {
                  const next = !prev;
                  try {
                    sessionStorage.setItem(SESSION_EMAIL_VISIBLE_KEY, next ? "true" : "false");
                  } catch {
                    /* ignore */
                  }
                  return next;
                });
              }}
              className="shrink-0 text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded min-h-[44px] px-1"
              aria-expanded={emailRevealed}
              data-testid="account-email-toggle"
            >
              {emailRevealed ? "Hide" : "Show"}
            </button>
          ) : null}
        </div>
      </div>
      <div className="py-4 border-b border-glass-divider">
        <p className="text-[11px] uppercase tracking-[0.16em] text-media-fg-70 mb-1">
          Display name
        </p>
        {displayNameEdit === null ? (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm" data-testid="account-name">
              {user.name ?? "—"}
            </p>
            <button
              type="button"
              onClick={() => setDisplayNameEdit(user.name ?? "")}
              className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <input
              id="display-name-input"
              type="text"
              value={displayNameEdit}
              onChange={(e) => {
                setDisplayNameEdit(e.target.value);
                setDisplayNameError(null);
              }}
              placeholder="Display name"
              maxLength={500}
              className="w-full px-4 py-3 text-sm border-b border-glass-divider bg-transparent focus:outline-none focus:border-kyar-media-fg transition-colors"
              disabled={displayNameLoading}
              data-testid="account-name-input"
              autoComplete="name"
            />
            {displayNameError && (
              <p className="text-xs text-on-glass-danger" role="alert">
                {displayNameError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveDisplayName}
                disabled={displayNameLoading}
                className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg disabled:opacity-50 disabled:no-underline"
              >
                {displayNameLoading ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCancelDisplayName}
                disabled={displayNameLoading}
                className="text-[11px] uppercase tracking-[0.16em] font-semibold text-media-fg-70 underline decoration-glass-border-strong hover:decoration-kyar-media-fg disabled:opacity-50 disabled:no-underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="py-4 border-b border-glass-divider">
        <p className="text-[11px] uppercase tracking-[0.16em] text-media-fg-70 mb-1">Username</p>
        {usernameEdit === null ? (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm" data-testid="account-username">
              {usernameDisplay ? `@${usernameDisplay}` : "—"}
            </p>
            <button
              type="button"
              onClick={() => setUsernameEdit(convexUser?.username ?? "")}
              className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <input
              type="text"
              value={usernameEdit}
              onChange={(e) => {
                setUsernameEdit(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""));
                setUsernameError(null);
              }}
              placeholder="username"
              maxLength={80}
              className="w-full px-4 py-3 text-sm border-b border-glass-divider bg-transparent focus:outline-none focus:border-kyar-media-fg transition-colors"
              disabled={usernameLoading}
              data-testid="account-username-input"
              autoComplete="username"
            />
            <p className="text-[11px] text-media-fg-55">
              Letters, numbers, underscores only. Your profile: kyarafit.com/u/username
            </p>
            {usernameError && (
              <p className="text-xs text-on-glass-danger" role="alert">
                {usernameError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveUsername}
                disabled={usernameLoading}
                className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg disabled:opacity-50"
              >
                {usernameLoading ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setUsernameEdit(null);
                  setUsernameError(null);
                }}
                disabled={usernameLoading}
                className="text-[11px] uppercase tracking-[0.16em] font-semibold text-media-fg-70 underline decoration-glass-border-strong hover:decoration-kyar-media-fg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="py-4 border-b border-glass-divider">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-media-fg-70 mb-1">
              Sign-in methods
            </p>
          </div>
        </div>
        {accountsActionError && (
          <p className="text-xs text-on-glass-danger mb-3" role="alert">
            {accountsActionError}
          </p>
        )}
        {accountsLoading ? (
          <p className="text-sm text-media-fg-70">Loading sign-in methods…</p>
        ) : (
          <ul className="space-y-3">
            {linkedAccounts.map((acc) => (
              <li
                key={acc.id}
                className="flex flex-wrap items-center justify-between gap-2 border border-glass-divider rounded-xl px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-kyar-media-fg">
                    {labelForProvider(acc.providerId)}
                  </p>
                  <p className="text-[11px] text-media-fg-55 font-mono truncate max-w-[220px] sm:max-w-md">
                    {acc.providerId === "credential"
                      ? "Password on file"
                      : `Connected · ${acc.accountId}`}
                  </p>
                </div>
                {acc.providerId !== "credential" && (
                  <button
                    type="button"
                    disabled={!canUnlinkOAuth || unlinkBusy === acc.id}
                    onClick={() => void handleUnlink(acc.providerId, acc.accountId)}
                    className="text-[11px] uppercase tracking-[0.16em] font-semibold text-media-fg-70 hover:text-on-glass-danger underline decoration-glass-border-strong disabled:opacity-40 disabled:no-underline"
                  >
                    {unlinkBusy === acc.id ? "Removing…" : "Disconnect"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!accountsLoading && (
          <div className="mt-4 space-y-2">
            <p className="text-[11px] uppercase tracking-[0.16em] text-media-fg-70">
              Connect another provider
            </p>
            <div className="flex flex-wrap gap-2">
              {LINKABLE_SOCIAL_PROVIDERS.map((p) => {
                const linked = linkedAccounts.some((a) => a.providerId === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={linked || !!linkBusy}
                    onClick={() => void handleLinkSocial(p.id)}
                    className="inline-flex min-h-[40px] items-center rounded-full border border-glass-divider px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg hover:bg-glass-active transition-colors disabled:opacity-40"
                  >
                    {linkBusy === p.id
                      ? "Redirecting…"
                      : linked
                        ? `${p.label} linked`
                        : `Link ${p.label}`}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {!accountsLoading && !hasCredentialAccount && (
          <p className="mt-3 text-[11px] text-media-fg-55">
            Disconnect is disabled when this is your only sign-in method. Add email & password
            below, or link another provider first.
          </p>
        )}
      </div>

      <div className="py-4 border-b border-glass-divider">
        <p className="text-[11px] uppercase tracking-[0.16em] text-media-fg-70 mb-1">Bio</p>
        {bioEdit === null ? (
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm text-media-fg-70 whitespace-pre-wrap flex-1 min-w-0">
              {convexUser?.bio ?? "—"}
            </p>
            <button
              type="button"
              onClick={() => setBioEdit(convexUser?.bio ?? "")}
              className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg"
            >
              Edit
            </button>
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            <textarea
              value={bioEdit}
              onChange={(e) => setBioEdit(e.target.value)}
              placeholder="Short bio for your public profile"
              maxLength={500}
              rows={3}
              className="w-full px-4 py-3 text-sm border-b border-glass-divider bg-transparent focus:outline-none focus:border-kyar-media-fg transition-colors"
              disabled={bioLoading}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveBio}
                disabled={bioLoading}
                className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg disabled:opacity-50"
              >
                {bioLoading ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setBioEdit(null)}
                disabled={bioLoading}
                className="text-[11px] uppercase tracking-[0.16em] font-semibold text-media-fg-70 underline decoration-glass-border-strong hover:decoration-kyar-media-fg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="py-4 border-b border-glass-divider">
        <p className="text-[11px] uppercase tracking-[0.16em] text-media-fg-70 mb-1">
          Public profile
        </p>
        {profileVisibilityEdit === null ? (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm">
              {convexUser?.profileVisibility === "public" ? "Public" : "Private"}
            </p>
            <button
              type="button"
              onClick={() => setProfileVisibilityEdit(convexUser?.profileVisibility ?? "private")}
              className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg"
            >
              Change
            </button>
            {convexUser?.profileVisibility === "public" && convexUser?.username && (
              <Link
                href={`/u/${convexUser.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg ml-2"
              >
                View profile
              </Link>
            )}
          </div>
        ) : (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => handleSaveProfileVisibility("public")}
              className="text-[10px] font-bold uppercase tracking-[0.16em] px-6 py-2.5 border border-glass-border-strong bg-glass-bar rounded-full hover:bg-glass-active transition-colors"
            >
              Public
            </button>
            <button
              type="button"
              onClick={() => handleSaveProfileVisibility("private")}
              className="text-[10px] font-bold uppercase tracking-[0.16em] px-6 py-2.5 border border-glass-border-strong bg-glass-bar rounded-full hover:bg-glass-active transition-colors"
            >
              Private
            </button>
            <button
              type="button"
              onClick={() => {
                setProfileVisibilityEdit(null);
                setProfileVisibilityError(null);
              }}
              className="text-[11px] uppercase tracking-[0.16em] font-semibold text-media-fg-70 underline decoration-glass-border-strong hover:decoration-kyar-media-fg"
            >
              Cancel
            </button>
          </div>
        )}
        {profileVisibilityError && (
          <p className="text-xs text-on-glass-danger mt-2" role="alert">
            {profileVisibilityError}
          </p>
        )}
      </div>
      <div className="pt-4 space-y-6">
        <div>
          <p className="text-[11px] uppercase tracking-[0.16em] text-media-fg-70 mb-2">
            Email & password
          </p>
          {accountsLoading ? (
            <p className="text-sm text-media-fg-70">Loading…</p>
          ) : hasCredentialAccount ? (
            <>
              <Link
                href="/auth/reset-password"
                className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg"
              >
                Change password
              </Link>
            </>
          ) : (
            <>
              <div className="space-y-2 max-w-md">
                <label className="sr-only" htmlFor="create-password">
                  New password
                </label>
                <input
                  id="create-password"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    setPasswordSetupError(null);
                  }}
                  placeholder="New password (min 8 characters)"
                  className="w-full px-4 py-3 text-sm border-b border-glass-divider bg-transparent focus:outline-none focus:border-kyar-media-fg transition-colors"
                  disabled={passwordSetupLoading}
                />
                <label className="sr-only" htmlFor="confirm-password">
                  Confirm password
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setPasswordSetupError(null);
                  }}
                  placeholder="Confirm password"
                  className="w-full px-4 py-3 text-sm border-b border-glass-divider bg-transparent focus:outline-none focus:border-kyar-media-fg transition-colors"
                  disabled={passwordSetupLoading}
                />
                {passwordSetupError && (
                  <p className="text-xs text-on-glass-danger" role="alert">
                    {passwordSetupError}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void handleCreatePassword()}
                  disabled={passwordSetupLoading}
                  className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg disabled:opacity-50"
                >
                  {passwordSetupLoading ? "Saving…" : "Save password"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <div className="pt-4 border-t border-glass-divider">
        <p className="text-[11px] uppercase tracking-[0.16em] text-media-fg-70 mb-2">
          Data & privacy
        </p>
        <p className="text-[11px] text-media-fg-70 leading-5">
          Kyarafit stores your account details, cosplay builds, uploaded images, and convention
          plans in the cloud when you’re signed in. On this browser, auth and session data are
          stored locally so you stay signed in across refreshes.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg"
          >
            Terms of Service
          </Link>
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg"
          >
            Privacy policy
          </Link>
          <a
            href="mailto:kyarafit@kyarafit.com?subject=Kyarafit%20privacy%20request"
            className="text-[11px] uppercase tracking-[0.16em] font-semibold text-kyar-media-fg underline decoration-glass-border-strong hover:decoration-kyar-media-fg"
          >
            Security & support
          </a>
        </div>
        <p className="mt-3 text-[11px] text-media-fg-70 leading-5">
          Deleting your account permanently removes your cloud-synced profile, builds, convention
          plans, and uploaded images. Local-only data created while browsing without an account is
          not part of your cloud profile.
        </p>
        {!showDeleteConfirm ? (
          <button
            type="button"
            onClick={() => {
              setShowDeleteConfirm(true);
              setDeleteError(null);
            }}
            className="mt-4 inline-flex min-h-[44px] items-center rounded-full border border-on-glass-danger/60 px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-on-glass-danger transition-colors hover:bg-on-glass-danger/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
          >
            Delete account
          </button>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-kyar-danger/20 bg-glass-active shadow-soft">
            <div className="border-b border-on-glass-danger/30 bg-on-glass-danger/10 px-4 py-3 sm:px-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-on-glass-danger/80">
                Permanent action
              </p>
              <p className="mt-1 font-serif text-2xl tracking-tight text-kyar-media-fg">
                Delete account permanently?
              </p>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-sm leading-6 text-media-fg-70">
                This can’t be undone. We’ll remove your Kyarafit account, cloud-synced content,
                uploaded images, and this browser&apos;s signed-in session data.
              </p>
              <label className="block text-[11px] uppercase tracking-[0.16em] text-media-fg-70">
                Type DELETE to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmation}
                onChange={(event) => {
                  setDeleteConfirmation(event.target.value);
                  setDeleteError(null);
                }}
                placeholder="DELETE"
                className="w-full rounded-xl border border-on-glass-danger/40 bg-glass-active px-4 py-3 text-sm text-kyar-media-fg placeholder:text-media-fg-55 focus:border-on-glass-danger focus:outline-none"
                disabled={deleteLoading}
              />
              {deleteError && (
                <p className="text-xs text-on-glass-danger" role="alert">
                  {deleteError}
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-on-glass-danger px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-on-glass-danger transition-colors hover:bg-on-glass-danger/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {deleteLoading ? "Deleting…" : "Confirm delete"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmation("");
                    setDeleteError(null);
                  }}
                  disabled={deleteLoading}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-glass-divider px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 transition-colors hover:border-kyar-text hover:bg-glass-active hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
