"use client";

import { LandingMiniAppFrame } from "@/components/landing/LandingMiniAppFrame";
import { LandingBuildTrackingMock } from "@/components/landing/LandingBuildTrackingMock";
import type { MockBuildTask } from "@/data/mockAccount";

/** Inner Tasks / construction UI — use inside {@link LandingMiniAppFrame}. */
export function LandingMiniBuildTrackingPreviewContent({ tasks }: { tasks: MockBuildTask[] }) {
  return (
    <>
      <p className="mb-3 font-serif-elegant text-lg text-kyar-text">Build · Construction</p>
      <div className="max-w-xl">
        <LandingBuildTrackingMock tasks={tasks} interactive />
      </div>
    </>
  );
}

export function LandingMiniBuildTrackingPreview({ tasks }: { tasks: MockBuildTask[] }) {
  return (
    <LandingMiniAppFrame activeNav="tasks">
      <LandingMiniBuildTrackingPreviewContent tasks={tasks} />
    </LandingMiniAppFrame>
  );
}
