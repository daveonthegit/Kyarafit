"use client";

import { useState, useRef } from "react";
import { useSession } from "@/lib/auth/client";
import { useTier } from "@/lib/api/useTier";

interface ImageUploadProps {
  onImageSelected: (url: string) => void;
  category: "builds" | "conventions" | "closet";
  currentImage?: string;
}

export function ImageUpload({ onImageSelected, category, currentImage }: ImageUploadProps) {
  const { session } = useSession();
  const { data: tier } = useTier();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"file" | "url">("file");
  const [urlInput, setUrlInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isPremium = tier?.tier && tier.tier !== "free";

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Please upload: JPG, PNG, WebP, or GIF");
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File too large. Maximum size is 5MB");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      // Premium users: upload to cloud storage
      if (isPremium && session?.access_token) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("category", category);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/v1/upload/image`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: formData,
          }
        );

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Upload failed");
        }

        const data = await response.json();
        onImageSelected(data.url);
      } else {
        // Non-premium users: store as local data URL (base64)
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          onImageSelected(dataUrl);
        };
        reader.onerror = () => {
          setError("Failed to read file");
        };
        reader.readAsDataURL(file);
      }
    } catch (err: any) {
      setError(err.message || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) {
      setError("Please enter a URL");
      return;
    }
    try {
      new URL(urlInput); // Validate URL
      onImageSelected(urlInput);
      setUrlInput("");
      setError(null);
    } catch {
      setError("Invalid URL format");
    }
  };

  return (
    <div className="space-y-4">
      {/* Mode toggle - always shown */}
      <div className="flex gap-2 mb-4">
        <button
          type="button"
          onClick={() => setMode("file")}
          className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider border ${
            mode === "file"
              ? "border-black bg-kyar-muted text-black"
              : "border-kyar-border text-kyar-textTertiary hover:border-black"
          }`}
        >
          Upload File
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={`px-3 py-1 text-xs font-semibold uppercase tracking-wider border ${
            mode === "url"
              ? "border-black bg-kyar-muted text-black"
              : "border-kyar-border text-kyar-textTertiary hover:border-black"
          }`}
        >
          Enter URL
        </button>
      </div>

      {mode === "file" ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-kyar-border hover:border-black py-8 text-center transition disabled:opacity-50"
          >
            {uploading ? (
              <span className="text-sm uppercase tracking-wider">Uploading...</span>
            ) : (
              <div>
                <span className="material-symbols-outlined text-3xl block mb-2">
                  {isPremium ? "cloud_upload" : "upload"}
                </span>
                <span className="text-sm uppercase tracking-wider">Click to upload image</span>
                <p className="text-xs text-kyar-textTertiary mt-1">
                  JPG, PNG, WebP, GIF (max 5MB)
                  {isPremium ? " • Cloud storage" : " • Stored locally"}
                </p>
              </div>
            )}
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="px-4 py-2 bg-black text-white text-xs font-bold uppercase tracking-wider hover:bg-gray-800"
          >
            Add
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {currentImage && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wider mb-2">Current Image:</p>
          <img
            src={currentImage}
            alt="Current"
            className="w-full max-w-xs h-48 object-cover border border-kyar-border"
          />
        </div>
      )}
    </div>
  );
}
