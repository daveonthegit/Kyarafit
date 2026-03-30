import { Composition } from "remotion";
import { HeroComposition } from "../components/landing/remotion/HeroComposition";

export function RemotionRoot() {
  return (
    <Composition
      id="LandingHero"
      component={HeroComposition}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
    />
  );
}
