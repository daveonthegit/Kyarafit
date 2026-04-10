"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { isAllowedImageType } from "@/lib/imageUtils";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { ProfilePictureCropModal } from "@/components/settings/ProfilePictureCropModal";

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
    setUsernameLoading(true);
    try {
      await updateProfile({ username: raw || undefined });
      setUsernameEdit(null);
    } catch (e) {
      setUsernameError(e instanceof Error ? e.message : "Could not update username.");
    } finally {
      setUsernameLoading(false);
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
      <div className="py-4 border-b border-kyar-borderSubtle">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-2">
          Profile picture
        </p>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border border-kyar-cardBorder bg-kyar-mutedWarm flex-shrink-0">
            {profileImageStorageId ? (
              <ResolvedImage
                imageStorageId={profileImageStorageId}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : profileImageUrl ? (
              <img src={profileImageUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-3xl text-kyar-textTertiary w-full h-full flex items-center justify-center">
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
              className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {uploading ? "Uploading…" : "Change picture"}
            </button>
            <p className="text-[11px] text-kyar-textTertiary mt-0.5">JPG, PNG, WebP, GIF</p>
            {uploadError && (
              <p className="text-xs text-red-500 mt-1" role="alert">
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
      <div className="py-4 border-b border-kyar-borderSubtle">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">Email</p>
        <p className="text-sm" data-testid="account-email">
          {user.email ?? "—"}
        </p>
      </div>
      <div className="py-4 border-b border-kyar-borderSubtle">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
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
              className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
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
              className="w-full px-4 py-3 text-sm border-b border-kyar-borderSubtle bg-transparent focus:outline-none focus:border-kyar-text transition-colors"
              disabled={displayNameLoading}
              data-testid="account-name-input"
              autoComplete="name"
            />
            {displayNameError && (
              <p className="text-xs text-red-500" role="alert">
                {displayNameError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveDisplayName}
                disabled={displayNameLoading}
                className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {displayNameLoading ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={handleCancelDisplayName}
                disabled={displayNameLoading}
                className="text-[11px] uppercase tracking-widest font-medium text-kyar-textSecondary hover:underline disabled:opacity-50 disabled:no-underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="py-4 border-b border-kyar-borderSubtle">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
          Username
        </p>
        {usernameEdit === null ? (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm" data-testid="account-username">
              {usernameDisplay ? `@${usernameDisplay}` : "—"}
            </p>
            <button
              type="button"
              onClick={() => setUsernameEdit(convexUser?.username ?? "")}
              className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
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
              className="w-full px-4 py-3 text-sm border-b border-kyar-borderSubtle bg-transparent focus:outline-none focus:border-kyar-text transition-colors"
              disabled={usernameLoading}
              data-testid="account-username-input"
              autoComplete="username"
            />
            <p className="text-[11px] text-kyar-textTertiary">
              Letters, numbers, underscores only. Your profile: kyarafit.com/u/username
            </p>
            {usernameError && (
              <p className="text-xs text-red-500" role="alert">
                {usernameError}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveUsername}
                disabled={usernameLoading}
                className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline disabled:opacity-50"
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
                className="text-[11px] uppercase tracking-widest font-medium text-kyar-textSecondary hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="py-4 border-b border-kyar-borderSubtle">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">Bio</p>
        {bioEdit === null ? (
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm text-kyar-textSecondary whitespace-pre-wrap flex-1 min-w-0">
              {convexUser?.bio ?? "—"}
            </p>
            <button
              type="button"
              onClick={() => setBioEdit(convexUser?.bio ?? "")}
              className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline"
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
              className="w-full px-4 py-3 text-sm border-b border-kyar-borderSubtle bg-transparent focus:outline-none focus:border-kyar-text transition-colors"
              disabled={bioLoading}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveBio}
                disabled={bioLoading}
                className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline disabled:opacity-50"
              >
                {bioLoading ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => setBioEdit(null)}
                disabled={bioLoading}
                className="text-[11px] uppercase tracking-widest font-medium text-kyar-textSecondary hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="py-4 border-b border-kyar-borderSubtle">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
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
              className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline"
            >
              Change
            </button>
            {convexUser?.profileVisibility === "public" && convexUser?.username && (
              <Link
                href={`/u/${convexUser.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline ml-2"
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
              className="text-[10px] font-bold uppercase tracking-widest px-6 py-2.5 border border-kyar-borderSubtle rounded-full hover:bg-kyar-text hover:text-kyar-bg transition-colors"
            >
              Public
            </button>
            <button
              type="button"
              onClick={() => handleSaveProfileVisibility("private")}
              className="text-[10px] font-bold uppercase tracking-widest px-6 py-2.5 border border-kyar-borderSubtle rounded-full hover:bg-kyar-text hover:text-kyar-bg transition-colors"
            >
              Private
            </button>
            <button
              type="button"
              onClick={() => {
                setProfileVisibilityEdit(null);
                setProfileVisibilityError(null);
              }}
              className="text-[11px] uppercase tracking-widest font-medium text-kyar-textSecondary hover:underline"
            >
              Cancel
            </button>
          </div>
        )}
        {profileVisibilityError && (
          <p className="text-xs text-red-500 mt-2" role="alert">
            {profileVisibilityError}
          </p>
        )}
        <p className="text-[11px] text-kyar-textTertiary mt-1">
          Public: others can see your profile and public builds. Private: only you.
        </p>
      </div>
      <div className="pt-4">
        <Link
          href="/auth/reset-password"
          className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline"
        >
          Change password
        </Link>
        <p className="mt-1 text-[11px] text-kyar-textSecondary">
          We’ll send you a link to set a new password.
        </p>
      </div>
      <div className="pt-4 border-t border-kyar-borderSubtle">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-2">
          Data & privacy
        </p>
        <p className="text-[11px] text-kyar-textSecondary leading-5">
          Kyarafit stores your account details, cosplay builds, uploaded images, and convention
          plans in the cloud when you’re signed in. On this browser, auth and session data are
          stored locally so you stay signed in across refreshes.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          <Link
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline"
          >
            Privacy policy
          </Link>
          <a
            href="mailto:kyarafit@kyarafit.com?subject=Kyarafit%20privacy%20request"
            className="text-[11px] uppercase tracking-widest font-medium text-kyar-accent hover:underline"
          >
            Security & support
          </a>
        </div>
        <p className="mt-3 text-[11px] text-kyar-textSecondary leading-5">
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
            className="mt-4 inline-flex min-h-[44px] items-center rounded-full border border-kyar-danger/25 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-kyar-danger transition-colors hover:bg-kyar-danger hover:text-kyar-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
          >
            Delete account
          </button>
        ) : (
          <div className="mt-5 overflow-hidden rounded-2xl border border-kyar-danger/20 bg-kyar-surface shadow-soft">
            <div className="border-b border-kyar-danger/15 bg-kyar-danger/6 px-4 py-3 sm:px-5">
              <p className="text-[11px] uppercase tracking-[0.2em] text-kyar-danger/80">
                Permanent action
              </p>
              <p className="mt-1 font-serif text-2xl tracking-tight text-kyar-text">
                Delete account permanently?
              </p>
            </div>
            <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
              <p className="text-sm leading-6 text-kyar-textSecondary">
                This can’t be undone. We’ll remove your Kyarafit account, cloud-synced content,
                uploaded images, and this browser&apos;s signed-in session data.
              </p>
              <label className="block text-[11px] uppercase tracking-widest text-kyar-textSecondary">
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
                className="w-full rounded-xl border border-kyar-danger/20 bg-kyar-bg px-4 py-3 text-sm text-kyar-text placeholder:text-kyar-textTertiary focus:border-kyar-danger focus:outline-none"
                disabled={deleteLoading}
              />
              {deleteError && (
                <p className="text-xs text-kyar-danger" role="alert">
                  {deleteError}
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={deleteLoading}
                  className="inline-flex min-h-[44px] items-center rounded-full bg-kyar-danger px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-kyar-bg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 disabled:opacity-50"
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
                  className="inline-flex min-h-[44px] items-center rounded-full border border-kyar-borderSubtle px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-kyar-textSecondary transition-colors hover:border-kyar-text hover:bg-kyar-muted hover:text-kyar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 disabled:opacity-50"
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
