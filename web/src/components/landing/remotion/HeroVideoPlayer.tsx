"use client";

const HERO_VIDEO_SRC = "/landing/hero-loop.mp4";
const HERO_POSTER_SRC = "/landing/hero-loop-poster.png";

export function HeroVideoPlayer() {
  return (
    <div className="w-full h-full bg-[#0A0A0A] overflow-hidden rounded-lg sm:rounded-2xl relative">
      <video
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        loop
        muted
        playsInline
        poster={HERO_POSTER_SRC}
        preload="metadata"
        aria-hidden
      >
        <source src={HERO_VIDEO_SRC} type="video/mp4" />
      </video>
    </div>
  );
}
