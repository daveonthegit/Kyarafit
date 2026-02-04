import Link from 'next/link';
import Image from 'next/image';

const SPLASH_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuA5j_rjik1qfSqmE54IvlQ-f93B0ic1cMxmr4b5UdTCH9jUwmMLGKWBb0I7q-2GTYocwgz4-cw76dbs2rVBlitZa9YCGAX42unGgJ4-1jMOxB1Jo5GIdpLCDYuIsOMiUNzgwVQk9HHCG2sH1_T97gvqe9a4z7nemuaxofVVC2yPD4NuamYwLJ89xyERKi8ayBVi-4-jlq2_ReZz-IvBQOKL8fEEYSuYKZtNSCV4qtxrDAEyEDwBPkVFNygFQEiVGt9BjSqc3ui-kxcK';

export default function SplashLanding() {
  return (
    <div className="relative flex flex-col min-h-screen">
      <header className="flex justify-between items-center px-8 pt-10 z-20">
        <span className="font-serif-elegant text-2xl font-bold italic tracking-tighter">Kyarafit</span>
        <Link href="/home" className="font-sans-wide text-[10px] text-zinc-400">Skip</Link>
      </header>

      <main className="flex-1 flex flex-col pt-8">
        <div className="px-0 mb-10">
          <div className="relative w-full h-[60vh] overflow-hidden">
            <Image
              src={SPLASH_IMG}
              alt="editorial"
              fill
              className="object-cover grayscale-[20%]"
              priority
            />
            <div className="absolute bottom-6 right-8 text-[10px] font-sans-wide text-white mix-blend-difference">
              Issue 01 / Vol 24
            </div>
          </div>
        </div>
        <div className="px-8 space-y-6 flex flex-col">
          <div>
            <p className="font-sans-wide text-[9px] text-zinc-500 mb-2">The Art of Transformation</p>
            <h1 className="font-serif-elegant text-5xl leading-[1.1] font-normal">
              Elevated <br /><span className="italic">Cosplay</span>
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-[1px] bg-black w-10" />
            <p className="font-sans-wide text-[10px] leading-loose text-zinc-600 max-w-[200px]">
              A curated digital space for the modern artisan.
            </p>
          </div>
        </div>
      </main>

      <footer className="px-8 pb-12 mt-10">
        <div className="flex flex-col gap-6">
          <Link
            href="/home"
            className="border border-black py-4 w-full font-sans-wide text-xs text-center hover:bg-black hover:text-white transition-all"
          >
            Get Started
          </Link>
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <div className="w-8 h-[1px] bg-black" />
              <div className="w-2 h-[1px] bg-zinc-200" />
            </div>
            <button className="font-sans-wide text-[9px] text-black border-b border-black pb-0.5">
              Log In
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
