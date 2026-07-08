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
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55">
          Timeline
        </p>
        <h2 id="build-progress-heading" className="mt-2 font-serif italic text-2xl">
          Progress updates
        </h2>
      </div>

      <form
        onSubmit={handleSubmit}
        aria-label="Add progress update"
        className="space-y-4 rounded-glass border border-glass-border bg-glass-active p-5"
      >
        <div>
          <label
            htmlFor="progress-note"
            className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55"
          >
            Note
          </label>
          <textarea
            id="progress-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="What progress did you make?"
            className="glass-field w-full resize-y px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-kyar-accent"
          />
        </div>

        <div>
          <label
            htmlFor="progress-percent"
            className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-media-fg-55"
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
            className="glass-field w-32 min-h-[44px] px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-kyar-accent"
          />
        </div>

        {canPublish ? (
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={publishWanted}
              onChange={(e) => setPublishWanted(e.target.checked)}
              className="h-4 w-4 accent-kyar-media-fg focus-visible:ring-2 focus-visible:ring-kyar-accent"
            />
            <span>Publish to feed</span>
          </label>
        ) : (
          <div
            role="note"
            aria-label="Publishing requires a paid plan"
            className="rounded-[10px] border border-glass-border bg-glass-bar p-4"
          >
            <p className="mb-2 text-sm text-media-fg-70">
              Publishing a progress update to the public feed is a paid feature. Your update is
              still saved privately to this build&apos;s timeline.
            </p>
            <Link
              href="/settings/subscription"
              className="inline-flex min-h-[44px] items-center rounded-sm text-[10px] font-bold uppercase tracking-[0.16em] text-kyar-media-fg border-b border-glass-border-strong hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            >
              Upgrade to publish
            </Link>
          </div>
        )}

        {error ? (
          <p role="alert" className="text-sm text-on-glass-danger">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || !userId}
          className="min-h-[44px] w-full rounded-full bg-glass-solid px-4 py-3 text-[10px] font-bold uppercase tracking-[0.16em] text-glass-ink transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent disabled:opacity-50"
        >
          {submitting ? "Adding…" : "Add update"}
        </button>
      </form>

      {isLoading ? (
        <p className="text-sm text-media-fg-55">Loading progress updates…</p>
      ) : updates.length === 0 ? (
        <div className="rounded-glass border border-glass-border p-8 text-center">
          <p className="font-serif italic text-lg">No progress updates yet</p>
          <p className="mt-2 text-sm text-media-fg-55">
            Add your first update above to start a dated timeline of your build.
          </p>
        </div>
      ) : (
        <ol className="space-y-6">
          {updates.map((update) => (
            <li
              key={update.id}
              className="relative border-l-2 border-[rgb(255_253_248/0.2)] pl-5 before:absolute before:-left-[5px] before:top-1.5 before:h-2 before:w-2 before:rounded-full before:bg-kyar-media-fg"
            >
              <div className="flex flex-wrap items-baseline gap-3">
                <time
                  dateTime={new Date(update.createdAt).toISOString()}
                  className="text-[10px] font-semibold uppercase tracking-[0.16em] text-media-fg-55"
                >
                  {formatUpdateDate(update.createdAt)}
                </time>
                {typeof update.progressPercent === "number" ? (
                  <span className="rounded-full bg-on-glass-chip-neutral-bg px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-on-glass-chip-neutral-fg">
                    {update.progressPercent}%
                  </span>
                ) : null}
                {update.publishedToFeed ? (
                  <span className="rounded-full bg-on-glass-chip-done-bg px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-on-glass-chip-done-fg">
                    Published
                  </span>
                ) : null}
              </div>

              {update.note ? (
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-media-fg-70">
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
