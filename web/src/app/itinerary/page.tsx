"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Id } from "convex/_generated/dataModel";

/**
 * Itinerary is now the convention detail page. Redirect so existing links still work:
 * - /itinerary?conventionId=id → /conventions/id
 * - /itinerary (no convention) → /planner (Conventions tab)
 */
export default function ItineraryRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const conventionId = searchParams.get("conventionId") as Id<"conventions"> | null;

  useEffect(() => {
    if (conventionId) {
      router.replace(`/conventions/${conventionId}`);
    } else {
      router.replace("/planner");
    }
  }, [router, conventionId]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <p className="text-sm text-kyar-textTertiary">Redirecting…</p>
    </div>
  );
}
