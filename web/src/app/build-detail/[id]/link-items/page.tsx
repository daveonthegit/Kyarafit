"use client";

import { useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useOfflineQuery } from "@/lib/offline";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { PhotoPill } from "@/components/ui/PhotoPill";
import {
  LinkClosetItemsForm,
  type LinkClosetItemsFormHandle,
} from "@/components/builds/LinkClosetItemsForm";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

export default function BuildLinkItemsPage() {
  const params = useParams();
  const rawId = params.id;
  const id =
    typeof rawId === "string"
      ? (rawId as Id<"builds">)
      : Array.isArray(rawId)
        ? (rawId[0] as Id<"builds">)
        : null;
  const router = useRouter();
  const { userId } = useCurrentUser();
  const formRef = useRef<LinkClosetItemsFormHandle>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closetItems = (useOfflineQuery(
    api.cosplayNodes.list,
    userId ? { userId, sortBy: "name" } : "skip"
  ) ?? []) as Array<{
    _id: Id<"cosplayNodes">;
    name: string;
    category?: string;
    tags?: string[];
    _creationTime?: number;
    nodeType?: "element" | "material";
    overallBucket?: "incomplete" | "in_progress" | "complete";
    progressPercent?: number;
    childCount?: number;
    hasIncompleteDescendants?: boolean;
    purchaseStatus?: string | null;
    buildStatus?: string | null;
    materialStatus?: string | null;
    totalCostCents?: number | null;
  }>;
  const linkedIds = (useOfflineQuery(api.builds.getNodes, id ? { buildId: id } : "skip") ??
    []) as Id<"cosplayNodes">[];

  const closetRows = closetItems.map((c) => ({
    _id: c._id,
    name: c.name,
    category: c.category ?? "",
    tags: c.tags ?? [],
    _creationTime: c._creationTime,
    nodeType: c.nodeType,
    overallBucket: c.overallBucket,
    progressPercent: c.progressPercent,
    childCount: c.childCount,
    hasIncompleteDescendants: c.hasIncompleteDescendants,
    purchaseStatus: c.purchaseStatus,
    buildStatus: c.buildStatus,
    materialStatus: c.materialStatus,
    totalCostCents: c.totalCostCents,
  }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await formRef.current?.save();
    } catch {
      setError("Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!id) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex flex-1 flex-col items-center justify-center bg-studio-wall px-4 py-16 text-center text-kyar-media-fg">
          <div className="w-full max-w-md rounded-glass border border-glass-border bg-glass p-8 backdrop-blur-glass">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
              Missing build id.
            </p>
            <Link
              href="/builds"
              className="mt-5 inline-flex min-h-[44px] items-center text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg underline decoration-glass-border-strong underline-offset-4 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            >
              Back to Builds
            </Link>
          </div>
        </div>
      </WebAppShell>
    );
  }

  if (!userId) {
    return (
      <WebAppShell fullBleed>
        <div className="relative flex flex-1 flex-col items-center justify-center bg-studio-wall px-4 py-16 text-center text-kyar-media-fg">
          <div className="w-full max-w-md rounded-glass border border-glass-border bg-glass p-8 backdrop-blur-glass">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
              Sign in to link cosplay elements.
            </p>
            <Link
              href="/builds"
              className="mt-5 inline-flex min-h-[44px] items-center text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg underline decoration-glass-border-strong underline-offset-4 transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            >
              Back to Builds
            </Link>
          </div>
        </div>
      </WebAppShell>
    );
  }

  return (
    <WebAppShell fullBleed>
      <div className="relative flex flex-1 flex-col bg-studio-wall px-4 pb-16 pt-6 text-kyar-media-fg sm:px-6 lg:px-10">
        <div className="mx-auto flex w-full max-w-2xl flex-col rounded-glass border border-glass-border bg-glass backdrop-blur-glass">
          <header className="flex items-center justify-between gap-3 border-b border-glass-divider-strong px-4 py-3 sm:px-6">
            <Link
              href={`/build-detail/${id}`}
              className="inline-flex min-h-[44px] items-center px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 underline decoration-glass-border-strong underline-offset-4 transition-colors hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            >
              Cancel
            </Link>
            <p className="min-w-0 truncate text-center text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-70">
              Link Elements &amp; Materials
            </p>
            <PhotoPill type="button" variant="solid" onClick={save} disabled={saving}>
              Save
            </PhotoPill>
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6">
            <p className="mb-4 text-sm leading-relaxed text-media-fg-70">
              Select elements and materials to include in this build. Drag into the zone or tap to
              toggle. They will appear in packing lists when this build is assigned to a day.
            </p>
            <LinkClosetItemsForm
              ref={formRef}
              buildId={id}
              userId={userId}
              closetItems={closetRows}
              linkedIds={linkedIds}
              isActive
              enableDragDrop
              allowCreate
              onAfterSave={() => router.push(`/build-detail/${id}`)}
              onError={(msg) => setError(msg)}
            />
            {error && (
              <p className="mt-3 text-sm text-on-glass-danger" role="alert">
                {error}
              </p>
            )}
          </main>
        </div>
      </div>
    </WebAppShell>
  );
}
