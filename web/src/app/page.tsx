import Link from "next/link";
import Image from "next/image";
import { LandingAuthCta } from "@/components/landing/LandingAuthCta";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const SECTION_GAP = "gap-12 lg:gap-14";
const MAX_WIDTH = "max-w-6xl mx-auto w-full";

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
          className={`flex flex-col lg:flex-row lg:items-center ${SECTION_GAP} ${SECTION_PADDING} pt-4 pb-12 sm:pb-16 lg:py-16 ${MAX_WIDTH}`}
          aria-labelledby="hero-heading"
        >
          <div className="flex-1 min-w-0">
            <p
              className="font-sans-wide text-[9px] sm:text-[10px] text-kyar-meta uppercase tracking-widest mb-3"
              aria-hidden
            >
              Cosplay wardrobe · Builds · Events
            </p>
            <h1
              id="hero-heading"
              className="font-serif-elegant text-4xl sm:text-5xl lg:text-6xl leading-[1.1] font-normal mb-6"
            >
              Your closet, builds, and events in one place
            </h1>
            <p className="text-sm sm:text-base text-kyar-textSecondary max-w-md leading-relaxed mb-8">
              Catalog pieces, track build progress, and plan convention outfits with a simple,
              editorial-style tool. Web and mobile.
            </p>
            <LandingAuthCta variant="hero" />
          </div>
          <div className="flex-shrink-0 w-full lg:w-[48%] lg:max-w-xl aspect-[4/3] lg:aspect-[3/2] relative overflow-hidden bg-kyar-muted rounded-sm border border-kyar-borderSubtle mt-8 lg:mt-0">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5j_rjik1qfSqmE54IvlQ-f93B0ic1cMxmr4b5UdTCH9jUwmMLGKWBb0I7q-2GTYocwgz4-cw76dbs2rVBlitZa9YCGAX42unGgJ4-1jMOxB1Jo5GIdpLCDYuIsOMiUNzgwVQk9HHCG2sH1_T97gvqe9a4z7nemuaxofVVC2yPD4NuamYwLJ89xyERKi8ayBVi-4-jlq2_ReZz-IvBQOKL8fEEYSuYKZtNSCV4qtxrDAEyEDwBPkVFNygFQEiVGt9BjSqc3ui-kxcK"
              alt="Editorial cosplay style — organize your looks and builds"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
        </section>

        {/* Problem */}
        <section
          className={`${SECTION_PADDING} py-12 sm:py-16 border-t border-kyar-borderSubtle ${MAX_WIDTH}`}
          aria-labelledby="problem-heading"
        >
          <h2
            id="problem-heading"
            className="font-serif-elegant text-2xl sm:text-3xl font-normal italic mb-8"
          >
            Less chaos, more craft
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

        {/* How it works */}
        <section
          className={`${SECTION_PADDING} py-12 sm:py-16 border-t border-kyar-borderSubtle ${MAX_WIDTH}`}
          aria-labelledby="how-heading"
        >
          <h2
            id="how-heading"
            className="font-serif-elegant text-2xl sm:text-3xl font-normal italic mb-2"
          >
            How it works
          </h2>
          <p className="text-sm text-kyar-textSecondary mb-10 max-w-lg">
            Four steps from messy to organized.
          </p>
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 list-none p-0 m-0 counter-reset">
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

        {/* Feature highlights */}
        <section
          className={`${SECTION_PADDING} py-12 sm:py-16 border-t border-kyar-borderSubtle ${MAX_WIDTH}`}
          aria-labelledby="features-heading"
        >
          <h2
            id="features-heading"
            className="font-serif-elegant text-2xl sm:text-3xl font-normal italic mb-10"
          >
            What you get
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
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
                className="border border-kyar-borderSubtle rounded-sm p-6 bg-kyar-surface"
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

        {/* Product preview / App download */}
        <section
          className={`${SECTION_PADDING} py-12 sm:py-16 border-t border-kyar-border ${MAX_WIDTH}`}
          aria-labelledby="preview-heading"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8">
            <div>
              <h2
                id="preview-heading"
                className="font-serif-elegant text-2xl sm:text-3xl font-normal italic mb-4"
              >
                On web and mobile
              </h2>
              <p className="text-sm text-kyar-textSecondary max-w-md mb-6">
                Use the web app for full editing. Use the mobile app offline—sync when you’re back
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
            <div className="flex-1 max-w-md aspect-video bg-kyar-muted rounded-sm border border-kyar-borderSubtle overflow-hidden flex items-center justify-center">
              <span
                className="material-symbols-outlined text-5xl sm:text-6xl text-kyar-textTertiary"
                aria-hidden
              >
                phone_iphone
              </span>
            </div>
          </div>
        </section>

        {/* CTA section */}
        <section
          className={`${SECTION_PADDING} py-12 sm:py-16 border-t border-kyar-borderSubtle ${MAX_WIDTH}`}
          aria-labelledby="cta-heading"
        >
          <div className="text-center max-w-xl mx-auto">
            <h2
              id="cta-heading"
              className="font-serif-elegant text-2xl sm:text-3xl font-normal italic mb-4"
            >
              Start organizing today
            </h2>
            <p className="text-sm text-kyar-textSecondary mb-8">
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
