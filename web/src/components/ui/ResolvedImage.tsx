"use client";

import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

export interface ResolvedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src"> {
  imageStorageId?: Id<"_storage"> | null;
  imageUrl?: string | null;
  alt: string;
}

/**
 * Renders an img using either Convex storage (resolve via getUrl) or a direct imageUrl.
 * Use when the doc may have imageStorageId or imageUrl.
 */
export function ResolvedImage({ imageStorageId, imageUrl, alt, ...rest }: ResolvedImageProps) {
  const resolvedUrl = useQuery(
    api.files.getUrl,
    imageStorageId ? { storageId: imageStorageId } : "skip"
  );
  const src = imageStorageId ? resolvedUrl : imageUrl;
  if (!src) return null;
  return <img src={src} alt={alt} {...rest} />;
}
