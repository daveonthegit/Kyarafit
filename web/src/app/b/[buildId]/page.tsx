"use client";

import { useParams } from "next/navigation";
import type { Id } from "convex/_generated/dataModel";
import { PublicBuildDetailView } from "@/components/builds/PublicBuildDetailView";

export default function PublicBuildPage() {
  const params = useParams();
  const buildId = typeof params.buildId === "string" ? (params.buildId as Id<"builds">) : null;

  if (!buildId) {
    return null;
  }

  return (
    <PublicBuildDetailView
      mode="public"
      buildId={buildId}
      backHref="/discover"
      backLabel="Discover"
    />
  );
}
