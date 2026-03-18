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
};

export function AccountDetailsContent({ user, onUpdateDisplayName }: Props) {
  const usernameDisplay = user.displayUsername ?? user.username ?? null;
  const [displayNameEdit, setDisplayNameEdit] = useState<string | null>(null);
  const [displayNameLoading, setDisplayNameLoading] = useState(false);
  const [displayNameError, setDisplayNameError] = useState<string | null>(null);

  const externalId = user.id ?? null;
  const convexUser = useQuery(api.users.getByExternalId, externalId ? { externalId } : "skip");
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const updateProfileImage = useMutation(api.users.updateProfileImage);
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

  return (
    <section className="space-y-6">
      <div className="py-3 border-b border-gray-100">
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
      <div className="py-3 border-b border-gray-100">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">Email</p>
        <p className="text-sm" data-testid="account-email">
          {user.email ?? "—"}
        </p>
      </div>
      <div className="py-3 border-b border-gray-100">
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
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-kyar-accent/50"
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
      <div className="py-3 border-b border-gray-100">
        <p className="text-[11px] uppercase tracking-widest text-kyar-textSecondary mb-1">
          Username
        </p>
        <p className="text-sm" data-testid="account-username">
          {usernameDisplay ?? "—"}
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
    </section>
  );
}
