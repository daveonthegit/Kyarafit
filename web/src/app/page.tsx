"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { LandingAuthCta } from "@/components/landing/LandingAuthCta";
import { useRef } from "react";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

// Reusable motion variants for cinematic fades
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } },
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  
  // Parallax effect for the hero mockup
  const yHeroMockup = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
  const opacityHeroMockup = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="min-h-screen flex flex-col bg-kyar-bgWarm text-kyar-text overflow-hidden selection:bg-kyar-accent selection:text-white">
      {/* Header */}
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

      <main className="flex-1 flex flex-col" role="main">
        {/* HERO SECTION */}
        <section
          ref={heroRef}
          className="relative pt-32 sm:pt-40 pb-20 lg:pb-32 min-h-[90vh] flex flex-col items-center justify-center overflow-hidden"
          aria-labelledby="hero-heading"
        >
          <motion.div 
            className={`text-center z-10 relative ${SECTION_PADDING} ${MAX_WIDTH}`}
            initial="hidden"
            animate="visible"
            variants={staggerContainer}
          >
            <motion.p
              variants={fadeUp}
              className="font-sans-wide text-[10px] sm:text-[11px] text-kyar-meta uppercase tracking-widest mb-6"
              aria-hidden
            >
              The Cosplayer's Digital Toolkit
            </motion.p>
            <motion.h1
              variants={fadeUp}
              id="hero-heading"
              className="font-serif-elegant text-5xl sm:text-7xl lg:text-[5rem] leading-[1.05] font-normal mb-8 max-w-4xl mx-auto"
            >
              Master the craft.<br className="hidden sm:block" /> Organize the chaos.
            </motion.h1>
            <motion.div variants={fadeUp} className="flex justify-center mb-16">
              <LandingAuthCta variant="hero" />
            </motion.div>
          </motion.div>

          {/* Hero Video / Animated Mockup Placeholder */}
          <motion.div 
            style={{ y: yHeroMockup, opacity: opacityHeroMockup }}
            className="w-full max-w-5xl mx-auto px-6 relative z-0 mt-8"
          >
            <div className="relative aspect-video bg-[#1A1A1A] rounded-lg sm:rounded-2xl border border-kyar-border shadow-2xl overflow-hidden flex items-center justify-center">
               {/* 
                 TODO (Remotion): Integrate <Player /> here rendering the cinematic preview video 
                 showing the transition from a messy room to the clean digital closet, 
                 build progress bars filling up, and packing lists checking off.
               */}
               <div className="absolute inset-0 bg-gradient-to-tr from-black to-[#2A2A2A] opacity-80" />
               <div className="relative text-center">
                 <span className="material-symbols-outlined text-4xl text-white/50 mb-4 block">play_circle</span>
                 <p className="font-sans-wide text-[10px] text-white/50 uppercase tracking-widest">Animated Product Preview (Remotion)</p>
               </div>

               {/* Abstract decorative UI floating over the video placeholder */}
               <motion.div 
                 initial={{ y: 20, opacity: 0 }}
                 animate={{ y: 0, opacity: 1 }}
                 transition={{ delay: 1, duration: 1 }}
                 className="absolute bottom-6 sm:bottom-12 right-6 sm:right-12 bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded backdrop-saturate-150 shadow-2xl"
               >
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-kyar-accent rounded-sm" />
                   <div>
                     <div className="h-2 w-20 bg-white/80 rounded-sm mb-2" />
                     <div className="h-2 w-12 bg-white/40 rounded-sm" />
                   </div>
                 </div>
               </motion.div>
            </div>
          </motion.div>
        </section>

        {/* HIGH CONTRAST SHOWCASE (Dark Mode Block - Inspired by Reference 2 & 3) */}
        <section className="bg-[#0A0A0A] text-white py-24 sm:py-32" aria-labelledby="showcase-heading">
          <div className={`${SECTION_PADDING} ${MAX_WIDTH}`}>
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}
              className="mb-16 md:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8"
            >
              <div className="max-w-2xl">
                <motion.h2 id="showcase-heading" variants={fadeUp} className="font-serif-elegant text-3xl sm:text-5xl font-normal mb-6">
                  Everything in its place.
                </motion.h2>
                <motion.p variants={fadeUp} className="text-white/60 text-lg leading-relaxed max-w-lg">
                  Designed explicitly for the meticulous nature of cosplay. Drop the spreadsheets and focus on the details that matter.
                </motion.p>
              </div>
            </motion.div>

            {/* UI Feature Grid */}
            <div className="grid lg:grid-cols-2 gap-6 sm:gap-8">
              
              {/* Closet Feature */}
              <motion.div 
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="bg-[#141414] border border-white/10 rounded-sm p-8 sm:p-12 flex flex-col justify-between overflow-hidden group"
              >
                <div>
                  <h3 className="font-sans-wide text-xs uppercase tracking-widest text-kyar-accent mb-4">Digital Closet</h3>
                  <p className="font-serif-elegant text-2xl mb-8 text-white/90">Your entire wardrobe, visually cataloged.</p>
                </div>
                {/* Abstract UI Mockup */}
                <div className="relative mt-8 mt-auto transform group-hover:-translate-y-2 transition-transform duration-500">
                  <div className="grid grid-cols-3 gap-3">
                    {[1,2,3,4,5,6].map(i => (
                      <div key={i} className="aspect-square bg-white/5 rounded-sm border border-white/5 flex flex-col justify-end p-2">
                         <div className="h-1.5 w-1/2 bg-white/20 rounded-sm mb-1" />
                         <div className="h-1 w-1/3 bg-white/10 rounded-sm" />
                      </div>
                    ))}
                  </div>
                  {/* Floating selected item */}
                  <div className="absolute top-1/4 left-1/4 right-1/4 bottom-1/4 bg-[#1A1A1A] border border-kyar-accent/30 shadow-2xl shadow-kyar-accent/20 rounded-sm p-3 flex gap-3">
                     <div className="w-1/2 h-full bg-white/10 rounded-sm" />
                     <div className="w-1/2 flex flex-col gap-2 pt-2">
                        <div className="h-2 w-full bg-white/80 rounded-sm" />
                        <div className="h-1.5 w-2/3 bg-white/40 rounded-sm" />
                     </div>
                  </div>
                </div>
              </motion.div>

              <div className="flex flex-col gap-6 sm:gap-8">
                {/* Build Feature */}
                <motion.div 
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className="bg-[#141414] border border-white/10 rounded-sm p-8 flex-1 group"
                >
                  <h3 className="font-sans-wide text-xs uppercase tracking-widest text-[#E5F963] mb-3">Build Tracking</h3>
                  <p className="font-serif-elegant text-xl mb-6 text-white/90">From raw materials to finished armor.</p>
                  {/* Abstract Progress UI */}
                  <div className="bg-black/50 border border-white/5 rounded-sm p-4 mt-6">
                    <div className="flex justify-between text-[10px] text-white/40 font-sans-wide uppercase mb-2">
                      <span>Pauldron Build</span>
                      <span>68%</span>
                    </div>
                    <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#E5F963] w-[68%]" />
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 opacity-50"><div className="w-3 h-3 border border-white/30 rounded-sm bg-white/30" /><div className="h-1.5 w-24 bg-white/30 rounded-sm" /></div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 border border-[#E5F963] rounded-sm" /><div className="h-1.5 w-32 bg-white/80 rounded-sm" /></div>
                    </div>
                  </div>
                </motion.div>

                {/* Events Feature */}
                <motion.div 
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className="bg-[#141414] border border-white/10 rounded-sm p-8 flex-1 group"
                >
                  <h3 className="font-sans-wide text-xs uppercase tracking-widest text-[#FFB347] mb-3">Conventions</h3>
                  <p className="font-serif-elegant text-xl mb-6 text-white/90">Lineups and packing lists, automated.</p>
                  <div className="flex gap-2 overflow-hidden mt-4">
                    {["Fri", "Sat", "Sun"].map((day, idx) => (
                      <div key={day} className={`flex-1 border ${idx === 1 ? 'border-[#FFB347]/50 bg-[#FFB347]/5' : 'border-white/5 bg-black/50'} rounded-sm p-3`}>
                        <div className={`text-[10px] font-sans-wide uppercase mb-3 ${idx === 1 ? 'text-[#FFB347]' : 'text-white/40'}`}>{day}</div>
                        <div className="aspect-[3/4] bg-white/10 rounded-sm" />
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

            </div>
          </div>
        </section>

        {/* HOW IT WORKS - Minimalist Diagram */}
        <section className={`py-24 sm:py-32 bg-kyar-bg ${SECTION_PADDING} border-t border-kyar-borderSubtle`} aria-labelledby="how-heading">
          <div className={MAX_WIDTH}>
            <div className="mb-16">
              <h2 id="how-heading" className="font-sans-wide text-xs uppercase tracking-widest text-kyar-meta font-semibold mb-4">
                The Workflow
              </h2>
              <p className="font-serif-elegant text-3xl sm:text-4xl">Four steps to absolute clarity.</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-8">
              {[
                { step: "01", title: "Catalog", desc: "Log every wig, prop, and piece into a searchable database.", icon: "inventory_2" },
                { step: "02", title: "Build", desc: "Link components to characters and track crafting tasks.", icon: "architecture" },
                { step: "03", title: "Plan", desc: "Map outfits to convention days and schedule photoshoots.", icon: "calendar_month" },
                { step: "04", title: "Pack", desc: "Generate intelligent packing lists so nothing is forgotten.", icon: "luggage" },
              ].map((item, idx) => (
                <motion.div 
                  initial="hidden" whileInView="visible" viewport={{ once: true }} 
                  variants={{ hidden: { opacity: 0, y: 20 }, visible: { opacity: 1, y: 0, transition: { delay: idx * 0.1, duration: 0.6 } } }}
                  key={item.step} 
                  className="relative"
                >
                  <div className="text-4xl font-serif-elegant text-kyar-border mb-6">{item.step}</div>
                  <span className="material-symbols-outlined text-2xl mb-4 block" aria-hidden>{item.icon}</span>
                  <h3 className="font-sans-wide text-[11px] uppercase tracking-widest font-semibold mb-3">{item.title}</h3>
                  <p className="text-sm text-kyar-textSecondary leading-relaxed">{item.desc}</p>
                  
                  {/* Connector line for desktop */}
                  {idx < 3 && (
                    <div className="hidden lg:block absolute top-12 left-[80%] right-[-20%] h-[1px] bg-kyar-borderSubtle" />
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* DEVICE MOCKUP SHOWCASE (Cross-Platform) */}
        <section className={`py-24 sm:py-32 bg-kyar-mutedWarm border-t border-kyar-borderSubtle overflow-hidden`}>
          <div className={`${SECTION_PADDING} ${MAX_WIDTH} flex flex-col lg:flex-row items-center gap-16`}>
            <motion.div 
              initial={{ opacity: 0, x: -40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="lg:w-1/2"
            >
              <h2 className="font-serif-elegant text-4xl sm:text-5xl font-normal mb-6">
                Your craft, wherever you go.
              </h2>
              <p className="text-base text-kyar-textSecondary mb-10 leading-relaxed max-w-md">
                Plan on the web app with full editing power. Bring the mobile app to the workshop or convention floor. Offline sync means you never lose access to your lists, even with bad con WiFi.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <a href="https://apps.apple.com/app/kyarafit" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border border-kyar-text px-6 py-3 rounded-sm hover:bg-kyar-text hover:text-white transition-colors duration-300">
                  <span className="material-symbols-outlined text-2xl" aria-hidden>apple</span>
                  <span className="text-xs font-sans-wide font-semibold uppercase tracking-wider">App Store</span>
                </a>
                <a href="https://play.google.com/store/apps/details?id=com.kyarafit" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 border border-kyar-text px-6 py-3 rounded-sm hover:bg-kyar-text hover:text-white transition-colors duration-300">
                  <span className="material-symbols-outlined text-2xl" aria-hidden>android</span>
                  <span className="text-xs font-sans-wide font-semibold uppercase tracking-wider">Google Play</span>
                </a>
              </div>
            </motion.div>

            <motion.div 
               initial={{ opacity: 0, y: 40 }}
               whileInView={{ opacity: 1, y: 0 }}
               viewport={{ once: true }}
               transition={{ duration: 0.8, delay: 0.2 }}
               className="lg:w-1/2 relative w-full h-[500px] flex items-center justify-center"
            >
              {/* Abstract Desktop & Mobile Mockup Layout */}
              <div className="absolute right-0 lg:-right-12 top-0 w-full max-w-[600px] aspect-video bg-white border border-kyar-border shadow-soft rounded-md overflow-hidden flex flex-col">
                <div className="h-6 border-b border-kyar-borderSubtle bg-kyar-bgWarm flex items-center px-3 gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-kyar-border" />
                  <div className="w-2 h-2 rounded-full bg-kyar-border" />
                  <div className="w-2 h-2 rounded-full bg-kyar-border" />
                </div>
                <div className="flex-1 bg-[#FAFAFA] p-6 flex gap-6">
                  <div className="w-48 h-full bg-white border border-kyar-borderSubtle rounded-sm" />
                  <div className="flex-1 flex flex-col gap-4">
                    <div className="w-1/3 h-6 bg-white border border-kyar-borderSubtle rounded-sm" />
                    <div className="flex-1 bg-white border border-kyar-borderSubtle rounded-sm" />
                  </div>
                </div>
              </div>

              {/* Mobile overlay */}
              <div className="absolute left-4 lg:left-0 bottom-0 w-[220px] h-[450px] bg-white border border-kyar-border shadow-2xl rounded-3xl p-2 z-10">
                <div className="w-full h-full bg-[#FAFAFA] border border-kyar-borderSubtle rounded-2xl overflow-hidden flex flex-col">
                  <div className="h-24 bg-kyar-text w-full" />
                  <div className="flex-1 p-4 flex flex-col gap-3">
                    <div className="w-full h-20 bg-white shadow-card rounded-sm border border-kyar-borderSubtle" />
                    <div className="w-full h-20 bg-white shadow-card rounded-sm border border-kyar-borderSubtle" />
                    <div className="w-full h-20 bg-white shadow-card rounded-sm border border-kyar-borderSubtle" />
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={`py-32 bg-kyar-bg text-center ${SECTION_PADDING} border-t border-kyar-borderSubtle`} aria-labelledby="cta-heading">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
            className="max-w-2xl mx-auto"
          >
            <p className="font-sans-wide text-[11px] text-kyar-accent uppercase tracking-widest font-semibold mb-4">Start your archive</p>
            <h2 id="cta-heading" className="font-serif-elegant text-4xl sm:text-5xl lg:text-6xl font-normal mb-8">
              Elevate your cosplay management.
            </h2>
            <LandingAuthCta variant="cta" />
          </motion.div>
        </section>
      </main>

      {/* Footer */}
      <footer className={`${SECTION_PADDING} py-12 bg-kyar-bgWarm border-t border-kyar-borderSubtle ${MAX_WIDTH}`} role="contentinfo">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          <Link href="/" className="font-serif-elegant text-xl font-bold italic tracking-tighter" aria-label="Kyarafit home">
            Kyarafit
          </Link>
          <p className="text-[10px] text-kyar-meta uppercase tracking-widest font-sans-wide">
            Cosplay wardrobe & build tracker
          </p>
          <LandingAuthCta variant="footer" />
        </div>
      </footer>
    </div>
  );
}
