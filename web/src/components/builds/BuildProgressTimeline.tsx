"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useOfflineMutation, useOfflineQuery } from "@/lib/offline";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import { sortProgressUpdates } from "@kyarafit/design-system/domain/mediaGallery";
import { can } from "@kyarafit/design-system/domain/entitlements";
import { useFeatureAccess } from "@/lib/api/useTier";
import { ResolvedImage } from "@/components/ui/ResolvedImage";

export interface BuildProgressTimelineProps {
  buildId: Id<"builds">;
  userId: string | null;
}

function formatUpdateDate(createdAt: number): string {
  return new Date(createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Build "Progress updates" timeline (PRODUCT_SPEC.md §4.3 REQ-049, AC-07; DESIGN_SYSTEM.md §5).
 * Renders dated entries newest-first via the shared `sortProgressUpdates` ordering, an empty state
 * that invites the first entry, and an add form. Adding a private timeline entry is FREE; publishing
 * an update to the social feed is PAID (gated by `can(tier, "social_post")`) — the publish toggle is
 * shown to everyone but free users get a non-blocking upgrade hint and we never send `publish: true`.
 */
export function BuildProgressTimeline({ buildId, userId }: BuildProgressTimelineProps) {
  const { tier } = useFeatureAccess();
  const canPublish = can(tier, "social_post");

  const rows = useOfflineQuery(
    api.buildProgressUpdates.listByBuild,
    userId ? { buildId, userId } : "skip"
  );
  const addUpdate = useOfflineMutation(api.buildProgressUpdates.add);

  const updates = useMemo(() => sortProgressUpdates(rows ?? []), [rows]);

  const [note, setNote] = useState("");
  const [progressPercent, setProgressPercent] = useState("");
  const [publishWanted, setPublishWanted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoading = userId != null && rows === undefined;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId || submitting) return;

    const trimmedNote = note.trim();
    const percentRaw = progressPercent.trim();
    const parsedPercent = percentRaw === "" ? undefined : Number(percentRaw);

    if (!trimmedNote && parsedPercent === undefined) {
      setError("Add a note or a progress percentage.");
      return;
    }
    if (parsedPercent !== undefined && Number.isNaN(parsedPercent)) {
      setError("Progress percentage must be a number.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await addUpdate({
        buildId,
        userId,
        note: trimmedNote || undefined,
        progressPercent: parsedPercent,
        // Never request publishing for free users — gating is enforced client- and server-side.
        publish: canPublish && publishWanted ? true : undefined,
      });
      setNote("");
      setProgressPercent("");
      setPublishWanted(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add progress update.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-labelledby="build-progress-heading" className="space-y-8">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary">Timeline</p>
        <h2 id="build-progress-heading" className="mt-2 font-serif text-2xl text-kyar-text">
          Progress updates
        </h2>
      </div>

      <form
        onSubmit={handleSubmit}
        aria-label="Add progress update"
        className="space-y-4 rounded-[24px] border border-kyar-borderSubtle bg-kyar-surface p-5"
      >
        <div>
          <label
            htmlFor="progress-note"
            className="mb-2 block text-[10px] font-medium uppercase tracking-[0.2em] text-kyar-textTertiary"
          >
            Note
          </label>
          <textarea
            id="progress-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What progress did you make?"
            className="w-full resize-y rounded-lg border border-kyar-border bg-transparent px-3 py-2 text-sm text-kyar-text placeholder:text-kyar-textTertiary focus:border-kyar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
          />
        </div>

        <div>
          <label
            htmlFor="progress-percent"
            className="mb-2 block text-[10px] font-medium uppercase tracking-[0.2em] text-kyar-textTertiary"
          >
            Progress % (optional)
          </label>
          <input
            id="progress-percent"
            type="number"
            min={0}
            max={100}
            value={progressPercent}
            onChange={(e) => setProgressPercent(e.target.value)}
            placeholder="0–100"
            className="w-32 min-h-[44px] rounded-lg border border-kyar-border bg-transparent px-3 py-2 text-sm text-kyar-text placeholder:text-kyar-textTertiary focus:border-kyar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
          />
        </div>

        {canPublish ? (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm text-kyar-text">
            <input
              type="checkbox"
              checked={publishWanted}
              onChange={(e) => setPublishWanted(e.target.checked)}
              className="h-4 w-4 focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
            />
            <span>Publish to feed</span>
          </label>
        ) : (
          <div
            role="note"
            aria-label="Publishing requires a paid plan"
            className="rounded-lg border border-kyar-borderSubtle bg-kyar-muted p-4"
          >
            <p className="mb-2 text-sm text-kyar-text">
              Publishing a progress update to the public feed is a paid feature. Your update is
              still saved privately to this build&apos;s timeline.
            </p>
            <Link
              href="/settings/subscription"
              className="inline-flex min-h-[44px] items-center rounded-sm text-[11px] font-semibold uppercase tracking-widest text-kyar-accent hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
            >
              Upgrade to publish
            </Link>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !userId}
          className="min-h-[44px] w-full rounded-sm bg-kyar-text px-4 py-3 text-xs font-bold uppercase tracking-widest text-kyar-bg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add update"}
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-kyar-textTertiary">Loading progress updates…</p>
      ) : updates.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-kyar-borderSubtle bg-kyar-surface p-8 text-center">
          <p className="font-serif text-lg text-kyar-text">No progress updates yet</p>
          <p className="mt-2 text-sm text-kyar-textTertiary">
            Add your first update above to start a dated timeline of your build.
          </p>
        </div>
      ) : (
        <ol className="space-y-6">
          {updates.map((update) => (
            <li key={update.id} className="border-l-2 border-kyar-text/20 pl-5">
              <div className="flex flex-wrap items-baseline gap-3">
                <time
                  dateTime={new Date(update.createdAt).toISOString()}
                  className="text-[11px] font-medium uppercase tracking-widest text-kyar-textTertiary"
                >
                  {formatUpdateDate(update.createdAt)}
                </time>
                {typeof update.progressPercent === "number" ? (
                  <span className="rounded-full border border-kyar-borderSubtle px-2 py-0.5 text-[10px] uppercase tracking-widest text-kyar-text">
                    {update.progressPercent}%
                  </span>
                ) : null}
                {update.publishedToFeed ? (
                  <span className="rounded-full border border-kyar-accent/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-kyar-accent">
                    Published
                  </span>
                ) : null}
              </div>

              {update.note ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-kyar-textSecondary">
                  {update.note}
                </p>
              ) : null}

              {update.imageRefs.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-3">
                  {update.imageRefs.map((ref, index) => {
                    if (ref.kind === "cloud") {
                      return (
                        <ResolvedImage
                          key={index}
                          imageStorageId={ref.storageId}
                          alt="Progress update image"
                          className="h-24 w-24 rounded-md object-cover"
                        />
                      );
                    }
                    const src = ref.kind === "url" ? ref.url : ref.uri;
                    return (
                      <img
                        key={index}
                        src={src}
                        alt="Progress update image"
                        className="h-24 w-24 rounded-md object-cover"
                      />
                    );
                  })}
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
