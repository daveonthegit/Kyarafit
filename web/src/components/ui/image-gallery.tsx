"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useInView } from "framer-motion";
import { X, ChevronUp, ChevronDown, Trash2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { AspectRatio } from "@/components/ui/aspect-ratio";

const PLACEHOLDER_SRC =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300' fill='%23f0f0f0'%3E%3Crect width='400' height='300' fill='%23f5f5f5'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='14' fill='%23999'%3ENo image%3C/text%3E%3C/svg%3E";

export interface ImageGalleryItem {
  id: string;
  src: string;
  alt: string;
  ratio?: number;
}

export interface ImageGalleryProps {
  images: ImageGalleryItem[];
  title?: string;
  emptyMessage?: string;
  className?: string;
  /** Inline thumbnail max count before "+N" (0 = show all). */
  maxInline?: number;
  /** When set, show remove control on each image; called with image id. */
  onRemove?: (id: string) => void;
  /** When set, show up/down reorder in modal; called with new ordered ids. */
  onReorder?: (orderedIds: string[]) => void;
  /** When set, show "Add photo" in the gallery modal header; call to open upload UI. */
  onOpenAddPhoto?: () => void;
}

function AnimatedImage({
  alt,
  src,
  ratio,
  className,
  placeholder = PLACEHOLDER_SRC,
}: {
  alt: string;
  src: string;
  ratio: number;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true });
  const [isLoading, setIsLoading] = useState(true);
  const [imgSrc, setImgSrc] = useState(src);

  const handleError = () => {
    if (placeholder) setImgSrc(placeholder);
  };

  return (
    <AspectRatio
      ref={ref}
      ratio={ratio}
      className={cn(
        "relative w-full rounded-sm border border-kyar-border bg-kyar-muted",
        className
      )}
    >
      <img
        alt={alt}
        src={imgSrc}
        className={cn("size-full rounded-sm object-cover transition-all duration-500 ease-out", {
          "opacity-100": isInView && !isLoading,
          "opacity-0": isLoading,
        })}
        onLoad={() => setIsLoading(false)}
        loading="lazy"
        onError={handleError}
      />
    </AspectRatio>
  );
}

export function ImageGallery({
  images,
  title = "Gallery",
  emptyMessage = "No images yet.",
  className,
  maxInline = 6,
  onRemove,
  onReorder,
  onOpenAddPhoto,
}: ImageGalleryProps) {
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [modalOpen]);

  const hasImages = images.length > 0;
  const inlineItems =
    maxInline > 0 && images.length > maxInline ? images.slice(0, maxInline) : images;
  const overflowCount = maxInline > 0 && images.length > maxInline ? images.length - maxInline : 0;

  const openModal = () => setModalOpen(true);
  const closeModal = () => setModalOpen(false);

  const handleMove = (index: number, direction: "up" | "down") => {
    if (!onReorder || images.length <= 1) return;
    const newOrder = [...images.map((i) => i.id)];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= newOrder.length) return;
    [newOrder[index], newOrder[target]] = [newOrder[target], newOrder[index]];
    onReorder(newOrder);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {title && (
        <h2 className="font-serif text-xl italic border-b border-kyar-text pb-2">{title}</h2>
      )}

      {/* Inline: clickable thumbnails or placeholder */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {hasImages ? (
          <>
            {inlineItems.map((img) => (
              <div key={img.id} className="relative">
                <button
                  type="button"
                  onClick={openModal}
                  className="text-left w-full rounded-sm overflow-hidden border border-kyar-border focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                  aria-label={`View ${img.alt}`}
                >
                  <AnimatedImage alt={img.alt} src={img.src} ratio={img.ratio ?? 1} />
                </button>
                {onRemove && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onRemove(img.id);
                    }}
                    className="absolute top-1 right-1 p-1.5 rounded-sm bg-kyar-text/60 text-kyar-bg hover:bg-kyar-text/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                    aria-label="Remove image"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
            {overflowCount > 0 && (
              <button
                type="button"
                onClick={openModal}
                className="flex items-center justify-center rounded-sm border border-dashed border-kyar-border bg-kyar-muted/50 text-kyar-textTertiary text-sm font-medium hover:border-kyar-border hover:bg-kyar-muted transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                aria-label={`View all ${images.length} images`}
              >
                +{overflowCount}
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            onClick={openModal}
            className="col-span-full flex flex-col items-center justify-center rounded-sm border border-dashed border-kyar-border bg-kyar-muted/30 py-10 px-4 text-kyar-textTertiary hover:border-kyar-border hover:bg-kyar-muted/50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
            aria-label="Open gallery"
          >
            <img
              src={PLACEHOLDER_SRC}
              alt=""
              className="w-20 h-20 object-contain rounded-sm mb-2 opacity-80"
              aria-hidden
            />
            <span className="text-sm">{emptyMessage}</span>
            <span className="text-[10px] uppercase tracking-wider mt-1">Click to open</span>
          </button>
        )}
      </div>

      {/* Modal: full gallery (portaled so it sits above sticky/scroll layout) */}
      {modalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[9999] flex flex-col bg-kyar-bg"
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-modal-title"
          >
            <header className="flex items-center justify-between border-b border-kyar-border px-4 py-3 shrink-0">
              <h2 id="gallery-modal-title" className="font-serif text-lg italic font-bold">
                {title}
              </h2>
              <div className="flex items-center gap-1">
                {onOpenAddPhoto && (
                  <button
                    type="button"
                    onClick={onOpenAddPhoto}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-sm bg-kyar-accent text-kyar-bg text-sm font-medium hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                    aria-label="Add photo"
                  >
                    <Plus className="size-4" />
                    Add photo
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-2 rounded-sm hover:bg-kyar-muted text-kyar-textSecondary focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  aria-label="Close gallery"
                >
                  <X className="size-5" />
                </button>
              </div>
            </header>
            <div className="flex-1 overflow-auto py-6 px-4">
              {hasImages ? (
                <div className="mx-auto max-w-5xl grid gap-6 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
                  {images.map((img, index) => (
                    <div
                      key={img.id}
                      className="relative overflow-hidden rounded-sm border border-kyar-border group"
                    >
                      <AnimatedImage
                        alt={img.alt}
                        src={img.src}
                        ratio={img.ratio ?? 4 / 3}
                        placeholder={PLACEHOLDER_SRC}
                      />
                      {(onRemove || onReorder) && (
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-kyar-text/50 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          {onReorder && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleMove(index, "up")}
                                disabled={index === 0}
                                className="p-1.5 rounded-sm text-kyar-bg hover:bg-kyar-bg/20 disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-bg"
                                aria-label="Move up"
                              >
                                <ChevronUp className="size-5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMove(index, "down")}
                                disabled={index === images.length - 1}
                                className="p-1.5 rounded-sm text-kyar-bg hover:bg-kyar-bg/20 disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-bg"
                                aria-label="Move down"
                              >
                                <ChevronDown className="size-5" />
                              </button>
                            </>
                          )}
                          {onRemove && (
                            <button
                              type="button"
                              onClick={() => onRemove(img.id)}
                              className="p-1.5 rounded-sm text-kyar-bg hover:bg-kyar-bg/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-bg"
                              aria-label="Remove image"
                            >
                              <Trash2 className="size-5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center text-kyar-textTertiary">
                  <img
                    src={PLACEHOLDER_SRC}
                    alt=""
                    className="w-24 h-24 object-contain rounded-sm mb-4 opacity-60"
                    aria-hidden
                  />
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
