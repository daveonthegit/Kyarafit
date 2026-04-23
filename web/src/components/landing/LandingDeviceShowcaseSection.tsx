"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { LANDING_BUILDS, MOCK_ACCOUNT } from "@/data/landingMock";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

export function LandingDeviceShowcaseSection() {
  return (
    <section className="overflow-hidden border-t border-kyar-borderSubtle bg-kyar-bg py-20 sm:py-24 lg:py-32">
      <div
        className={`${SECTION_PADDING} ${MAX_WIDTH} flex flex-col items-center gap-12 sm:gap-14 lg:flex-row lg:items-center lg:gap-16`}
      >
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ margin: "-80px", amount: 0.2 }}
          transition={{ duration: 0.8 }}
          className="w-full lg:w-[min(32rem,46%)]"
        >
          <h2 className="font-serif-elegant mb-6 text-[clamp(2.2rem,6vw,3.75rem)] font-normal leading-[1.05] text-kyar-text sm:mb-8">
            Your craft,
            <br />
            wherever you go.
          </h2>
          <p className="mb-8 max-w-xl text-base leading-relaxed text-kyar-textSecondary sm:mb-10 sm:text-lg">
            Plan on the web app with full editing power. Bring the mobile app to the workshop or
            convention floor.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <a
              href="https://apps.apple.com/app/kyarafit"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[3.5rem] w-full items-center justify-center gap-3 rounded-lg bg-kyar-text px-6 py-4 text-kyar-bg transition-all hover:-translate-y-0.5 hover:bg-kyar-accent hover:shadow-lg sm:w-auto sm:justify-start"
            >
              <span className="material-symbols-outlined text-2xl" aria-hidden>
                apple
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">App Store</span>
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.kyarafit"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[3.5rem] w-full items-center justify-center gap-3 rounded-lg border-2 border-kyar-borderSubtle bg-kyar-surface px-6 py-4 text-kyar-text transition-colors hover:border-kyar-text sm:w-auto sm:justify-start"
            >
              <span className="material-symbols-outlined text-2xl" aria-hidden>
                android
              </span>
              <span className="text-xs font-bold uppercase tracking-wider">Google Play</span>
            </a>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ margin: "-80px", amount: 0.2 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative flex min-h-[24rem] w-full items-center justify-center sm:min-h-[30rem] lg:min-h-[32rem] lg:flex-1"
        >
          <div className="absolute right-0 top-0 flex aspect-video w-[min(100%,42rem)] max-w-full flex-col overflow-hidden rounded-xl border border-kyar-cardBorder bg-kyar-surface shadow-card sm:w-[min(100%,40rem)] lg:right-0 lg:w-[min(100%,38rem)] xl:-right-8 xl:w-[min(100%,42rem)]">
            <div className="flex h-6 items-center gap-1.5 border-b border-kyar-borderSubtle bg-kyar-bgWarm px-4">
              <div className="h-2.5 w-2.5 rounded-full border border-kyar-text/10 bg-[#FF5F56]" />
              <div className="h-2.5 w-2.5 rounded-full border border-kyar-text/10 bg-[#FFBD2E]" />
              <div className="h-2.5 w-2.5 rounded-full border border-kyar-text/10 bg-[#27C93F]" />
            </div>
            <div className="flex min-h-[200px] flex-1 bg-kyar-bgWarm">
              <div className="hidden w-44 flex-col gap-4 border-r border-kyar-borderSubtle bg-kyar-surface px-3 py-5 sm:flex">
                <div className="px-2 font-serif-elegant text-base font-bold italic">Kyarafit</div>
                <div className="flex flex-col gap-1">
                  <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-widest text-kyar-textTertiary">
                    Menu
                  </div>
                  <div className="rounded-md px-3 py-2 text-xs font-semibold text-kyar-textSecondary">
                    Elements
                  </div>
                  <div className="rounded-md bg-kyar-muted px-3 py-2 text-xs font-semibold text-kyar-accent">
                    Builds
                  </div>
                  <div className="rounded-md px-3 py-2 text-xs font-medium text-kyar-textSecondary">
                    Conventions
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4">
                <div className="font-serif-elegant text-base sm:text-lg">My Builds</div>
                <div className="grid grid-cols-3 gap-2">
                  {LANDING_BUILDS.slice(0, 3).map((build) => (
                    <div
                      key={build.id}
                      className="overflow-hidden rounded-lg border border-kyar-borderSubtle bg-kyar-surface"
                    >
                      <div className="relative aspect-[3/4] bg-kyar-muted">
                        <Image
                          src={build.imageSrc}
                          alt=""
                          fill
                          sizes="(min-width: 1280px) 120px, (min-width: 1024px) 10vw, 24vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-kyar-media-scrim-mid" />
                        <div className="absolute bottom-1 left-1 right-1">
                          <p className="truncate font-serif text-[10px] italic text-kyar-media-fg drop-shadow-sm">
                            {build.name}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <motion.div
            className="absolute bottom-0 left-2 z-10 h-[min(70vw,28rem)] w-[min(42vw,14rem)] rounded-[2rem] border-[6px] border-kyar-border bg-kyar-surface p-1 shadow-card sm:left-4 sm:h-[24rem] sm:w-[12rem] lg:left-0 lg:h-[26rem] lg:w-[13rem]"
            initial={{ y: 50 }}
            whileInView={{ y: 0 }}
            viewport={{ margin: "-60px", amount: 0.15 }}
            transition={{ duration: 1, delay: 0.4 }}
          >
            <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-kyar-surface">
              <div className="absolute left-1/2 top-0 z-20 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-[#E5E5E5]" />
              <div className="relative flex h-32 flex-col justify-end overflow-hidden bg-kyar-accent p-5 text-kyar-bg">
                <Image
                  src={MOCK_ACCOUNT.convention.heroImageSrc}
                  alt=""
                  fill
                  sizes="220px"
                  className="object-cover opacity-40 mix-blend-overlay"
                />
                <div className="relative z-10">
                  <div className="font-serif-elegant mb-1 text-2xl leading-none">
                    {MOCK_ACCOUNT.convention.subtitle}
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider opacity-80">
                    Packing list
                  </div>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 bg-kyar-surface p-4">
                {MOCK_ACCOUNT.convention.packingPreviewRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center gap-3 border-b border-kyar-borderSubtle/50 pb-2"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                        row.done
                          ? "border-kyar-accent bg-kyar-accent"
                          : "border-kyar-border bg-kyar-surface"
                      }`}
                    >
                      {row.done && (
                        <svg
                          className="h-2.5 w-2.5 text-kyar-bg"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span
                      className={`text-[11px] font-semibold tracking-wide ${
                        row.done ? "text-kyar-textTertiary line-through" : "text-kyar-text"
                      }`}
                    >
                      {row.label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex h-14 items-center justify-around border-t border-kyar-borderSubtle bg-kyar-surface px-2 text-kyar-textTertiary">
                <span className="material-symbols-outlined text-[22px]">checkroom</span>
                <span className="material-symbols-outlined text-[22px]">architecture</span>
                <div className="flex flex-col items-center text-kyar-accent">
                  <span className="material-symbols-outlined text-[22px]">calendar_month</span>
                  <span className="mt-0.5 h-1 w-1 rounded-full bg-kyar-accent" />
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
