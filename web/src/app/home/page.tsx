"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { FloatingAdd } from "@/components/layout/FloatingAdd";
import { WebAppShell } from "@/components/layout/WebAppShell";
import { ResolvedImage } from "@/components/ui/ResolvedImage";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { api } from "convex/_generated/api";

const QUICK_LINKS: {
  href: string;
  labelKey: "myBuilds" | "conventions" | "closet";
  icon: string;
}[] = [
  { href: "/builds", labelKey: "myBuilds", icon: "checkroom" },
  { href: "/conventions", labelKey: "conventions", icon: "event" },
  { href: "/closet", labelKey: "closet", icon: "inventory_2" },
];

export default function HomePage() {
  const { userId } = useCurrentUser();
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");
  const recentBuild = useQuery(api.builds.getMostRecentForUser, userId ? { userId } : "skip");

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
          <Link
            href={recentBuild ? `/build-detail?id=${recentBuild._id}` : "/builds"}
            className="block group"
            aria-label={
              recentBuild ? t("currentFocusAria", { name: recentBuild.name }) : t("viewBuildsAria")
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
                  <p className="text-xs sm:text-sm mt-1 opacity-90">
                    {t("percentComplete", { progress: recentBuild.progress })}
                    {recentBuild.character ? ` · ${recentBuild.character}` : ""}
                  </p>
                )}
              </div>
            </div>
          </Link>
          <div className="mt-4 flex justify-between items-center flex-wrap gap-2">
            <p className="text-[10px] uppercase tracking-widest text-kyar-meta">
              {recentBuild ? t("yourMostRecentBuild") : t("createBuildToSee")}
            </p>
            <Link
              href={recentBuild ? `/build-detail?id=${recentBuild._id}` : "/builds"}
              className="text-[10px] font-semibold uppercase tracking-widest border border-black px-4 py-2 rounded-sm hover:bg-black hover:text-white transition-colors"
            >
              {recentBuild ? t("viewBuild") : t("viewBuilds")}
            </Link>
          </div>
        </section>

        {/* Quick links */}
        <section className="border-t border-kyar-borderSubtle pt-6 sm:pt-8">
          <h2 className="text-[11px] uppercase tracking-[0.3em] font-semibold text-kyar-meta mb-4 sm:mb-6">
            {t("quickLinks")}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {QUICK_LINKS.map(({ href, labelKey, icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5 border border-kyar-borderSubtle rounded-sm hover:border-black hover:bg-kyar-muted/30 transition-colors group"
              >
                <span className="material-symbols-outlined text-2xl sm:text-3xl text-kyar-textTertiary group-hover:text-black">
                  {icon}
                </span>
                <span className="font-serif text-lg sm:text-xl italic">{t(labelKey)}</span>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <FloatingAdd href="/builds/new" />
    </WebAppShell>
  );
}
