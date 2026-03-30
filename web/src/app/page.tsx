"use client";

import Link from "next/link";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { LandingAuthCta } from "@/components/landing/LandingAuthCta";
import { HeroVideoPlayer } from "@/components/landing/remotion/HeroVideoPlayer";
import { LandingProductScrollySection } from "@/components/landing/LandingProductScrollySection";
import { LandingMediaDisclaimer } from "@/components/landing/LandingMediaDisclaimer";
import { LandingFooterStrip } from "@/components/landing/LandingFooterStrip";
import { LANDING_BUILDS, MOCK_ACCOUNT } from "@/data/landingMock";
import { useRef } from "react";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8 } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const yHeroMockup = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const opacityHeroMockup = useTransform(scrollYProgress, [0.4, 0.9], [1, 0]);
  const smoothY = useSpring(yHeroMockup, { damping: 20, stiffness: 100 });

  return (
    <div className="min-h-screen flex flex-col bg-kyar-bgWarm text-kyar-text overflow-x-clip selection:bg-kyar-accent selection:text-white">
      <header
        className={`fixed top-0 left-0 right-0 flex justify-between items-center py-6 z-50 mix-blend-difference text-white ${SECTION_PADDING} ${MAX_WIDTH}`}
        aria-label="Site header"
      >
        <Link
          href="/"
          className="font-serif-elegant text-xl sm:text-2xl font-bold italic tracking-tighter"
          aria-label="Kyarafit home"
        >
          Kyarafit
        </Link>
        <LandingAuthCta variant="header" />
      </header>

      <main className="flex flex-col" role="main">
        <section
          ref={heroRef}
          className="relative flex min-h-[85svh] flex-col items-center justify-center overflow-x-clip overflow-y-visible pb-16 pt-[max(7.5rem,env(safe-area-inset-top,0px)+5.5rem)] sm:min-h-[90vh] sm:pb-24 sm:pt-40 lg:pb-32"
          aria-labelledby="hero-heading"
        >
          <motion.div
            className={`relative z-10 w-full min-w-0 text-center ${SECTION_PADDING} ${MAX_WIDTH}`}
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.p
              variants={fadeUp}
              className="font-sans-wide mb-5 text-[10px] font-semibold uppercase tracking-widest text-kyar-meta sm:mb-6 sm:text-[11px]"
              aria-hidden
            >
              The Cosplayer&apos;s Digital Toolkit
            </motion.p>
            <motion.h1
              variants={fadeUp}
              id="hero-heading"
              className="font-serif-elegant mx-auto mb-6 max-w-4xl text-balance text-4xl font-normal leading-[1.08] sm:mb-8 sm:text-6xl lg:text-[5.5rem]"
            >
              Master the craft.
              <br className="hidden sm:block" /> Organize the chaos.
            </motion.h1>
            <motion.p
              variants={fadeUp}
              className="mx-auto mb-10 max-w-2xl px-1 text-base leading-relaxed text-kyar-textSecondary sm:mb-12 sm:text-lg"
            >
              Purpose-built for planning, building, and packing for conventions. Designed for
              meticulous creators who want to drop the spreadsheets.
            </motion.p>
            <motion.div variants={fadeUp} className="mb-10 flex justify-center sm:mb-16">
              <LandingAuthCta variant="hero" />
            </motion.div>
          </motion.div>

          <motion.div
            style={{ y: smoothY, opacity: opacityHeroMockup }}
            className="relative z-0 mt-2 w-full min-w-0 max-w-[min(100%,80rem)] shrink-0 px-3 sm:mt-4 sm:px-6"
          >
            <div className="pointer-events-none absolute top-1/2 left-1/2 -z-10 h-[110%] w-[110%] max-w-[100vw] -translate-x-1/2 -translate-y-1/2 rounded-full bg-kyar-accent/10 blur-[80px]" />
            <div className="relative mx-auto flex aspect-video w-full max-w-full min-w-0 items-center justify-center overflow-hidden rounded-2xl border border-kyar-border bg-[#0A0A0A] shadow-[0_40px_80px_rgba(17,82,212,0.15)] sm:rounded-[2rem]">
              <HeroVideoPlayer />
            </div>
          </motion.div>
        </section>

        {/* Scroll-synced product tour: Builds → Elements → Conventions → Tasks */}
        <LandingProductScrollySection />

        {/* Workflow */}
        <section
          className={`border-t border-kyar-borderSubtle bg-kyar-bgWarm py-24 sm:py-32 ${SECTION_PADDING}`}
          aria-labelledby="how-heading"
        >
          <div className={MAX_WIDTH}>
            <div className="mb-16 max-w-3xl">
              <h2
                id="how-heading"
                className="font-sans-wide mb-4 text-xs font-semibold uppercase tracking-widest text-kyar-accent"
              >
                What you can do
              </h2>
              <p className="font-serif-elegant text-3xl sm:text-4xl">The web app, end to end.</p>
              <p className="mt-4 text-base leading-relaxed text-kyar-textSecondary">
                Elements and closet, builds and tasks, conventions and packing—plus planner, feed,
                and discover when you want to look beyond your own archive.
              </p>
            </div>
            <motion.div
              className="grid gap-y-12 gap-x-8 sm:grid-cols-2 lg:grid-cols-3"
              variants={staggerContainer}
              initial="hidden"
              whileInView="visible"
              viewport={{ margin: "-50px", amount: 0.25 }}
            >
              {[
                {
                  step: "01",
                  title: "Elements & closet",
                  desc: "Catalog wigs, props, contacts, and materials. Reuse them across builds and keep photos, notes, and links in one place.",
                  icon: "checkroom",
                },
                {
                  step: "02",
                  title: "Builds",
                  desc: "Create cosplay projects with visuals, linked closet items, workflow trees, and task checklists for construction progress.",
                  icon: "architecture",
                },
                {
                  step: "03",
                  title: "Conventions",
                  desc: "Add events, assign which build you wear each day, and open packing views tied to that weekend.",
                  icon: "festival",
                },
                {
                  step: "04",
                  title: "Packing & logistics",
                  desc: "Checklists per convention so cases, tools, and last-minute fixes don’t get left behind.",
                  icon: "luggage",
                },
                {
                  step: "05",
                  title: "Planner & tasks",
                  desc: "See tasks across builds on the planner. On each build, track deadlines, assignees, and checklist state.",
                  icon: "task_alt",
                },
                {
                  step: "06",
                  title: "Feed & discover",
                  desc: "Follow activity from people you care about and browse public builds for inspiration.",
                  icon: "travel_explore",
                },
              ].map((item) => (
                <motion.div variants={fadeUp} key={item.step} className="group relative">
                  <div className="mb-6 font-serif-elegant text-5xl text-kyar-border transition-colors duration-500 group-hover:text-kyar-accent">
                    {item.step}
                  </div>
                  <span
                    className="material-symbols-outlined mb-5 block text-3xl text-kyar-textSecondary transition-colors group-hover:text-kyar-text"
                    aria-hidden
                  >
                    {item.icon}
                  </span>
                  <h3 className="font-sans-wide mb-3 text-sm font-bold uppercase tracking-widest">
                    {item.title}
                  </h3>
                  <p className="text-base leading-relaxed text-kyar-textSecondary">{item.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* Device mockup */}
        <section
          className={`overflow-hidden border-t border-kyar-borderSubtle bg-white py-24 sm:py-32`}
        >
          <div
            className={`${SECTION_PADDING} ${MAX_WIDTH} flex flex-col items-center gap-16 lg:flex-row`}
          >
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ margin: "-80px", amount: 0.2 }}
              transition={{ duration: 0.8 }}
              className="lg:w-1/2"
            >
              <h2 className="font-serif-elegant mb-8 text-4xl font-normal leading-[1.1] sm:text-5xl lg:text-6xl">
                Your craft,
                <br />
                wherever you go.
              </h2>
              <p className="mb-12 max-w-md text-lg leading-relaxed text-kyar-textSecondary">
                Plan on the web app with full editing power. Bring the mobile app to the workshop or
                convention floor.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="https://apps.apple.com/app/kyarafit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg bg-kyar-text px-6 py-4 text-white transition-all hover:-translate-y-0.5 hover:bg-kyar-accent hover:shadow-lg"
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
                  className="flex items-center gap-3 rounded-lg border-2 border-kyar-borderSubtle bg-white px-6 py-4 text-kyar-text transition-colors hover:border-kyar-text"
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
              className="relative flex h-[500px] w-full items-center justify-center lg:w-1/2"
            >
              <div className="absolute right-0 top-0 flex aspect-video w-full max-w-[600px] flex-col overflow-hidden rounded-xl border border-kyar-border bg-white shadow-[0_30px_60px_rgba(0,0,0,0.08)] lg:-right-12">
                <div className="flex h-6 items-center gap-1.5 border-b border-kyar-borderSubtle bg-kyar-bgWarm px-4">
                  <div className="h-2.5 w-2.5 rounded-full border border-black/10 bg-[#FF5F56]" />
                  <div className="h-2.5 w-2.5 rounded-full border border-black/10 bg-[#FFBD2E]" />
                  <div className="h-2.5 w-2.5 rounded-full border border-black/10 bg-[#27C93F]" />
                </div>
                <div className="flex min-h-[200px] flex-1 bg-kyar-bgWarm">
                  <div className="flex w-44 flex-col gap-4 border-r border-kyar-borderSubtle bg-white py-5 px-3">
                    <div className="px-2 font-serif-elegant text-base font-bold italic">
                      Kyarafit
                    </div>
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
                  <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
                    <div className="font-serif-elegant text-lg">My Builds</div>
                    <div className="grid grid-cols-3 gap-2">
                      {LANDING_BUILDS.slice(0, 3).map((b) => (
                        <div
                          key={b.id}
                          className="overflow-hidden rounded-lg border border-kyar-borderSubtle bg-white"
                        >
                          <div className="relative aspect-[3/4] bg-kyar-muted">
                            <img src={b.imageSrc} alt="" className="h-full w-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                            <div className="absolute bottom-1 left-1 right-1">
                              <p className="truncate font-serif text-[10px] italic text-white">
                                {b.name}
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
                className="absolute bottom-[-20px] left-4 z-10 h-[450px] w-[220px] rounded-[2rem] border-[6px] border-[#E5E5E5] bg-white p-1 shadow-2xl lg:left-0"
                initial={{ y: 50 }}
                whileInView={{ y: 0 }}
                viewport={{ margin: "-60px", amount: 0.15 }}
                transition={{ duration: 1, delay: 0.4 }}
              >
                <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-kyar-borderSubtle bg-white">
                  <div className="absolute left-1/2 top-0 z-20 h-4 w-20 -translate-x-1/2 rounded-b-xl bg-[#E5E5E5]" />
                  <div className="relative flex h-32 flex-col justify-end overflow-hidden bg-kyar-accent p-5 text-white">
                    <img
                      src={MOCK_ACCOUNT.convention.heroImageSrc}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-overlay"
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
                  <div className="flex flex-1 flex-col gap-3 bg-white p-4">
                    {MOCK_ACCOUNT.convention.packingPreviewRows.map((row, i) => (
                      <div
                        key={row.label}
                        className="flex items-center gap-3 border-b border-kyar-borderSubtle/50 pb-2"
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border ${
                            row.done
                              ? "border-kyar-accent bg-kyar-accent"
                              : "border-kyar-border bg-white"
                          }`}
                        >
                          {row.done && (
                            <svg
                              className="h-2.5 w-2.5 text-white"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
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
                  <div className="flex h-14 items-center justify-around border-t border-kyar-borderSubtle bg-white px-2 text-kyar-textTertiary">
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
      </main>

      <footer className="border-t border-kyar-borderSubtle bg-kyar-bgWarm" role="contentinfo">
        <div className={`${SECTION_PADDING} ${MAX_WIDTH} py-10`}>
          <LandingMediaDisclaimer embedded />
          <div className="mt-8 flex flex-col gap-4 border-t border-kyar-borderSubtle pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-kyar-textTertiary">
              © {new Date().getFullYear()} Kyarafit. All rights reserved.
            </p>
            <LandingFooterStrip />
          </div>
        </div>
      </footer>
    </div>
  );
}
