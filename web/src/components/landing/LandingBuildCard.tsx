"use client";

import Link from "next/link";
import type { LandingBuildPreview } from "@/data/landingMock";

/**
 * Same layout as {@link ../../app/builds/page} build cards — static preview for the marketing page.
 */
export function LandingBuildCard({
  build,
  href = "/auth/signup",
}: {
  build: LandingBuildPreview;
  href?: string;
}) {
  const projectNumber = String(build.projectIndex).padStart(3, "0");
  const progress = build.progress;

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute right-4 top-4 z-20 h-6 w-6 rounded-full border border-kyar-bg/50 bg-kyar-text/20 shadow-sm backdrop-blur-sm"
        aria-hidden
      />
      <Link
        href={href}
        className="group relative block aspect-[3/4] w-full cursor-pointer overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-muted shadow-soft transition-all hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-kyar-accent focus-visible:ring-offset-2"
        aria-label={`Preview: ${build.name}`}
      >
        <img
          src={build.imageSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-kyar-text/80 via-kyar-text/20 to-transparent transition-colors duration-300" />

        <div className="absolute inset-0 flex flex-col justify-end p-5 text-kyar-bg">
          <div className="flex items-end justify-between gap-2">
            <div className="min-w-0 flex-1">
              <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.2em] opacity-80">
                Project {projectNumber}
              </span>
              <h2 className="truncate font-serif text-2xl font-normal italic leading-none tracking-tight transition-colors group-hover:text-kyar-accent lg:text-3xl">
                {build.name}
              </h2>
            </div>

            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
              <svg
                className="absolute inset-0 h-full w-full -rotate-90 drop-shadow-md"
                viewBox="0 0 36 36"
              >
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-kyar-bg/20"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-kyar-bg"
                  strokeLinecap="round"
                  strokeDasharray={`${(progress / 100) * 100} 100`}
                />
              </svg>
              <span className="text-[9px] font-bold drop-shadow-md">{progress}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-90 drop-shadow-sm">
              {build.status}
            </span>
            {build.character && (
              <>
                <span className="h-1 w-1 rounded-full bg-kyar-bg/50" />
                <span className="truncate text-[10px] font-bold uppercase tracking-widest opacity-90 drop-shadow-sm">
                  {build.character}
                </span>
              </>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
