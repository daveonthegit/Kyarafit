"use client";

import type { ReactNode } from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from "remotion";
import { LandingMiniAppFrame, type NavKey } from "@/components/landing/LandingMiniAppFrame";
import { LandingMiniBuildsPreviewContent } from "@/components/landing/LandingMiniBuildsPreview";
import { LandingMiniElementsPreviewContent } from "@/components/landing/LandingMiniElementsPreview";
import { LANDING_BUILDS, LANDING_NODES, MOCK_ACCOUNT } from "@/data/landingMock";
import { ConventionLandingPreviewRemotion } from "./ConventionLandingPreviewRemotion";

/** Fixed heights for 1920×1080 canvas — avoid vh (maps to browser viewport in Player, not frame). */
const FRAME_MAIN =
  "min-h-[240px] max-h-[560px] overflow-hidden overflow-y-auto p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

function toRemotionStaticFile(src: string) {
  const relativePath = src.startsWith("/") ? src.slice(1) : src;
  return staticFile(decodeURIComponent(relativePath));
}

const REMOTION_BUILDS = LANDING_BUILDS.map((build) => ({
  ...build,
  imageSrc: toRemotionStaticFile(build.imageSrc),
}));

const REMOTION_NODES = LANDING_NODES.map((node) => ({
  ...node,
  imageSrc: staticFile(node.remotionPublicPath),
}));

const REMOTION_CONVENTION = {
  ...MOCK_ACCOUNT.convention,
  heroImageSrc: toRemotionStaticFile(MOCK_ACCOUNT.convention.heroImageSrc),
};

/**
 * Cinematic Background with subtle motion to provide spatial context.
 */
const CinematicBackground = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Slowly pan the background grid to create a sense of continuous forward momentum
  const driftY = (frame / fps) * 15;

  return (
    <AbsoluteFill className="bg-kyar-bgWarm">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
          transform: `translateY(${driftY}px)`,
          color: "#111",
        }}
      />
      {/* Radial gradient vignette to focus attention on the center */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.03)_100%)]" />
    </AbsoluteFill>
  );
};

/** Frame-driven micro-motion — subtle 3D tilt + float for a premium glass/spatial feel. */
function AnimatedMiniAppPreview({
  activeNav,
  children,
  baseScale = 1.08,
}: {
  activeNav: NavKey;
  children: ReactNode;
  baseScale?: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Smoother, slightly slower breathe
  const breathe = 1 + 0.01 * Math.sin((frame / (fps * 4)) * Math.PI * 2);
  const driftY = Math.sin(frame * 0.08) * 3;
  const driftX = Math.cos(frame * 0.06) * 1.5;

  // Subtle 3D tilt for depth
  const rotateX = Math.sin(frame * 0.05) * 1.5;
  const rotateY = Math.cos(frame * 0.04) * 1.5;

  const combinedScale = baseScale * breathe;

  return (
    <div
      className="pointer-events-none max-h-full min-w-0 select-none"
      style={{
        width: 1040,
        maxWidth: "100%",
        transform: `translate(${driftX}px, ${driftY}px) scale(${combinedScale}) perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
        transformOrigin: "center center",
      }}
    >
      <LandingMiniAppFrame activeNav={activeNav} mainClassName={FRAME_MAIN} remotion>
        {children}
      </LandingMiniAppFrame>
    </div>
  );
}

type SceneProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
  /** Frame range for intro */
  fadeIn: readonly [number, number];
  /** Frame range for outro */
  fadeOut: readonly [number, number];
  zIndex: number;
};

/**
 * ProductScene implements a "Z-Axis Push" camera effect.
 * Instead of simple fades, scenes scale up from the background, into focus,
 * and then scale massively out towards the camera, blurring as they exit.
 */
function ProductScene({ title, eyebrow, children, fadeIn, fadeOut, zIndex }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isExiting = frame >= fadeOut[0];

  // --- ENTRANCE (Background to Center) ---
  const introProgress = spring({
    frame: frame - fadeIn[0],
    fps,
    config: { damping: 16, stiffness: 60, mass: 0.8 },
  });

  const enterScale = interpolate(introProgress, [0, 1], [0.85, 1]);
  const enterOpacity = interpolate(introProgress, [0, 1], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const enterBlur = interpolate(introProgress, [0, 1], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- EXIT (Center to Camera) ---
  const exitProgress = spring({
    frame: frame - fadeOut[0],
    fps,
    config: { damping: 18, stiffness: 75, mass: 1 },
  });

  const exitScale = interpolate(exitProgress, [0, 1], [1, 2.5]);
  // Fade out a bit faster so it disappears before getting too distorted
  const exitOpacity = interpolate(exitProgress, [0, 0.6, 1], [1, 0, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitBlur = interpolate(exitProgress, [0, 1], [0, 20], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- COMBINED CONTAINER ---
  const currentScale = isExiting ? exitScale : enterScale;
  const currentOpacity = isExiting ? exitOpacity : enterOpacity;
  const currentBlur = isExiting ? exitBlur : enterBlur;

  // --- TYPOGRAPHY STAGGERED REVEAL ---
  const eyebrowSpring = spring({
    frame: frame - fadeIn[0] - 6,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.8 },
  });

  const titleSpring = spring({
    frame: frame - fadeIn[0] - 12,
    fps,
    config: { damping: 18, stiffness: 90, mass: 0.9 },
  });

  // Typography also needs to exit cleanly
  const exitTextOpacity = interpolate(exitProgress, [0, 0.3], [1, 0], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      className="flex min-h-0 flex-col overflow-hidden font-sans text-kyar-text"
      style={{
        zIndex,
        opacity: currentOpacity,
        transform: `scale(${currentScale})`,
        filter: `blur(${currentBlur}px)`,
        pointerEvents: isExiting ? "none" : "auto",
      }}
    >
      <div className="flex w-full shrink-0 flex-col items-center px-5 pb-2 pt-[4.5%] text-center">
        <p
          className="font-sans-wide mb-2 text-[10px] font-semibold uppercase tracking-widest text-kyar-accent"
          style={{
            opacity:
              interpolate(eyebrowSpring, [0, 1], [0, 1], { extrapolateRight: "clamp" }) *
              exitTextOpacity,
            transform: `translateY(${interpolate(eyebrowSpring, [0, 1], [16, 0], { extrapolateRight: "clamp" })}px)`,
          }}
        >
          {eyebrow}
        </p>
        <h2
          className="font-serif-elegant max-w-[min(92%,42rem)] px-1 text-[clamp(1.25rem,3.8vw,2.65rem)] font-normal leading-[1.12] text-kyar-text"
          style={{
            opacity:
              interpolate(titleSpring, [0, 1], [0, 1], { extrapolateRight: "clamp" }) *
              exitTextOpacity,
            transform: `translateY(${interpolate(titleSpring, [0, 1], [24, 0], { extrapolateRight: "clamp" })}px)`,
            filter: `blur(${interpolate(titleSpring, [0, 1], [8, 0], { extrapolateRight: "clamp" })}px)`,
          }}
        >
          {title}
        </h2>
      </div>

      <div className="flex min-h-0 w-full flex-1 items-center justify-center px-3 pb-[3%] pt-1">
        <div className="flex h-full max-h-full w-full max-w-full items-center justify-center overflow-hidden">
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Scene 1 — Builds */
const SceneBuilds = () => (
  <ProductScene
    eyebrow="Builds"
    title="Every project on one screen."
    fadeIn={[0, 20]}
    fadeOut={[85, 115]}
    zIndex={3}
  >
    <AnimatedMiniAppPreview activeNav="builds" baseScale={1.12}>
      <LandingMiniBuildsPreviewContent builds={REMOTION_BUILDS} />
    </AnimatedMiniAppPreview>
  </ProductScene>
);

/** Scene 2 — Elements */
const SceneElements = () => (
  <ProductScene
    eyebrow="Elements"
    title="Your closet, ready to reuse."
    fadeIn={[0, 20]}
    fadeOut={[85, 115]}
    zIndex={2}
  >
    <AnimatedMiniAppPreview activeNav="elements" baseScale={1.08}>
      <LandingMiniElementsPreviewContent nodes={REMOTION_NODES} />
    </AnimatedMiniAppPreview>
  </ProductScene>
);

/** Scene 3 — Convention detail */
const SceneConvention = () => (
  <ProductScene
    eyebrow="Conventions"
    title="Weekend plans, day by day."
    fadeIn={[0, 20]}
    fadeOut={[115, 130]}
    zIndex={1}
  >
    <AnimatedMiniAppPreview activeNav="conventions" baseScale={1.04}>
      <ConventionLandingPreviewRemotion convention={REMOTION_CONVENTION} builds={REMOTION_BUILDS} />
    </AnimatedMiniAppPreview>
  </ProductScene>
);

export const HeroComposition = () => {
  return (
    <AbsoluteFill className="bg-kyar-bgWarm">
      <CinematicBackground />
      {/* 
        Overlapping sequences for depth transitions. 
        As the previous scene scales up and exits (Z-push), the next one scales down from behind.
      */}
      <Sequence from={0} durationInFrames={115}>
        <SceneBuilds />
      </Sequence>
      <Sequence from={85} durationInFrames={115}>
        <SceneElements />
      </Sequence>
      <Sequence from={170} durationInFrames={130}>
        <SceneConvention />
      </Sequence>
    </AbsoluteFill>
  );
};
