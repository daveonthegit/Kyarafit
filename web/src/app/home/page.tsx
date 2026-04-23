"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "convex/_generated/dataModel";
import { BuildHeroCropModal } from "@/components/builds/BuildHeroCropModal";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { PageHeader } from "@/components/layout/PageHeader";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { SectionCard } from "@/components/ui/SectionCard";
import { MagicCard } from "@/components/ui/magic-card";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";

/** Build shape returned by getFocusedOrMostRecentForUser (hero display). */
type FocusedBuild = {
  _id: Id<"builds">;
  name: string;
  character?: string;
  imageStorageId?: Id<"_storage">;
  imageUrl?: string;
  imageFocalX?: number;
  imageFocalY?: number;
  tasksChecked: number;
  tasksTotal: number;
};

function daysUntil(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function HomePage() {
  const { userId } = useCurrentUser();
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");
  const focusedBuildId = useQuery(
    api.users.getFocusedBuildId,
    userId ? { externalId: userId } : "skip"
  );
  const focusedOrRecent = useQuery(
    api.builds.getFocusedOrMostRecentForUser,
    userId ? { userId } : "skip"
  );
  const recentBuild = focusedOrRecent as FocusedBuild | null | undefined;
  const setFocusedBuild = useMutation(api.users.setFocusedBuild);
  const eventForBuild = useQuery(
    api.conventions.getEventForBuild,
    userId && recentBuild ? { buildId: recentBuild._id, userId } : "skip"
  );
  const upcomingWithCounts = useQuery(
    api.conventions.listUpcomingWithPlanCounts,
    userId ? { userId, limit: 10 } : "skip"
  );
  const builds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];
  const updateBuild = useMutation(api.builds.update);

  const recentProjectsList = useMemo(() => {
    const excluded = recentBuild ? builds.filter((b) => b._id !== recentBuild._id) : [...builds];
    const withCreation = excluded as Array<(typeof builds)[number] & { _creationTime?: number }>;
    const sorted = [...withCreation].sort(
      (a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0)
    );
    return sorted.slice(0, 10);
  }, [builds, recentBuild]);

  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [focusSearch, setFocusSearch] = useState("");
  const focusSearchInputRef = useRef<HTMLInputElement>(null);

  const [buildToCrop, setBuildToCrop] = useState<(typeof builds)[number] | null>(null);
  const cropBuildImageUrl = useQuery(
    api.files.getUrl,
    buildToCrop?.imageStorageId ? { storageId: buildToCrop.imageStorageId } : "skip"
  );
  const cropImageSrc =
    (buildToCrop?.imageStorageId ? cropBuildImageUrl : buildToCrop?.imageUrl) ?? "";
  const [cropError, setCropError] = useState<string | null>(null);

  const filteredBuildsForFocus = useMemo(() => {
    const q = focusSearch.trim().toLowerCase();
    if (!q) return builds;
    return builds.filter(
      (b) => b.name.toLowerCase().includes(q) || (b.character ?? "").toLowerCase().includes(q)
    );
  }, [builds, focusSearch]);

  const openFocusModal = useCallback(() => {
    setFocusSearch("");
    setIsFocusModalOpen(true);
  }, []);

  const closeFocusModal = useCallback(() => {
    setIsFocusModalOpen(false);
  }, []);

  const selectFocus = useCallback(
    (buildId: Id<"builds"> | undefined) => {
      setFocusedBuild({ buildId });
      closeFocusModal();
    },
    [setFocusedBuild, closeFocusModal]
  );

  useEffect(() => {
    if (!isFocusModalOpen) return;
    const t = setTimeout(() => focusSearchInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [isFocusModalOpen]);

  useEffect(() => {
    if (!isFocusModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeFocusModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isFocusModalOpen, closeFocusModal]);

  const openCropForBuild = useCallback((e: React.MouseEvent, build: (typeof builds)[number]) => {
    e.preventDefault();
    e.stopPropagation();
    if (build.imageStorageId != null || build.imageUrl != null) {
      setCropError(null);
      setBuildToCrop(build);
    }
  }, []);

  const closeCropModal = useCallback(() => {
    setBuildToCrop(null);
    setCropError(null);
  }, []);

  const handleHeroCropConfirm = useCallback(
    (focalPoint: { x: number; y: number }) => {
      if (!buildToCrop || !userId) return;
      setCropError(null);
      updateBuild({
        id: buildToCrop._id,
        userId,
        imageFocalX: focalPoint.x,
        imageFocalY: focalPoint.y,
      })
        .then(() => closeCropModal())
        .catch((err) =>
          setCropError(err instanceof Error ? err.message : "Failed to save position")
        );
    },
    [buildToCrop, userId, updateBuild, closeCropModal]
  );

  return (
    <WebAppShell>
      <div className="min-h-[100dvh] lg:h-[100dvh] flex flex-col lg:overflow-hidden pt-4 sm:pt-6">
        <PageHeader
          title={t("theLookbook")}
          className="shrink-0 pb-4 pt-0 sm:pt-0 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto w-full"
          trailing={
            <Link
              href="/settings"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-kyar-text hover:bg-kyar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
              aria-label={tCommon("settings")}
            >
              <span className="material-symbols-outlined font-light text-2xl">menu</span>
            </Link>
          }
        />

        <main className="flex-1 lg:min-h-0 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 pb-4 flex flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6 flex-1 lg:min-h-0 lg:h-full">
            {/* 1. Featured build hero (2x2) */}
            <section className="lg:col-span-2 lg:row-span-2 flex flex-col min-h-[400px] lg:h-full lg:min-h-0">
              <MagicCard className="flex-1 overflow-hidden border border-kyar-borderSubtle rounded-2xl shadow-soft flex flex-col min-h-0">
                <Link
                  href={recentBuild ? `/build-detail/${recentBuild._id}` : "/builds"}
                  className="flex-1 block group flex flex-col min-h-0"
                  aria-label={
                    recentBuild
                      ? t("currentFocusAria", { name: recentBuild.name })
                      : t("viewBuildsAria")
                  }
                >
                  <div className="relative w-full flex-1 min-h-0 bg-kyar-muted rounded-t-2xl overflow-hidden">
                    {recentBuild?.imageStorageId || recentBuild?.imageUrl ? (
                      <ResolvedImage
                        imageStorageId={recentBuild.imageStorageId}
                        imageUrl={recentBuild.imageUrl}
                        alt={recentBuild.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        style={{
                          objectPosition:
                            recentBuild.imageFocalX != null && recentBuild.imageFocalY != null
                              ? `${recentBuild.imageFocalX * 100}% ${recentBuild.imageFocalY * 100}%`
                              : "center",
                        }}
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary">
                        <span className="material-symbols-outlined text-6xl sm:text-7xl">
                          photo_library
                        </span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-kyar-media-scrim-faint" aria-hidden />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-kyar-media-fg sm:p-6">
                      <span className="mb-2 inline-block rounded-sm border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-kyar-media-fg backdrop-blur-sm sm:text-xs">
                        {t("currentFocus")}
                      </span>
                      <p className="font-serif text-xl font-normal italic drop-shadow-md sm:text-2xl lg:text-4xl">
                        {recentBuild ? recentBuild.name : t("addBuildsToFeature")}
                      </p>
                      {recentBuild && (
                        <>
                          <p className="text-xs sm:text-sm mt-1 opacity-90">
                            {t("itemsComplete", {
                              checked: recentBuild.tasksChecked,
                              total: recentBuild.tasksTotal,
                            })}
                            {recentBuild.character ? ` · ${recentBuild.character}` : ""}
                          </p>
                          {eventForBuild && (
                            <p className="text-[10px] sm:text-xs mt-1 opacity-90 uppercase tracking-wider">
                              {t("plannedFor", { name: eventForBuild.name })}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </Link>
                {recentBuild && recentBuild.tasksTotal > 0 && (
                  <div className="px-4 sm:px-6 pb-3 pt-0 shrink-0 bg-kyar-surface">
                    <div
                      className="h-1.5 w-full bg-kyar-borderSubtle rounded-full overflow-hidden"
                      role="progressbar"
                      aria-valuenow={recentBuild.tasksChecked}
                      aria-valuemin={0}
                      aria-valuemax={recentBuild.tasksTotal}
                    >
                      <div
                        className="h-full bg-kyar-text rounded-full transition-[width] duration-300"
                        style={{
                          width: `${(100 * recentBuild.tasksChecked) / recentBuild.tasksTotal}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </MagicCard>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[10px] uppercase tracking-widest text-kyar-meta">
                    {recentBuild ? t("yourMostRecentBuild") : t("createBuildToSee")}
                  </p>
                  {builds.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={openFocusModal}
                        className="text-[10px] font-semibold uppercase tracking-widest text-kyar-text underline decoration-kyar-meta underline-offset-2 hover:decoration-kyar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
                        aria-label={t("selectFocus")}
                      >
                        {t("selectFocus")}
                      </button>
                      <AdaptiveModal
                        open={isFocusModalOpen}
                        onClose={closeFocusModal}
                        aria-labelledby="focus-modal-title"
                      >
                        <div className="flex flex-col max-h-[90vh]">
                          <div className="flex items-center justify-between gap-3 border-b border-kyar-borderSubtle px-4 py-3 shrink-0">
                            <h2
                              id="focus-modal-title"
                              className="font-serif text-lg italic font-normal text-kyar-text"
                            >
                              {t("selectFocus")}
                            </h2>
                            <button
                              type="button"
                              onClick={closeFocusModal}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-kyar-text hover:bg-kyar-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                              aria-label="Close"
                            >
                              <span className="material-symbols-outlined font-light text-xl">
                                close
                              </span>
                            </button>
                          </div>
                          <div className="p-3 border-b border-kyar-borderSubtle shrink-0">
                            <input
                              ref={focusSearchInputRef}
                              type="search"
                              value={focusSearch}
                              onChange={(e) => setFocusSearch(e.target.value)}
                              placeholder={t("searchBuildsPlaceholder")}
                              className="w-full rounded-sm border border-kyar-borderSubtle bg-kyar-bg px-3 py-2 text-sm text-kyar-text placeholder:text-kyar-meta focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                              aria-label={t("selectFocus")}
                            />
                          </div>
                          <ul className="overflow-auto flex-1 min-h-0 p-3 space-y-1" role="listbox">
                            <li role="option">
                              <button
                                type="button"
                                onClick={() => selectFocus(undefined)}
                                className="w-full flex items-center gap-3 p-3 rounded-sm border border-kyar-borderSubtle hover:border-kyar-text hover:bg-kyar-muted text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                              >
                                <span className="w-12 h-12 shrink-0 rounded-sm bg-kyar-muted flex items-center justify-center text-kyar-textTertiary">
                                  <span className="material-symbols-outlined text-2xl">
                                    schedule
                                  </span>
                                </span>
                                <span className="font-serif italic text-kyar-text">
                                  {t("defaultFocus")}
                                </span>
                              </button>
                            </li>
                            {filteredBuildsForFocus.map((b) => {
                              const hasImage = b.imageStorageId != null || b.imageUrl != null;
                              return (
                                <li key={b._id} role="option">
                                  <div className="flex items-center gap-1 rounded-sm border border-kyar-borderSubtle hover:border-kyar-text hover:bg-kyar-muted overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() => selectFocus(b._id)}
                                      className="flex-1 flex items-center gap-3 p-3 min-w-0 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-inset"
                                    >
                                      <div className="w-12 h-12 shrink-0 rounded-sm overflow-hidden bg-kyar-muted">
                                        {hasImage ? (
                                          <ResolvedImage
                                            imageStorageId={b.imageStorageId ?? undefined}
                                            imageUrl={b.imageUrl ?? undefined}
                                            alt={b.name}
                                            className="w-full h-full object-cover"
                                          />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-kyar-textTertiary">
                                            <span className="material-symbols-outlined text-2xl">
                                              photo_library
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="font-serif italic text-kyar-text truncate">
                                          {b.name}
                                        </p>
                                        <p className="text-[10px] uppercase tracking-wider text-kyar-meta mt-0.5">
                                          {b.tasksChecked} / {b.tasksTotal} tasks
                                          {b.character ? ` · ${b.character}` : ""}
                                        </p>
                                      </div>
                                      {focusedBuildId === b._id && (
                                        <span
                                          className="material-symbols-outlined text-kyar-text shrink-0"
                                          aria-hidden
                                        >
                                          check
                                        </span>
                                      )}
                                    </button>
                                    {hasImage && (
                                      <button
                                        type="button"
                                        onClick={(e) => openCropForBuild(e, b)}
                                        className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-kyar-meta hover:text-kyar-text hover:bg-kyar-borderSubtle transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                                        aria-label={t("adjustCrop")}
                                        title={t("adjustCrop")}
                                      >
                                        <span className="material-symbols-outlined text-xl">
                                          crop
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                            {filteredBuildsForFocus.length === 0 && (
                              <li className="py-4 text-center text-sm text-kyar-textTertiary">
                                {t("noBuildsMatch")}
                              </li>
                            )}
                          </ul>
                        </div>
                      </AdaptiveModal>
                      <BuildHeroCropModal
                        open={!!buildToCrop && !!cropImageSrc}
                        imageSrc={cropImageSrc}
                        buildName={buildToCrop?.name ?? ""}
                        initialFocal={
                          buildToCrop?.imageFocalX != null && buildToCrop?.imageFocalY != null
                            ? {
                                x: buildToCrop.imageFocalX,
                                y: buildToCrop.imageFocalY,
                              }
                            : null
                        }
                        onClose={closeCropModal}
                        onConfirm={handleHeroCropConfirm}
                        onError={setCropError}
                        error={cropError}
                      />
                    </>
                  )}
                </div>
                <Link
                  href={recentBuild ? `/build-detail/${recentBuild._id}` : "/builds"}
                  className="text-[10px] font-semibold uppercase tracking-widest border border-kyar-text px-4 py-2.5 min-h-[44px] inline-flex items-center rounded-sm text-kyar-text hover:bg-kyar-text hover:text-kyar-bg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
                >
                  {recentBuild ? t("continueEditing") : t("viewBuilds")}
                </Link>
              </div>
            </section>

            {/* 2. Upcoming events (2x1 top right) */}
            <SectionCard
              title={t("upcomingEvents")}
              action={
                upcomingWithCounts && upcomingWithCounts.length > 0
                  ? { label: t("viewAllEvents"), href: "/conventions" }
                  : undefined
              }
              className="lg:col-span-2 lg:row-span-1 flex flex-col min-h-[240px] lg:min-h-0 bg-kyar-surface border-none shadow-none"
            >
              {upcomingWithCounts && upcomingWithCounts.length > 0 ? (
                <div className="flex-1 min-h-0 overflow-x-auto flex gap-4 pb-2 snap-x px-1 items-stretch -mx-4 px-4 sm:-mx-5 sm:px-5">
                  {upcomingWithCounts.map(({ convention, outfitCount }) => {
                    const days = daysUntil(convention.startDate);
                    const dayLabel =
                      days === 0
                        ? t("today")
                        : days === 1
                          ? t("tomorrow")
                          : t("daysLeft", { count: days });
                    const hasImage =
                      convention.imageStorageId != null || convention.imageUrl != null;
                    return (
                      <Link
                        key={convention._id}
                        href={`/conventions/${convention._id}`}
                        className="snap-start shrink-0 w-[240px] flex flex-col rounded-2xl overflow-hidden border border-kyar-borderSubtle bg-kyar-surface hover:border-kyar-text hover:shadow-soft transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
                      >
                        {hasImage ? (
                          <div className="h-[120px] w-full bg-kyar-muted relative shrink-0">
                            <ResolvedImage
                              imageStorageId={convention.imageStorageId ?? undefined}
                              imageUrl={convention.imageUrl ?? undefined}
                              alt={convention.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-[120px] w-full bg-kyar-muted relative shrink-0 flex items-center justify-center">
                            <span className="material-symbols-outlined text-kyar-textTertiary text-4xl">
                              calendar_today
                            </span>
                          </div>
                        )}
                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-kyar-meta">
                              {convention.startDate === convention.endDate
                                ? convention.startDate
                                : `${convention.startDate} – ${convention.endDate}`}
                            </p>
                            <p className="font-serif text-lg italic mt-1 text-kyar-text line-clamp-1">
                              {convention.name}
                            </p>
                          </div>
                          <p className="text-[10px] uppercase tracking-widest text-kyar-textTertiary mt-3">
                            {dayLabel} · {t("buildsPlanned", { count: outfitCount })}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-kyar-textSecondary">
                    <Link
                      href="/conventions"
                      className="underline focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
                    >
                      {t("viewAllEvents")}
                    </Link>
                  </p>
                </div>
              )}
            </SectionCard>

            {/* 3. Current projects (2x1 bottom right) */}
            <SectionCard
              title={t("currentProjects")}
              action={
                recentProjectsList.length > 0
                  ? { label: t("viewAllBuilds"), href: "/builds" }
                  : undefined
              }
              className="lg:col-span-2 lg:row-span-1 flex flex-col min-h-[240px] lg:min-h-0 bg-kyar-surface border-none shadow-none"
            >
              {recentProjectsList.length > 0 ? (
                <div className="flex-1 min-h-0 overflow-x-auto flex gap-4 pb-2 snap-x px-1 items-stretch -mx-4 px-4 sm:-mx-5 sm:px-5 h-full">
                  {recentProjectsList.map((build) => {
                    const hasImage = build.imageStorageId != null || build.imageUrl != null;
                    return (
                      <Link
                        key={build._id}
                        href={`/build-detail/${build._id}`}
                        className="snap-start shrink-0 w-[180px] h-full flex flex-col rounded-2xl overflow-hidden border border-kyar-borderSubtle bg-kyar-surface hover:border-kyar-text hover:shadow-soft transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 relative"
                      >
                        <div className="flex-1 min-h-0 relative w-full bg-kyar-muted">
                          {hasImage ? (
                            <ResolvedImage
                              imageStorageId={build.imageStorageId ?? undefined}
                              imageUrl={build.imageUrl ?? undefined}
                              alt={build.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary">
                              <span className="material-symbols-outlined text-4xl">
                                photo_library
                              </span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-kyar-media-scrim-mid" aria-hidden />
                          <div className="absolute bottom-0 left-0 right-0 p-4 text-kyar-media-fg">
                            <p className="line-clamp-2 font-serif text-lg italic leading-tight drop-shadow-sm">
                              {build.name}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider opacity-90 mt-1">
                              {build.tasksChecked} / {build.tasksTotal} tasks
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-sm text-kyar-textSecondary">
                    <Link
                      href="/builds"
                      className="underline focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2 rounded"
                    >
                      {t("viewAllBuilds")}
                    </Link>
                  </p>
                </div>
              )}
            </SectionCard>
          </div>
        </main>
      </div>
    </WebAppShell>
  );
}
