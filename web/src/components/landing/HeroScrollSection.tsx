"use client";

import React from "react";
import Image from "next/image";
import { ContainerScroll } from "@/components/ui/container-scroll-animation";

const HERO_IMAGE = "/images/Hero.png";

type HeroScrollVariant = "hero" | "standalone";

export function HeroScrollSection({ variant = "hero" }: { variant?: HeroScrollVariant }) {
  const isHero = variant === "hero";

  return (
    <ContainerScroll
      variant={isHero ? "compact" : "default"}
      className={isHero ? "p-0 md:p-4 w-full" : undefined}
      titleComponent={
        isHero ? (
          <p className="font-sans-wide text-[10px] text-kyar-meta uppercase tracking-widest">
            Scroll to explore
          </p>
        ) : (
          <>
            <h2 className="font-serif-elegant text-3xl sm:text-4xl font-normal text-kyar-text">
              See your wardrobe
              <br />
              <span className="text-3xl md:text-[5rem] font-bold mt-1 leading-none italic">
                come to life
              </span>
            </h2>
            <p className="text-sm text-kyar-textSecondary mt-4 max-w-lg mx-auto">
              Scroll to explore — catalog, build, and plan in one place.
            </p>
          </>
        )
      }
    >
      <Image
        src={HERO_IMAGE}
        alt="The Lookbook — current focus build with character and event details"
        height={720}
        width={1400}
        className="mx-auto rounded-xl object-cover h-full object-center"
        draggable={false}
        priority
      />
    </ContainerScroll>
  );
}
