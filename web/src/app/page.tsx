import Link from "next/link";
import { LandingAuthCta } from "@/components/landing/LandingAuthCta";
import { HeroScrollSection } from "@/components/landing/HeroScrollSection";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const SECTION_GAP = "gap-12 lg:gap-16";
const MAX_WIDTH = "max-w-6xl mx-auto w-full";
const SECTION_PY = "py-14 sm:py-20 lg:py-24";

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-kyar-bg text-kyar-text">
      {/* Header */}
      <header
        className={`flex justify-between items-center pt-6 sm:pt-8 pb-4 z-20 ${SECTION_PADDING} ${MAX_WIDTH}`}
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

      <main className="flex-1 flex flex-col" role="main">
        {/* Hero */}
        <section
          className={`grid grid-cols-1 lg:grid-cols-2 ${SECTION_GAP} ${SECTION_PADDING} pt-2 pb-6 sm:pb-8 lg:pb-12 ${MAX_WIDTH} min-h-0`}
          aria-labelledby="hero-heading"
        >
          <div className="flex flex-col justify-center min-w-0 lg:sticky lg:top-24 lg:self-start lg:py-12">
            <p
              className="font-sans-wide text-[9px] sm:text-[10px] text-kyar-meta uppercase tracking-widest mb-4"
              aria-hidden
            >
              Cosplay wardrobe · Builds · Events
            </p>
            <h1
              id="hero-heading"
              className="font-serif-elegant text-4xl sm:text-5xl lg:text-6xl xl:text-[3.5rem] leading-[1.08] font-normal mb-6"
            >
              Your closet, builds, and events in one place
            </h1>
            <p className="text-sm sm:text-base text-kyar-textSecondary max-w-md leading-relaxed mb-8">
              Catalog pieces, track build progress, and plan convention outfits with a simple,
              editorial-style tool. Web and mobile.
            </p>
            <LandingAuthCta variant="hero" />
          </div>
          <div className="w-full min-h-[32rem] sm:min-h-[38rem] md:min-h-[44rem] flex items-center">
            <HeroScrollSection variant="hero" />
          </div>
        </section>

        {/* Core value */}
        <section
          className={`${SECTION_PADDING} ${SECTION_PY} border-t border-kyar-borderSubtle ${MAX_WIDTH}`}
          aria-labelledby="value-heading"
        >
          <div className="max-w-2xl">
            <h2
              id="value-heading"
              className="font-serif-elegant text-2xl sm:text-3xl lg:text-4xl font-normal italic mb-4"
            >
              Less chaos, more craft
            </h2>
            <p className="text-sm sm:text-base text-kyar-textSecondary leading-relaxed">
              Kyarafit keeps your cosplay world in one place: a digital closet for pieces, build
              tracking for progress and tasks, and event planning for conventions—with packing lists
              and day plans so you can focus on making and wearing.
            </p>
          </div>
        </section>

        {/* Features */}
        <section
          className={`${SECTION_PADDING} ${SECTION_PY} border-t border-kyar-borderSubtle ${MAX_WIDTH}`}
          aria-labelledby="features-heading"
        >
          <h2
            id="features-heading"
            className="font-serif-elegant text-2xl sm:text-3xl font-normal italic mb-10 sm:mb-12"
          >
            What you get
          </h2>
          <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                icon: "inventory_2",
                title: "Digital closet",
                desc: "Catalog pieces, track costs, and visualize your collection with minimal fuss.",
              },
              {
                icon: "construction",
                title: "Build tracking",
                desc: "Document progress, manage tasks, and keep cosplay projects on schedule.",
              },
              {
                icon: "calendar_month",
                title: "Convention planning",
                desc: "Plan outfits, create itineraries, and generate packing lists for events.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="border border-kyar-borderSubtle rounded-sm p-6 sm:p-7 bg-kyar-surface"
              >
                <span
                  className="material-symbols-outlined text-2xl text-kyar-text block mb-4"
                  aria-hidden
                >
                  {item.icon}
                </span>
                <h3 className="font-sans-wide text-[11px] uppercase tracking-widest font-semibold mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-kyar-textSecondary leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section
          className={`${SECTION_PADDING} ${SECTION_PY} border-t border-kyar-borderSubtle ${MAX_WIDTH}`}
          aria-labelledby="how-heading"
        >
          <h2
            id="how-heading"
            className="font-serif-elegant text-2xl sm:text-3xl font-normal italic mb-2"
          >
            How it works
          </h2>
          <p className="text-sm text-kyar-textSecondary mb-8 sm:mb-10 max-w-lg">
            Four steps from messy to organized.
          </p>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 list-none p-0 m-0">
            {[
              {
                step: "1",
                title: "Catalog",
                desc: "Add pieces to your digital closet. Cost, category, status.",
              },
              {
                step: "2",
                title: "Build",
                desc: "Create builds per character or costume. Link items and track tasks.",
              },
              {
                step: "3",
                title: "Plan",
                desc: "Add events (conventions, shoots). Attach builds and day plans.",
              },
              {
                step: "4",
                title: "Pack",
                desc: "Generate packing lists per event. One place for outfits and gear.",
              },
            ].map((item) => (
              <li
                key={item.step}
                className="flex gap-4 sm:flex-col sm:gap-3 border border-kyar-borderSubtle rounded-sm p-4 sm:p-5 bg-kyar-bg"
              >
                <span
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center font-sans-wide text-xs font-bold border border-black rounded-sm"
                  aria-hidden
                >
                  {item.step}
                </span>
                <div>
                  <h3 className="font-sans-wide text-[11px] uppercase tracking-widest font-semibold mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-kyar-textSecondary leading-relaxed">{item.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Pain points — why it helps */}
        <section
          className={`${SECTION_PADDING} py-10 sm:py-12 border-t border-kyar-borderSubtle ${MAX_WIDTH}`}
          aria-labelledby="why-heading"
        >
          <h2
            id="why-heading"
            className="font-sans-wide text-[10px] sm:text-[11px] text-kyar-meta uppercase tracking-widest font-semibold mb-6"
          >
            Problems you might know
          </h2>
          <ul className="grid sm:grid-cols-3 gap-6 sm:gap-8 list-none p-0 m-0">
            {[
              {
                label: "Scattered closet",
                body: "Pieces live in spreadsheets or your head. Hard to see what you have or what fits a character.",
              },
              {
                label: "Builds slip through cracks",
                body: "Tasks and deadlines for multiple costumes get messy. Progress and budget are unclear.",
              },
              {
                label: "Event planning is manual",
                body: "Packing lists and day plans per convention are copy-paste or guesswork.",
              },
            ].map((item) => (
              <li
                key={item.label}
                className="border-b border-kyar-border pb-4 sm:border-b-0 sm:border-l sm:border-kyar-borderSubtle sm:pl-6 first:sm:pl-0 first:sm:border-l-0"
              >
                <p className="font-sans-wide text-[11px] uppercase tracking-widest font-semibold text-kyar-text mb-2">
                  {item.label}
                </p>
                <p className="text-sm text-kyar-textSecondary leading-relaxed">{item.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Web & mobile */}
        <section
          className={`${SECTION_PADDING} ${SECTION_PY} border-t border-kyar-border ${MAX_WIDTH}`}
          aria-labelledby="preview-heading"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 lg:gap-12">
            <div className="min-w-0">
              <h2
                id="preview-heading"
                className="font-serif-elegant text-2xl sm:text-3xl font-normal italic mb-4"
              >
                On web and mobile
              </h2>
              <p className="text-sm text-kyar-textSecondary max-w-md mb-6 leading-relaxed">
                Use the web app for full editing. Use the mobile app offline—sync when you're back
                online. No account required for local use on mobile.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href="https://apps.apple.com/app/kyarafit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-black px-4 py-2.5 rounded-sm hover:bg-black hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2"
                >
                  <span className="material-symbols-outlined text-xl" aria-hidden>
                    apple
                  </span>
                  <span className="text-[10px] sm:text-xs font-sans-wide font-semibold uppercase tracking-wider">
                    App Store
                  </span>
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=com.kyarafit"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 border border-black px-4 py-2.5 rounded-sm hover:bg-black hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-kyar-accent focus:ring-offset-2"
                >
                  <span className="material-symbols-outlined text-xl" aria-hidden>
                    android
                  </span>
                  <span className="text-[10px] sm:text-xs font-sans-wide font-semibold uppercase tracking-wider">
                    Google Play
                  </span>
                </a>
              </div>
            </div>
            <div className="flex-shrink-0 w-full max-w-[280px] md:max-w-xs aspect-[9/19] bg-kyar-muted rounded-sm border border-kyar-borderSubtle overflow-hidden flex items-center justify-center mx-auto md:mx-0">
              <span
                className="material-symbols-outlined text-5xl sm:text-6xl text-kyar-textTertiary"
                aria-hidden
              >
                phone_iphone
              </span>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section
          className={`${SECTION_PADDING} ${SECTION_PY} border-t border-kyar-borderSubtle ${MAX_WIDTH}`}
          aria-labelledby="cta-heading"
        >
          <div className="text-center max-w-xl mx-auto">
            <h2
              id="cta-heading"
              className="font-serif-elegant text-2xl sm:text-3xl font-normal italic mb-4"
            >
              Start organizing today
            </h2>
            <p className="text-sm text-kyar-textSecondary mb-8 leading-relaxed">
              Create an account on web to sync your closet and builds across devices.
            </p>
            <LandingAuthCta variant="cta" />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer
        className={`${SECTION_PADDING} py-8 border-t border-kyar-borderSubtle ${MAX_WIDTH}`}
        role="contentinfo"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-[9px] sm:text-[10px] text-kyar-meta uppercase tracking-widest">
            Kyarafit · Cosplay wardrobe & build tracker
          </p>
          <LandingAuthCta variant="footer" />
        </div>
      </footer>
    </div>
  );
}
