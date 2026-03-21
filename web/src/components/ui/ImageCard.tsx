"use client";

import Image from "next/image";

interface ImageCardProps {
  imageUrl: string;
  title: string;
  tag?: string;
  className?: string;
}

export function ImageCard({ imageUrl, title, tag, className = "" }: ImageCardProps) {
  return (
    <article
      className={`rounded-2xl bg-kyar-surface border border-kyar-borderSubtle overflow-hidden shadow-soft transition-transform hover:-translate-y-1 hover:shadow-lg ${className}`}
    >
      <div className="relative aspect-[3/4] bg-kyar-muted">
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 50vw, 33vw"
        />
        {tag && (
          <span className="absolute bottom-2 left-2 text-[10px] font-sans-wide font-semibold uppercase tracking-wider text-kyar-text bg-white/90 px-2 py-0.5">
            {tag}
          </span>
        )}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-sans text-kyar-text">{title}</h3>
      </div>
    </article>
  );
}
