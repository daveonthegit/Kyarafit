import Link from 'next/link';
import Image from 'next/image';
import { BottomNav } from '@/components/layout/BottomNav';
import { FloatingAdd } from '@/components/layout/FloatingAdd';

const FEATURED_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBu_SZd735qYIoLuhK64k-v3rkLy747i8ue_eH0N3xYPJbFfLIbKTVm3H-NcZKqndHcu7oc5R6oewk0qzI59bly1EUxBH8v_Rksago6lmZEEUMphUaNGZWEVkABr3W0VuzaghrdMUk4d_908-swoxIEwGiMwYZ2vS4ll8I4ag19hB22sskICQ_WverIln2OaHA-UVny57iBW11GSZL7UBfu6pwj192s2Eef0qAaLpXYi0LribO8DOh31AUeQf2hy-No5kYha4q4BEpE';
const DEADLINE_IMG = 'https://lh3.googleusercontent.com/aida-public/AB6AXuANB3dhJnBdXJaL_UnZMR1yklmotO8qguSIjtgHVdJGshhrjA0Wb9tNJnobCISZ_YmdNp2WnswxnsaTVqyaITjrDuxUSNR26xPv8-NkKwEV7Pmu9sD5Ybq_9oia63qgI8oWfU8TFRCQuvbmabe8RtAwIZdNzZ0ZyEC1sefwCy1t2IOwujj6tqmJPsxLbm9fo4Z4KY3VFUeuK88hUDdq7cCXsLs1YgsJnluz1wdKU7eD_qoRbaqKRUa7Lh6rV9HIViA5YIED8nN2akxW';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col pb-32">
      <header className="pt-14 px-8 pb-6 flex justify-between items-end">
        <div>
          <p className="meta-label mb-1">Kyarafit</p>
          <h1 className="font-serif text-4xl font-normal italic tracking-tight">The Lookbook</h1>
        </div>
        <div className="flex gap-4 mb-1">
          <span className="material-symbols-outlined font-light text-2xl cursor-pointer">search</span>
          <Link href="/settings" className="material-symbols-outlined font-light text-2xl cursor-pointer">menu</Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-6 mb-12">
          <Link href="/build-detail" className="block relative w-full aspect-[4/5] overflow-hidden cursor-pointer">
            <Image src={FEATURED_IMG} alt="featured" fill className="object-cover" sizes="100vw" />
            <div className="absolute bottom-6 left-6 right-6 flex justify-between items-end text-white">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-light mb-1">Current Focus</p>
                <h2 className="font-serif text-2xl italic font-normal">Arlecchino</h2>
              </div>
              <span className="text-[10px] uppercase tracking-widest border border-white/30 px-3 py-1 backdrop-blur-md">View Case</span>
            </div>
          </Link>
        </section>

        <section className="px-8 space-y-12">
          <div className="flex flex-col border-t border-black/5 pt-6">
            <div className="flex justify-between items-baseline mb-4">
              <h3 className="text-[11px] uppercase tracking-[0.3em] font-semibold">Next Deadline</h3>
              <span className="font-serif italic text-lg opacity-40">12 Days</span>
            </div>
            <div className="flex items-start gap-8">
              <div className="flex-1">
                <p className="font-serif text-2xl leading-tight mb-2">Final Fitting & Prop Polish</p>
                <p className="text-[12px] opacity-50 leading-relaxed">Ensuring structural integrity for the wing mechanism and weathering.</p>
              </div>
              <div className="w-16 h-16 shrink-0 border border-black/5 p-1">
                <Image src={DEADLINE_IMG} alt="prop" width={56} height={56} className="w-full h-full object-cover grayscale" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <FloatingAdd />
      <BottomNav active="home" />
    </div>
  );
}
