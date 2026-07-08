"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useOfflineMutation, useOfflineQuery } from "@/lib/offline";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Id } from "convex/_generated/dataModel";
import { BuildHeroCropModal } from "@/components/builds/BuildHeroCropModal";
import { AdaptiveModal } from "@/components/layout/AdaptiveModal";
import { PhotoBackdrop } from "@/components/layout/PhotoBackdrop";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
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

function todayIso(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function HomePage() {
  const { userId } = useCurrentUser();
  const t = useTranslations("Home");
  const locale = useLocale();
  // users + file-storage reads/writes are online-only (no sync metadata) — stay on convex/react.
  const focusedBuildId = useQuery(
    api.users.getFocusedBuildId,
    userId ? { externalId: userId } : "skip"
  );
  // builds + conventions carry ...syncMetaFields — read/write through the local-first bridge.
  const focusedOrRecent = useOfflineQuery(
    api.builds.getFocusedOrMostRecentForUser,
    userId ? { userId } : "skip"
  );
  const recentBuild = focusedOrRecent as FocusedBuild | null | undefined;
  const setFocusedBuild = useMutation(api.users.setFocusedBuild);
  const upcomingWithCounts = useOfflineQuery(
    api.conventions.listUpcomingWithPlanCounts,
    userId ? { userId, limit: 10 } : "skip"
  );
  const plannerTasks = useOfflineQuery(api.workflow.listPlanner, userId ? { userId } : "skip");
  const builds = useOfflineQuery(api.builds.list, userId ? { userId } : "skip") ?? [];
  const updateBuild = useOfflineMutation(api.builds.update);

  const recentProjectsList = useMemo(() => {
    const excluded = recentBuild ? builds.filter((b) => b._id !== recentBuild._id) : [...builds];
    const withCreation = excluded as Array<(typeof builds)[number] & { _creationTime?: number }>;
    const sorted = [...withCreation].sort(
      (a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0)
    );
    return sorted.slice(0, 10);
  }, [builds, recentBuild]);

  const studioBuilds = useMemo(() => {
    const featured = recentBuild ? builds.find((b) => b._id === recentBuild._id) : undefined;
    return [...(featured ? [featured] : []), ...recentProjectsList].slice(0, 10);
  }, [builds, recentBuild, recentProjectsList]);

  /** Incomplete dated tasks, soonest first (overdue naturally lead). */
  const dueTasks = useMemo(() => {
    return (plannerTasks ?? [])
      .filter((task) => task.status !== "done" && task.dueDate)
      .sort((a, b) => (a.dueDate as string).localeCompare(b.dueDate as string));
  }, [plannerTasks]);

  const today = todayIso();
  const weekAhead = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);
  const dueSoonCount = useMemo(
    () => dueTasks.filter((task) => (task.dueDate as string) <= weekAhead).length,
    [dueTasks, weekAhead]
  );

  const nextEvent = upcomingWithCounts?.[0];

  const dateEyebrow = useMemo(() => {
    const now = new Date();
    const weekday = new Intl.DateTimeFormat(locale, { weekday: "long" }).format(now);
    const monthDay = new Intl.DateTimeFormat(locale, { month: "long", day: "numeric" }).format(now);
    return `${weekday} · ${monthDay}`;
  }, [locale]);

  const dueLabel = useCallback(
    (dueDate: string) => {
      if (dueDate < today) return { text: t("overdue"), danger: true };
      const days = daysUntil(dueDate);
      if (days === 0) return { text: t("today"), danger: true };
      if (days === 1) return { text: t("tomorrow"), danger: false };
      if (days < 7) {
        const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" }).format(
          new Date(dueDate + "T12:00:00")
        );
        return { text: weekday, danger: false };
      }
      const short = new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(
        new Date(dueDate + "T12:00:00")
      );
      return { text: short, danger: false };
    },
    [locale, t, today]
  );

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
    <WebAppShell fullBleed>
      <div className="relative flex-1 flex flex-col text-kyar-media-fg">
        <PhotoBackdrop
          imageStorageId={recentBuild?.imageStorageId}
          imageUrl={recentBuild?.imageUrl}
          scrimRight="strong"
          objectPosition={
            recentBuild?.imageFocalX != null && recentBuild?.imageFocalY != null
              ? `${recentBuild.imageFocalX * 100}% ${recentBuild.imageFocalY * 100}%`
              : undefined
          }
        />

        <div className="relative z-10 flex-1 flex flex-col lg:flex-row gap-6 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pt-8 lg:pt-14 pb-6 min-h-0">
          {/* Headline block — lower-left over the backdrop (6a) */}
          <section className="flex-1 min-w-0 max-w-[560px] lg:self-start lg:mt-10">
            <span className="block text-[9px] lg:text-[10px] font-bold uppercase tracking-[0.28em] opacity-75 mb-3">
              {dateEyebrow}
            </span>
            <h1 className="font-serif italic font-normal text-[38px] lg:text-[64px] leading-[0.98] tracking-[-0.02em] [text-shadow:0_3px_14px_rgb(12_11_20/0.45)]">
              {nextEvent ? (
                <>
                  {t("headlineDueAndEvent", { count: dueSoonCount })}
                  <br />
                  {t("headlineEventIn", {
                    days: daysUntil(nextEvent.convention.startDate),
                    event: nextEvent.convention.name,
                  })}
                </>
              ) : (
                t("headlineDueOnly", { count: dueSoonCount })
              )}
            </h1>
            {recentBuild && (
              <div className="mt-5 flex flex-wrap items-center gap-5">
                <Link
                  href={`/build-detail/${recentBuild._id}`}
                  className="text-[10px] font-bold uppercase tracking-[0.16em] border-b border-kyar-media-fg pb-0.5 hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                  aria-label={t("currentFocusAria", { name: recentBuild.name })}
                >
                  {t("continueEditing")} ▸
                </Link>
                {builds.length > 0 && (
                  <button
                    type="button"
                    onClick={openFocusModal}
                    className="text-[10px] font-semibold uppercase tracking-[0.16em] text-media-fg-70 border-b border-glass-border-strong pb-0.5 hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                    aria-label={t("selectFocus")}
                  >
                    {t("selectFocus")}
                  </button>
                )}
              </div>
            )}
          </section>

          {/* What's due — right glass panel (6a) */}
          <aside
            className="w-full lg:w-[360px] shrink-0 self-start bg-glass backdrop-blur-glass border border-glass-border rounded-glass"
            aria-label={t("whatsDue")}
          >
            <div className="px-5 py-4 border-b border-glass-divider-strong">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                {t("whatsDue")}
              </span>
            </div>
            {dueTasks.length === 0 ? (
              <div className="px-5 py-4 text-[13px] text-media-fg-55 border-b border-glass-divider">
                {t("nothingDue")}
              </div>
            ) : (
              dueTasks.slice(0, 3).map((task) => {
                const label = dueLabel(task.dueDate as string);
                return (
                  <div
                    key={task._id}
                    className="flex items-center gap-3 px-5 py-3 border-b border-glass-divider"
                  >
                    <span
                      className="w-[18px] h-[18px] rounded-full shrink-0 shadow-[inset_0_0_0_1.5px_rgb(255_253_248/0.6)]"
                      aria-hidden
                    />
                    <span className="flex-1 min-w-0 text-[13px] truncate">{task.title}</span>
                    <span
                      className={`text-[9px] uppercase tracking-[0.14em] shrink-0 ${
                        label.danger ? "font-bold text-on-glass-danger" : "font-semibold opacity-55"
                      }`}
                    >
                      {label.text}
                    </span>
                  </div>
                );
              })
            )}
            {nextEvent && (
              <Link
                href={`/conventions/${nextEvent.convention._id}`}
                className="flex items-center gap-3 px-5 py-3 border-b border-glass-divider hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                <span className="material-symbols-outlined text-[18px] opacity-70" aria-hidden>
                  festival
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-semibold truncate">
                    {nextEvent.convention.name}
                  </span>
                  <span className="block text-[9px] font-semibold uppercase tracking-[0.14em] opacity-55">
                    {t("eventRowMeta", {
                      count: nextEvent.outfitCount,
                      days: daysUntil(nextEvent.convention.startDate),
                    })}
                  </span>
                </span>
                <span className="material-symbols-outlined text-[16px] opacity-50" aria-hidden>
                  chevron_right
                </span>
              </Link>
            )}
            <Link
              href="/planner"
              className="block px-5 py-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-media-fg-70 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
            >
              <span className="border-b border-glass-border-strong pb-0.5">
                {t("openPlanner")} ▸
              </span>
            </Link>
          </aside>
        </div>

        {/* Studio shelf (6a bottom) */}
        <section
          className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 pb-6 lg:pb-8"
          aria-label={t("inTheStudio", { count: builds.length })}
        >
          <div className="bg-glass backdrop-blur-glass border border-glass-border rounded-glass px-5 py-4">
            <div className="flex items-baseline justify-between gap-4 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-[0.24em] opacity-85">
                {t("inTheStudio", { count: builds.length })}
              </span>
              <Link
                href="/builds"
                className="text-[9px] font-semibold uppercase tracking-[0.16em] text-media-fg-55 hover:text-kyar-media-fg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
              >
                {t("viewAllBuilds")} ▸
              </Link>
            </div>
            {studioBuilds.length > 0 ? (
              <div className="flex gap-3 overflow-x-auto no-scrollbar snap-x">
                {studioBuilds.map((build, index) => {
                  const hasImage = build.imageStorageId != null || build.imageUrl != null;
                  const pct =
                    build.tasksTotal > 0
                      ? Math.round((100 * build.tasksChecked) / build.tasksTotal)
                      : 0;
                  const isFeatured = recentBuild?._id === build._id;
                  return (
                    <Link
                      key={build._id}
                      href={`/build-detail/${build._id}`}
                      className={`relative snap-start shrink-0 w-[200px] h-[150px] rounded-[10px] overflow-hidden bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent ${
                        isFeatured
                          ? "outline outline-[1.5px] -outline-offset-[1.5px] outline-glass-border-strong"
                          : ""
                      }`}
                    >
                      {hasImage ? (
                        <ResolvedImage
                          imageStorageId={build.imageStorageId ?? undefined}
                          imageUrl={build.imageUrl ?? undefined}
                          alt={build.name}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                      ) : (
                        <span className="absolute inset-0 flex items-center justify-center text-media-fg-45">
                          <span className="material-symbols-outlined text-4xl" aria-hidden>
                            photo_library
                          </span>
                        </span>
                      )}
                      <div className="absolute inset-0 bg-kyar-media-scrim" aria-hidden />
                      <div className="absolute left-0 right-0 bottom-0 p-2.5">
                        <span className="block text-[9px] font-bold uppercase tracking-[0.16em] opacity-70 mb-0.5">
                          {String(index + 1).padStart(2, "0")} · {pct}%
                        </span>
                        <span className="block font-serif italic text-[14px] leading-tight truncate">
                          {build.name}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="text-[13px] text-media-fg-55 py-2">
                <Link
                  href="/builds"
                  className="border-b border-glass-border-strong pb-0.5 hover:text-kyar-media-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  {t("createBuildToSee")}
                </Link>
              </p>
            )}
          </div>
        </section>

        {/* Select-focus modal (existing behavior, glass dialog) */}
        <AdaptiveModal
          open={isFocusModalOpen}
          onClose={closeFocusModal}
          aria-labelledby="focus-modal-title"
        >
          <div className="flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between gap-3 border-b border-glass-divider-strong px-4 py-3 shrink-0">
              <h2
                id="focus-modal-title"
                className="font-serif text-lg italic font-normal text-kyar-media-fg"
              >
                {t("selectFocus")}
              </h2>
              <button
                type="button"
                onClick={closeFocusModal}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-sm text-media-fg-70 hover:bg-glass-active focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                aria-label="Close"
              >
                <span className="material-symbols-outlined font-light text-xl">close</span>
              </button>
            </div>
            <div className="p-3 border-b border-glass-divider shrink-0">
              <input
                ref={focusSearchInputRef}
                type="search"
                value={focusSearch}
                onChange={(e) => setFocusSearch(e.target.value)}
                placeholder={t("searchBuildsPlaceholder")}
                className="glass-field w-full px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-kyar-accent"
                aria-label={t("selectFocus")}
              />
            </div>
            <ul className="overflow-auto flex-1 min-h-0 p-3 space-y-1" role="listbox">
              <li role="option">
                <button
                  type="button"
                  onClick={() => selectFocus(undefined)}
                  className="w-full flex items-center gap-3 p-3 rounded-[10px] border border-glass-border hover:border-glass-border-strong hover:bg-glass-active text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                >
                  <span className="w-12 h-12 shrink-0 rounded-sm bg-glass flex items-center justify-center text-media-fg-55">
                    <span className="material-symbols-outlined text-2xl">schedule</span>
                  </span>
                  <span className="font-serif italic text-kyar-media-fg">{t("defaultFocus")}</span>
                </button>
              </li>
              {filteredBuildsForFocus.map((b) => {
                const hasImage = b.imageStorageId != null || b.imageUrl != null;
                return (
                  <li key={b._id} role="option">
                    <div className="flex items-center gap-1 rounded-[10px] border border-glass-border hover:border-glass-border-strong hover:bg-glass-active overflow-hidden">
                      <button
                        type="button"
                        onClick={() => selectFocus(b._id)}
                        className="flex-1 flex items-center gap-3 p-3 min-w-0 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-inset"
                      >
                        <div className="w-12 h-12 shrink-0 rounded-sm overflow-hidden bg-glass">
                          {hasImage ? (
                            <ResolvedImage
                              imageStorageId={b.imageStorageId ?? undefined}
                              imageUrl={b.imageUrl ?? undefined}
                              alt={b.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-media-fg-55">
                              <span className="material-symbols-outlined text-2xl">
                                photo_library
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-serif italic text-kyar-media-fg truncate">{b.name}</p>
                          <p className="text-[10px] uppercase tracking-[0.16em] text-media-fg-55 mt-0.5">
                            {b.tasksChecked} / {b.tasksTotal} tasks
                            {b.character ? ` · ${b.character}` : ""}
                          </p>
                        </div>
                        {focusedBuildId === b._id && (
                          <span
                            className="material-symbols-outlined text-kyar-media-fg shrink-0"
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
                          className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center text-media-fg-55 hover:text-kyar-media-fg hover:bg-glass-active transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent"
                          aria-label={t("adjustCrop")}
                          title={t("adjustCrop")}
                        >
                          <span className="material-symbols-outlined text-xl">crop</span>
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
              {filteredBuildsForFocus.length === 0 && (
                <li className="py-4 text-center text-sm text-media-fg-55">{t("noBuildsMatch")}</li>
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
      </div>
    </WebAppShell>
  );
}
