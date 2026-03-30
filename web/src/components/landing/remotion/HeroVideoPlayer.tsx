"use client";

import { Player } from "@remotion/player";
import { HeroComposition } from "./HeroComposition";

// A cinematic wrapper that ensures the Remotion player is styled seamlessly
export function HeroVideoPlayer() {
  return (
    <div className="w-full h-full bg-[#0A0A0A] overflow-hidden rounded-lg sm:rounded-2xl relative">
      {/* We use aspect ratio matching the composition to ensure it fills nicely without letterboxing artifacts in our layout */}
      <Player
        component={HeroComposition}
        durationInFrames={300} // 10 seconds at 30fps
        compositionWidth={1920}
        compositionHeight={1080}
        fps={30}
        autoPlay
        loop
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          top: 0,
          left: 0,
        }}
        controls={false}
        showVolumeControls={false}
      />
    </div>
  );
}
