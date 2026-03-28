"use client";

import { useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import {
  LinkClosetItemsForm,
  type LinkClosetItemsFormHandle,
} from "@/components/builds/LinkClosetItemsForm";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";

type ClosetEntityId = Id<"closetItems"> | Id<"cosplayNodes">;

export default function BuildLinkItemsPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") as Id<"builds"> | null;
  const router = useRouter();
  const { userId } = useCurrentUser();
  const formRef = useRef<LinkClosetItemsFormHandle>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closetItems =
    (useQuery(api.cosplayNodes.list, userId ? { userId, sortBy: "name" } : "skip") ?? []) as Array<{
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
  const linkedIds = (useQuery(api.builds.getNodes, id ? { buildId: id } : "skip") ?? []) as Id<"cosplayNodes">[];

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
      <WebAppShell>
        <p className="meta-label pt-12">Missing build id.</p>
        <Link href="/builds" className="mt-4 text-sm underline">
          Back to Builds
        </Link>
      </WebAppShell>
    );
  }

  if (!userId) {
    return (
      <WebAppShell>
        <p className="meta-label pt-12">Sign in to link cosplay elements.</p>
        <Link href="/build-detail" className="mt-4 text-sm underline">
          Back
        </Link>
      </WebAppShell>
    );
  }

  return (
    <WebAppShell>
      <header className="sticky top-0 z-40 bg-kyar-bgWarm/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center justify-between">
        <Link
          href={`/build-detail?id=${id}`}
          className="text-[10px] font-semibold uppercase tracking-widest text-kyar-meta"
        >
          Cancel
        </Link>
        <p className="meta-label">Link Elements &amp; Materials</p>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="text-[10px] font-semibold uppercase tracking-widest text-black disabled:opacity-50"
        >
          Save
        </button>
      </header>

      <main className="flex-1 py-8 max-w-2xl mx-auto px-4">
        <p className="text-sm text-kyar-textTertiary mb-4">
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
          onAfterSave={() => router.push(`/build-detail?id=${id}`)}
          onError={(msg) => setError(msg)}
        />
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </main>
    </WebAppShell>
  );
}
