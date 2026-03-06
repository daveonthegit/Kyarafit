import Link from "next/link";
import Image from "next/image";

export default function SplashLanding() {
  return (
    <div className="relative flex flex-col min-h-screen bg-kyar-bg">
      <header className="flex justify-between items-center px-8 pt-10 z-20">
        <span className="font-serif-elegant text-2xl font-bold italic tracking-tighter">
          Kyarafit
        </span>
        <Link
          href="/auth/signin"
          className="font-sans-wide text-[10px] text-kyar-text hover:text-black border-b border-black pb-0.5"
        >
          Log In
        </Link>
      </header>

      <main className="flex-1 flex flex-col pt-8 max-w-6xl mx-auto w-full">
        {/* Hero Section */}
        <div className="px-0 mb-10">
          <div className="relative w-full h-[40vh] overflow-hidden bg-kyar-muted">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA5j_rjik1qfSqmE54IvlQ-f93B0ic1cMxmr4b5UdTCH9jUwmMLGKWBb0I7q-2GTYocwgz4-cw76dbs2rVBlitZa9YCGAX42unGgJ4-1jMOxB1Jo5GIdpLCDYuIsOMiUNzgwVQk9HHCG2sH1_T97gvqe9a4z7nemuaxofVVC2yPD4NuamYwLJ89xyERKi8ayBVi-4-jlq2_ReZz-IvBQOKL8fEEYSuYKZtNSCV4qtxrDAEyEDwBPkVFNygFQEiVGt9BjSqc3ui-kxcK"
              alt="High-fashion Editorial"
              fill
              className="object-cover"
              priority
            />
          </div>
        </div>

        <div className="px-8 space-y-6 flex flex-col mb-16">
          <div>
            <p className="font-sans-wide text-[9px] text-kyar-meta mb-2">
              The Art of Transformation
            </p>
            <h1 className="font-serif-elegant text-5xl leading-[1.1] font-normal">
              Elevated <br />
              <span className="italic">Cosplay</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-[1px] bg-black w-10" />
            <p className="font-sans-wide text-[10px] leading-loose text-kyar-textSecondary max-w-[280px]">
              A curated digital space for the modern artisan. Organize your wardrobe, track builds,
              and plan character coords with editorial precision.
            </p>
          </div>
        </div>

        {/* Features Grid */}
        <div className="px-8 mb-16 grid md:grid-cols-3 gap-8">
          <div className="space-y-2">
            <span className="material-symbols-outlined text-2xl text-black">inventory_2</span>
            <h3 className="font-sans-wide text-[11px] uppercase tracking-widest font-semibold">
              Digital Closet
            </h3>
            <p className="text-sm text-kyar-textSecondary leading-relaxed">
              Catalog pieces, track costs, and visualize your collection with effortless
              organization.
            </p>
          </div>
          <div className="space-y-2">
            <span className="material-symbols-outlined text-2xl text-black">construction</span>
            <h3 className="font-sans-wide text-[11px] uppercase tracking-widest font-semibold">
              Build Tracking
            </h3>
            <p className="text-sm text-kyar-textSecondary leading-relaxed">
              Document progress, manage tasks, and keep your cosplay projects on schedule.
            </p>
          </div>
          <div className="space-y-2">
            <span className="material-symbols-outlined text-2xl text-black">calendar_month</span>
            <h3 className="font-sans-wide text-[11px] uppercase tracking-widest font-semibold">
              Convention Planning
            </h3>
            <p className="text-sm text-kyar-textSecondary leading-relaxed">
              Plan outfits, create itineraries, and generate smart packing lists for events.
            </p>
          </div>
        </div>

        {/* App Download Section */}
        <div className="px-8 mb-16">
          <div className="border-t border-kyar-border pt-12">
            <div className="flex items-center gap-4 mb-8">
              <div className="h-[1px] bg-black w-10" />
              <p className="font-sans-wide text-[9px] text-kyar-meta uppercase tracking-widest">
                Available on Mobile
              </p>
            </div>
            <h2 className="font-serif-elegant text-3xl mb-6">
              Take your closet <span className="italic">anywhere</span>
            </h2>
            <p className="text-sm text-kyar-textSecondary mb-8 max-w-md">
              Access your wardrobe offline, sync across devices, and plan on the go with our native
              mobile apps.
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://apps.apple.com/app/kyarafit"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 border border-black px-6 py-3 hover:bg-black hover:text-white transition-all"
              >
                <span className="material-symbols-outlined text-xl">apple</span>
                <div className="text-left">
                  <p className="text-[8px] uppercase tracking-wider">Download on the</p>
                  <p className="text-sm font-semibold">App Store</p>
                </div>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=com.kyarafit"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 border border-black px-6 py-3 hover:bg-black hover:text-white transition-all"
              >
                <span className="material-symbols-outlined text-xl">android</span>
                <div className="text-left">
                  <p className="text-[8px] uppercase tracking-wider">Get it on</p>
                  <p className="text-sm font-semibold">Google Play</p>
                </div>
              </a>
            </div>
            <p className="text-xs text-kyar-textTertiary mt-4">
              Mobile apps work offline-first. No account required for local use.
            </p>
          </div>
        </div>
      </main>

      <footer className="px-8 pb-12 mt-10">
        <div className="flex flex-col gap-6 max-w-6xl mx-auto w-full">
          <Link
            href="/auth/signup"
            className="border border-black py-4 w-full font-sans-wide text-xs text-center hover:bg-black hover:text-white transition-all"
          >
            Get Started on Web
          </Link>
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <div className="w-8 h-[1px] bg-black" />
              <div className="w-2 h-[1px] bg-kyar-border" />
            </div>
            <p className="text-[9px] text-kyar-meta uppercase tracking-widest">
              Web app requires sign-in
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
