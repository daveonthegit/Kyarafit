"use client";

import { notFound } from "next/navigation";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { ImageGallery } from "@/components/ui/image-gallery";
import type { ImageGalleryItem } from "@/components/ui/image-gallery";

const DEMO_IMAGES: ImageGalleryItem[] = [
  {
    id: "1",
    src: "https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=800",
    alt: "Costume reference",
    ratio: 4 / 3,
  },
  {
    id: "2",
    src: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800",
    alt: "Fabric and materials",
    ratio: 16 / 9,
  },
  {
    id: "3",
    src: "https://images.unsplash.com/photo-1578637387939-43c525550085?w=800",
    alt: "Sewing and craft",
    ratio: 3 / 4,
  },
  {
    id: "4",
    src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
    alt: "Portrait style",
    ratio: 1,
  },
  {
    id: "5",
    src: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800",
    alt: "Creative workspace",
    ratio: 16 / 9,
  },
  {
    id: "6",
    src: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
    alt: "Detail shot",
    ratio: 3 / 4,
  },
];

export default function DemoGalleryPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return (
    <WebAppShell>
      <main className="max-w-4xl mx-auto py-8 px-4">
        <p className="meta-label mb-6">Demo</p>
        <h1 className="font-serif text-3xl italic font-bold tracking-tight mb-8">
          Image gallery (Kyarafit)
        </h1>
        <ImageGallery
          images={DEMO_IMAGES}
          title="Reference images"
          emptyMessage="No reference images yet."
          maxInline={6}
        />
        <div className="mt-12 pt-8 border-t border-kyar-border">
          <ImageGallery
            images={[]}
            title="Progress photos"
            emptyMessage="No progress photos yet. Track your build with photos and dates."
            maxInline={6}
          />
        </div>
      </main>
    </WebAppShell>
  );
}
