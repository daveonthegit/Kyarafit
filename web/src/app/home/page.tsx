"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AddMenuModal } from "@kyarafit/design-system";
import type { Id } from "convex/_generated/dataModel";
import { BuildHeroCropModal } from "@/components/builds/BuildHeroCropModal";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { FloatingAdd } from "@/components/layout/FloatingAdd";
import { PageHeader } from "@/components/layout/PageHeader";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { SectionCard } from "@/components/ui/SectionCard";
import { SwipeCard } from "@/components/ui/SwipeCard";
import { MagicCard } from "@/components/ui/magic-card";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useCreationModals } from "@/contexts/CreationModalsContext";
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

const QUICK_ACTIONS: (
  | {
      key: string;
      modal: AddMenuModal;
      labelKey: "addClosetItem" | "planNewCosplay";
      icon: string;
    }
  | { key: string; href: string; labelKey: "events"; icon: string }
)[] = [
  { key: "closet", modal: "newCloset", labelKey: "addClosetItem", icon: "upload" },
  { key: "build", modal: "newBuild", labelKey: "planNewCosplay", icon: "dashboard" },
  { key: "events", href: "/conventions", labelKey: "events", icon: "calendar_month" },
];

function daysUntil(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  return Math.ceil((start.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function HomePage() {
  const { userId } = useCurrentUser();
  const { open: openCreationModal } = useCreationModals();
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
    userId ? { userId, limit: 5 } : "skip"
  );
  const builds = useQuery(api.builds.list, userId ? { userId } : "skip") ?? [];
  const plannerTasks = useQuery(api.buildTasks.listForPlanner, userId ? { userId } : "skip") ?? [];
  const closetItems = useQuery(api.closetItems.list, userId ? { userId } : "skip") ?? [];
  const updateBuild = useMutation(api.builds.update);

  const recentProjectsList = useMemo(() => {
    const excluded = recentBuild ? builds.filter((b) => b._id !== recentBuild._id) : [...builds];
    const withCreation = excluded as Array<(typeof builds)[number] & { _creationTime?: number }>;
    const sorted = [...withCreation].sort(
      (a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0)
    );
    return sorted.slice(0, 10);
  }, [builds, recentBuild]);

  const missingTasks = useMemo(
    () => plannerTasks.filter((task) => !task.checked).slice(0, 8),
    [plannerTasks]
  );

  const closetStats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    for (const item of closetItems) {
      byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
    }
    return { total: closetItems.length, byCategory };
  }, [closetItems]);

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
      <PageHeader
        title={t("theLookbook")}
        trailing={
          <Link
            href="/settings"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-kyar-text hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
            aria-label={tCommon("settings")}
          >
            <span className="material-symbols-outlined font-light text-2xl">menu</span>
          </Link>
        }
      />

      <main className="flex-1 max-w-6xl mx-auto w-full pb-24 lg:pb-8">
        {/* Two-column layout: wider left, narrower right */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 sm:gap-8 lg:gap-10">
          {/* ——— Left column ——— */}
          <div className="min-w-0 space-y-6 sm:space-y-8">
            {/* Featured build hero — large card */}
            <section>
              <MagicCard className="overflow-hidden border border-kyar-cardBorder rounded-sm shadow-card">
                <Link
                  href={recentBuild ? `/build-detail?id=${recentBuild._id}` : "/builds"}
                  className="block group"
                  aria-label={
                    recentBuild
                      ? t("currentFocusAria", { name: recentBuild.name })
                      : t("viewBuildsAria")
                  }
                >
                  <div className="relative w-full aspect-[4/5] sm:aspect-[3/2] lg:aspect-[21/9] max-h-[70vh] overflow-hidden bg-kyar-mutedWarm rounded-t-sm">
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
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
                      aria-hidden
                    />
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white">
                      <span className="inline-block text-[10px] sm:text-xs uppercase tracking-[0.2em] font-medium bg-black text-white px-2.5 py-1 rounded-sm mb-2">
                        {t("currentFocus")}
                      </span>
                      <p className="font-serif text-xl sm:text-2xl lg:text-3xl italic font-normal">
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
                  <div className="px-4 sm:px-6 pb-3 pt-0">
                    <div
                      className="h-1 w-full bg-kyar-borderSubtle rounded-sm overflow-hidden"
                      role="progressbar"
                      aria-valuenow={recentBuild.tasksChecked}
                      aria-valuemin={0}
                      aria-valuemax={recentBuild.tasksTotal}
                    >
                      <div
                        className="h-full bg-black rounded-sm transition-[width] duration-300"
                        style={{
                          width: `${(100 * recentBuild.tasksChecked) / recentBuild.tasksTotal}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </MagicCard>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-[10px] uppercase tracking-widest text-kyar-meta">
                    {recentBuild ? t("yourMostRecentBuild") : t("createBuildToSee")}
                  </p>
                  {builds.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={openFocusModal}
                        className="text-[10px] font-semibold uppercase tracking-widest text-kyar-text underline decoration-kyar-meta underline-offset-2 hover:decoration-kyar-text focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded"
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
                          <div className="flex items-center justify-between gap-3 border-b border-kyar-cardBorder px-4 py-3 shrink-0">
                            <h2
                              id="focus-modal-title"
                              className="font-serif text-lg italic font-normal text-kyar-text"
                            >
                              {t("selectFocus")}
                            </h2>
                            <button
                              type="button"
                              onClick={closeFocusModal}
                              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-kyar-text hover:bg-kyar-mutedWarm focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
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
                              className="w-full rounded-sm border border-kyar-cardBorder bg-kyar-bgWarm px-3 py-2 text-sm text-kyar-text placeholder:text-kyar-meta focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                              aria-label={t("selectFocus")}
                            />
                          </div>
                          <ul className="overflow-auto flex-1 min-h-0 p-3 space-y-1" role="listbox">
                            <li role="option">
                              <button
                                type="button"
                                onClick={() => selectFocus(undefined)}
                                className="w-full flex items-center gap-3 p-3 rounded-sm border border-kyar-cardBorder hover:border-kyar-text hover:bg-kyar-mutedWarm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
                              >
                                <span className="w-12 h-12 shrink-0 rounded-sm bg-kyar-mutedWarm flex items-center justify-center text-kyar-textTertiary">
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
                                  <div className="flex items-center gap-1 rounded-sm border border-kyar-cardBorder hover:border-kyar-text hover:bg-kyar-mutedWarm overflow-hidden">
                                    <button
                                      type="button"
                                      onClick={() => selectFocus(b._id)}
                                      className="flex-1 flex items-center gap-3 p-3 min-w-0 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-inset"
                                    >
                                      <div className="w-12 h-12 shrink-0 rounded-sm overflow-hidden bg-kyar-mutedWarm">
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
                                        className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-kyar-meta hover:text-kyar-text hover:bg-kyar-borderSubtle transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
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
                  href={recentBuild ? `/build-detail?id=${recentBuild._id}` : "/builds"}
                  className="text-[10px] font-semibold uppercase tracking-widest border border-black px-4 py-2.5 min-h-[44px] inline-flex items-center rounded-sm hover:bg-black hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
                >
                  {recentBuild ? t("continueEditing") : t("viewBuilds")}
                </Link>
              </div>
            </section>

            {/* Sub-grid: Upcoming events (with images), Current projects (with build images) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              {/* Upcoming events — moved from right sidebar, with event images */}
              <SectionCard
                title={t("upcomingEvents")}
                action={
                  upcomingWithCounts && upcomingWithCounts.length > 0
                    ? { label: t("viewAllEvents"), href: "/conventions" }
                    : undefined
                }
              >
                {upcomingWithCounts && upcomingWithCounts.length > 0 ? (
                  <ul className="space-y-3">
                    {upcomingWithCounts.slice(0, 3).map(({ convention, outfitCount }) => {
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
                        <li key={convention._id}>
                          <Link
                            href={`/conventions/${convention._id}`}
                            className="block rounded-sm overflow-hidden border border-kyar-cardBorder hover:border-kyar-text hover:bg-kyar-mutedWarm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
                          >
                            {hasImage && (
                              <div className="aspect-[21/9] w-full bg-kyar-mutedWarm relative">
                                <ResolvedImage
                                  imageStorageId={convention.imageStorageId ?? undefined}
                                  imageUrl={convention.imageUrl ?? undefined}
                                  alt={convention.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="p-3">
                              <p className="text-[10px] uppercase tracking-wider text-kyar-meta">
                                {convention.startDate === convention.endDate
                                  ? convention.startDate
                                  : `${convention.startDate} – ${convention.endDate}`}
                              </p>
                              <p className="font-serif text-base italic mt-0.5">
                                {convention.name}
                              </p>
                              <p className="text-[10px] uppercase tracking-wider text-kyar-textTertiary mt-1">
                                {dayLabel} · {t("buildsPlanned", { count: outfitCount })}
                              </p>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-kyar-textSecondary">
                    <Link
                      href="/conventions"
                      className="underline focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded"
                    >
                      {t("viewAllEvents")}
                    </Link>
                  </p>
                )}
              </SectionCard>

              {/* Current projects — swipeable build cards */}
              <SectionCard
                title={t("currentProjects")}
                action={
                  recentProjectsList.length > 0
                    ? { label: t("viewAllBuilds"), href: "/builds" }
                    : undefined
                }
              >
                {recentProjectsList.length > 0 ? (
                  <div className="flex justify-center -mx-2 py-2">
                    <SwipeCard
                      items={recentProjectsList}
                      keyExtractor={(build) => build._id}
                      renderSlide={(build) => {
                        const hasImage = build.imageStorageId != null || build.imageUrl != null;
                        return (
                          <Link
                            href={`/build-detail?id=${build._id}`}
                            className="block h-full flex flex-col rounded-2xl overflow-hidden border border-kyar-cardBorder bg-kyar-surface hover:border-kyar-text hover:shadow-soft transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                          >
                            <div className="flex-1 min-h-0 relative aspect-[3/4] w-full bg-kyar-mutedWarm">
                              {hasImage ? (
                                <ResolvedImage
                                  imageStorageId={build.imageStorageId ?? undefined}
                                  imageUrl={build.imageUrl ?? undefined}
                                  alt={build.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-kyar-textTertiary">
                                  <span className="material-symbols-outlined text-5xl">
                                    photo_library
                                  </span>
                                </div>
                              )}
                              <div
                                className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"
                                aria-hidden
                              />
                              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                                <p className="font-serif italic text-sm sm:text-base truncate">
                                  {build.name}
                                </p>
                                <p className="text-[10px] uppercase tracking-wider opacity-90 mt-0.5">
                                  {build.tasksChecked} / {build.tasksTotal} tasks
                                </p>
                              </div>
                            </div>
                          </Link>
                        );
                      }}
                      showNavigation={recentProjectsList.length > 1}
                      loop={recentProjectsList.length > 1}
                      height={320}
                      animate={false}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-kyar-textSecondary">
                    <Link
                      href="/builds"
                      className="underline focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 rounded"
                    >
                      {t("viewAllBuilds")}
                    </Link>
                  </p>
                )}
              </SectionCard>
            </div>
          </div>

          {/* ——— Right column: Quick Actions, Missing items, Closet ——— */}
          <div className="flex flex-col gap-6 sm:gap-8">
            {/* Quick Actions */}
            <section
              className="rounded-sm p-5 sm:p-6 bg-kyar-text text-white shadow-card flex-shrink-0"
              aria-labelledby="quick-actions-heading"
            >
              <h2
                id="quick-actions-heading"
                className="text-sm font-semibold uppercase tracking-wider mb-4"
              >
                {t("quickActions")}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {QUICK_ACTIONS.map((action) =>
                  "modal" in action ? (
                    <button
                      key={action.key}
                      type="button"
                      onClick={() => openCreationModal(action.modal)}
                      className="flex min-h-[80px] flex-col items-center justify-center gap-2 rounded-sm bg-white/10 p-4 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      <span className="material-symbols-outlined text-2xl" aria-hidden>
                        {action.icon}
                      </span>
                      <span className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wider">
                        {t(action.labelKey)}
                      </span>
                    </button>
                  ) : (
                    <Link
                      key={action.key}
                      href={action.href}
                      className="flex min-h-[80px] flex-col items-center justify-center gap-2 rounded-sm bg-white/10 p-4 transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                    >
                      <span className="material-symbols-outlined text-2xl" aria-hidden>
                        {action.icon}
                      </span>
                      <span className="text-center text-[10px] font-semibold uppercase leading-tight tracking-wider">
                        {t(action.labelKey)}
                      </span>
                    </Link>
                  )
                )}
              </div>
            </section>

            {/* Missing items — moved to right sidebar */}
            <SectionCard
              title={t("missingItems")}
              action={
                missingTasks.length > 0 ? { label: t("seeAllTasks"), href: "/planner" } : undefined
              }
            >
              {missingTasks.length > 0 ? (
                <ul className="space-y-2">
                  {missingTasks.slice(0, 5).map((task) => (
                    <li key={task._id}>
                      <Link
                        href={task.buildId ? `/build-detail?id=${task.buildId}` : "/planner"}
                        className="flex items-center justify-between gap-3 p-3 min-h-[44px] rounded-sm border border-kyar-cardBorder hover:border-kyar-text hover:bg-kyar-mutedWarm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 focus-visible:ring-offset-kyar-bgWarm"
                      >
                        <span className="font-medium truncate">{task.label}</span>
                        <span className="text-xs text-kyar-meta shrink-0">{task.buildName}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-kyar-textSecondary">{t("noMissingItems")}</p>
              )}
            </SectionCard>

            {/* Closet */}
            <Link
              href="/closet"
              className="block rounded-sm overflow-hidden border border-kyar-cardBorder bg-kyar-text text-white shadow-card hover:opacity-95 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            >
              <div className="p-5 sm:p-6">
                <p className="text-[10px] uppercase tracking-widest text-white/70 mb-2">
                  {t("closetOverview")}
                </p>
                <h3 className="font-serif text-xl sm:text-2xl italic font-normal mb-1">
                  {t("totalItems", { count: closetStats.total })}
                </h3>
                <p className="text-sm text-white/80">
                  {Object.keys(closetStats.byCategory).length > 0
                    ? Object.entries(closetStats.byCategory)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, 3)
                        .map(([cat, n]) => `${cat} ${n}`)
                        .join(" · ")
                    : t("addNewItem")}
                </p>
                <span className="inline-flex items-center gap-1 mt-3 text-[10px] font-semibold uppercase tracking-widest text-white/90">
                  {t("addNewItem")}
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </span>
              </div>
            </Link>
          </div>
        </div>
      </main>

      <FloatingAdd />
    </WebAppShell>
  );
}
