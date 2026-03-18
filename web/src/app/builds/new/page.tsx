"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "convex/react";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import type { BuildStatus } from "@kyarafit/design-system/types";
import { ImageUpload } from "@/components/ui/ImageUpload";

const STATUSES: BuildStatus[] = ["idea", "wip", "ready", "archived"];

export default function NewBuildPage() {
  const router = useRouter();
  const { userId } = useCurrentUser();
  const createBuild = useMutation(api.builds.create);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<BuildStatus>("idea");
  const [imageStorageId, setImageStorageId] = useState<Id<"_storage"> | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [budgetCents, setBudgetCents] = useState<string>("");
  const [isPending, setIsPending] = useState(false);

  const hasImage = imageStorageId != null || imageUrl.trim() !== "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !userId || (!imageStorageId && !imageUrl.trim())) return;
    setIsPending(true);
    try {
      const build = await createBuild({
        userId,
        name: name.trim(),
        status,
        imageStorageId: imageStorageId ?? undefined,
        imageUrl: imageUrl.trim() || undefined,
        budgetCents: budgetCents.trim() ? Math.round(parseFloat(budgetCents) * 100) : undefined,
      });
      if (build) router.push(`/build-detail?id=${build._id}`);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <WebAppShell>
      <header className="sticky top-0 z-40 bg-kyar-bgWarm/95 backdrop-blur-sm pt-12 pb-4 border-b border-kyar-borderSubtle flex items-center gap-4">
        <Link href="/builds" className="material-symbols-outlined font-light text-2xl">
          arrow_back
        </Link>
        <p className="meta-label">New Build</p>
      </header>

      <main className="flex-1 py-8">
        <form onSubmit={submit} className="space-y-6">
          <div>
            <label className="block meta-label mb-2">NAME</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Arlecchino"
              className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
            />
          </div>
          <div>
            <label className="block meta-label mb-2">IMAGE (REQUIRED)</label>
            <ImageUpload
              category="builds"
              onImageSelected={(result) => {
                if ("imageStorageId" in result && result.imageStorageId) {
                  setImageStorageId(result.imageStorageId);
                  setImageUrl("");
                } else {
                  setImageUrl(result.imageUrl ?? "");
                  setImageStorageId(null);
                }
              }}
              currentImage={imageUrl || undefined}
              currentStorageId={imageStorageId ?? undefined}
            />
            {!hasImage && (
              <p className="text-xs text-kyar-textTertiary mt-2">
                An image is required to create a build
              </p>
            )}
          </div>
          <div>
            <label className="block meta-label mb-2">BUDGET $ (OPTIONAL)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={budgetCents}
              onChange={(e) => setBudgetCents(e.target.value)}
              placeholder="0.00"
              className="w-full border-0 border-b border-black bg-transparent py-3 text-base placeholder:text-kyar-textTertiary focus:outline-none focus:border-kyar-accent"
            />
          </div>
          <div>
            <label className="block meta-label mb-2">STATUS</label>
            <div className="flex gap-3 mt-2">
              {STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={`px-4 py-2.5 text-xs font-semibold uppercase tracking-wider border ${
                    status === s
                      ? "border-black bg-kyar-muted text-black"
                      : "border-kyar-border text-kyar-textTertiary hover:border-black"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <button
            type="submit"
            disabled={isPending || !name.trim() || !hasImage}
            className="w-full bg-black text-white py-3.5 text-[11px] font-bold uppercase tracking-wider disabled:opacity-50"
          >
            CREATE BUILD
          </button>
        </form>
      </main>
    </WebAppShell>
  );
}
