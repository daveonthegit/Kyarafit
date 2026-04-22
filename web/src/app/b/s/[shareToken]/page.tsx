"use client";

import { useParams } from "next/navigation";
import { PublicBuildDetailView } from "@/components/builds/PublicBuildDetailView";

export default function UnlistedBuildPage() {
  const params = useParams();
  const shareToken = typeof params.shareToken === "string" ? params.shareToken : "";

  if (!shareToken) {
    return null;
  }

  return (
    <PublicBuildDetailView mode="share" shareToken={shareToken} backHref="/home" backLabel="Home" />
  );
}
