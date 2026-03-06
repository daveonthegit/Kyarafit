"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { FloatingAdd } from "@/components/layout/FloatingAdd";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { CardAccordion, type CardAccordionItem } from "@/components/ui/card-accordion";
import { MagicCard } from "@/components/ui/magic-card";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";

const QUICK_ACTIONS: {
  href: string;
  labelKey: "addOutfit" | "addClothingItem" | "planNewCosplay";
  icon: string;
}[] = [
  { href: "/builds/new", labelKey: "addOutfit", icon: "checkroom" },
  { href: "/closet/new", labelKey: "addClothingItem", icon: "inventory_2" },
  { href: "/builds/new", labelKey: "planNewCosplay", icon: "add_circle" },
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
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");
  const recentBuild = useQuery(api.builds.getMostRecentForUser, userId ? { userId } : "skip");
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

  const recentProjectsForAccordion = useMemo(() => {
    const excluded = recentBuild ? builds.filter((b) => b._id !== recentBuild._id) : [...builds];
    const withCreation = excluded as Array<(typeof builds)[number] & { _creationTime?: number }>;
    const sorted = [...withCreation].sort(
      (a, b) => (b._creationTime ?? 0) - (a._creationTime ?? 0)
    );
    return sorted.slice(0, 3);
  }, [builds, recentBuild]);

  const accordionItems: CardAccordionItem[] = useMemo(
    () =>
      recentProjectsForAccordion.map((build) => ({
        id: build._id,
        title: build.name,
        subtitle: `${build.tasksChecked} / ${build.tasksTotal} items`,
        imageUrl: build.imageUrl ?? null,
        imageStorageId: build.imageStorageId ?? null,
      })),
    [recentProjectsForAccordion]
  );

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

  return (
    <WebAppShell>
      <header className="pt-14 pb-4 sm:pb-6 flex justify-between items-end px-4 sm:px-6 lg:pl-[calc(16rem+1.5rem)]">
        <div>
          <p className="meta-label mb-1 opacity-60">Kyarafit</p>
          <h1 className="font-serif text-3xl sm:text-4xl font-normal italic tracking-tight">
            {t("theLookbook")}
          </h1>
        </div>
        <Link
          href="/settings"
          className="material-symbols-outlined font-light text-2xl cursor-pointer p-1"
          aria-label={tCommon("settings")}
        >
          menu
        </Link>
      </header>

      <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-24 max-w-5xl mx-auto lg:mx-0">
        {/* Hero: recent build or placeholder */}
        <section className="mb-10 sm:mb-12">
          <MagicCard className="overflow-hidden">
            <Link
              href={recentBuild ? `/build-detail?id=${recentBuild._id}` : "/builds"}
              className="block group"
              aria-label={
                recentBuild
                  ? t("currentFocusAria", { name: recentBuild.name })
                  : t("viewBuildsAria")
              }
            >
              <div className="relative w-full aspect-[4/5] sm:aspect-[3/2] lg:aspect-[21/9] max-h-[70vh] overflow-hidden bg-kyar-muted border border-kyar-borderSubtle rounded-sm">
                {recentBuild?.imageStorageId || recentBuild?.imageUrl ? (
                  <ResolvedImage
                    imageStorageId={recentBuild.imageStorageId}
                    imageUrl={recentBuild.imageUrl}
                    alt={recentBuild.name}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
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
                  <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] font-medium opacity-90 mb-1">
                    {t("currentFocus")}
                  </p>
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
          <div className="mt-4 flex justify-between items-center flex-wrap gap-2">
            <p className="text-[10px] uppercase tracking-widest text-kyar-meta">
              {recentBuild ? t("yourMostRecentBuild") : t("createBuildToSee")}
            </p>
            <Link
              href={recentBuild ? `/build-detail?id=${recentBuild._id}` : "/builds"}
              className="text-[10px] font-semibold uppercase tracking-widest border border-black px-4 py-2 rounded-sm hover:bg-black hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
            >
              {recentBuild ? t("continueEditing") : t("viewBuilds")}
            </Link>
          </div>
        </section>

        {/* Quick actions */}
        <section className="border-t border-kyar-borderSubtle pt-6 sm:pt-8 mb-8 sm:mb-10">
          <h2 className="text-[11px] uppercase tracking-[0.3em] font-semibold text-kyar-meta mb-4 sm:mb-6">
            {t("quickActions")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {QUICK_ACTIONS.map(({ href, labelKey, icon }) => (
              <Link
                key={labelKey}
                href={href}
                className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 border border-kyar-borderSubtle rounded-sm hover:border-black hover:bg-kyar-muted/30 transition-colors group focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
              >
                <span className="material-symbols-outlined text-2xl sm:text-3xl text-kyar-textTertiary group-hover:text-black">
                  {icon}
                </span>
                <span className="font-serif text-lg sm:text-xl italic">{t(labelKey)}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Upcoming events + Current projects row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 sm:gap-10 mb-8 sm:mb-10">
          {/* Upcoming events */}
          <section>
            <h2 className="text-[11px] uppercase tracking-[0.3em] font-semibold text-kyar-meta mb-4 sm:mb-6">
              {t("upcomingEvents")}
            </h2>
            {upcomingWithCounts && upcomingWithCounts.length > 0 ? (
              <ul className="space-y-3">
                {upcomingWithCounts.map(({ convention, outfitCount }) => {
                  const days = daysUntil(convention.startDate);
                  const dayLabel =
                    days === 0
                      ? t("today")
                      : days === 1
                        ? t("tomorrow")
                        : t("daysLeft", { count: days });
                  const hasImage = convention.imageStorageId != null || convention.imageUrl != null;
                  return (
                    <li key={convention._id}>
                      <Link
                        href={`/conventions/${convention._id}`}
                        className="block border border-kyar-borderSubtle rounded-sm overflow-hidden hover:border-black hover:bg-kyar-muted/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
                      >
                        {hasImage ? (
                          <>
                            <div className="aspect-[21/9] w-full bg-kyar-muted relative">
                              <ResolvedImage
                                imageStorageId={convention.imageStorageId ?? undefined}
                                imageUrl={convention.imageUrl ?? undefined}
                                alt={convention.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="p-4">
                              <p className="font-serif text-lg italic">{convention.name}</p>
                              <p className="text-xs text-kyar-meta mt-1">
                                {convention.startDate === convention.endDate
                                  ? convention.startDate
                                  : `${convention.startDate} – ${convention.endDate}`}
                              </p>
                              <p className="text-[10px] uppercase tracking-wider text-kyar-textTertiary mt-1">
                                {dayLabel} · {t("outfitsPlanned", { count: outfitCount })}
                              </p>
                            </div>
                          </>
                        ) : (
                          <div className="p-4">
                            <p className="font-serif text-lg italic">{convention.name}</p>
                            <p className="text-xs text-kyar-meta mt-1">
                              {convention.startDate === convention.endDate
                                ? convention.startDate
                                : `${convention.startDate} – ${convention.endDate}`}
                            </p>
                            <p className="text-[10px] uppercase tracking-wider text-kyar-textTertiary mt-1">
                              {dayLabel} · {t("outfitsPlanned", { count: outfitCount })}
                            </p>
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-kyar-textSecondary">
                <Link href="/conventions" className="underline">
                  {t("viewAllEvents")}
                </Link>
              </p>
            )}
            {upcomingWithCounts && upcomingWithCounts.length > 0 && (
              <Link
                href="/conventions"
                className="inline-block mt-3 text-[10px] font-semibold uppercase tracking-widest text-kyar-meta hover:text-black"
              >
                {t("viewAllEvents")}
              </Link>
            )}
          </section>

          {/* Current cosplay projects — accordion of 3 most recent builds */}
          <section>
            <h2 className="text-[11px] uppercase tracking-[0.3em] font-semibold text-kyar-meta mb-4 sm:mb-6">
              {t("currentProjects")}
            </h2>
            {accordionItems.length > 0 ? (
              <>
                <CardAccordion
                  items={accordionItems}
                  getHref={(item) => `/build-detail?id=${item.id}`}
                  defaultActiveIndex={0}
                  panelHeight={280}
                  expandedWidth={320}
                  collapsedWidth={56}
                  className="border border-kyar-borderSubtle rounded-sm overflow-hidden"
                />
                <Link
                  href="/builds"
                  className="inline-block mt-3 text-[10px] font-semibold uppercase tracking-widest text-kyar-meta hover:text-black"
                >
                  {t("viewAllBuilds")}
                </Link>
              </>
            ) : (
              <p className="text-sm text-kyar-textSecondary">
                <Link href="/builds" className="underline">
                  {t("viewAllBuilds")}
                </Link>
              </p>
            )}
          </section>
        </div>

        {/* Missing items */}
        <section className="border-t border-kyar-borderSubtle pt-6 sm:pt-8 mb-8 sm:mb-10">
          <h2 className="text-[11px] uppercase tracking-[0.3em] font-semibold text-kyar-meta mb-4 sm:mb-6">
            {t("missingItems")}
          </h2>
          {missingTasks.length > 0 ? (
            <ul className="space-y-2">
              {missingTasks.map((task) => (
                <li key={task._id}>
                  <Link
                    href={task.buildId ? `/build-detail?id=${task.buildId}` : "/planner"}
                    className="flex items-center justify-between gap-3 p-3 border border-kyar-borderSubtle rounded-sm hover:border-black hover:bg-kyar-muted/30 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
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
          {missingTasks.length > 0 && (
            <Link
              href="/planner"
              className="inline-block mt-3 text-[10px] font-semibold uppercase tracking-widest text-kyar-meta hover:text-black"
            >
              {t("seeAllTasks")}
            </Link>
          )}
        </section>

        {/* Closet overview */}
        <section className="border-t border-kyar-borderSubtle pt-6 sm:pt-8">
          <h2 className="text-[11px] uppercase tracking-[0.3em] font-semibold text-kyar-meta mb-4 sm:mb-6">
            {t("closetOverview")}
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <p className="font-serif text-lg italic text-kyar-textSecondary">
              {t("totalItems", { count: closetStats.total })}
            </p>
            {Object.keys(closetStats.byCategory).length > 0 && (
              <span className="text-xs text-kyar-meta">
                {Object.entries(closetStats.byCategory)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 4)
                  .map(([cat, n]) => `${cat}: ${n}`)
                  .join(" · ")}
              </span>
            )}
            <Link
              href="/closet/new"
              className="text-[10px] font-semibold uppercase tracking-widest border border-black px-4 py-2 rounded-sm hover:bg-black hover:text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
            >
              {t("addNewItem")}
            </Link>
          </div>
        </section>
      </main>

      <FloatingAdd />
    </WebAppShell>
  );
}
