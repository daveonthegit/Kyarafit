"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { LandingAuthCta } from "@/components/landing/LandingAuthCta";
import { HeroVideoPlayer } from "@/components/landing/remotion/HeroVideoPlayer";
import { useRef } from "react";

const SECTION_PADDING = "px-6 sm:px-8 lg:px-12";
const MAX_WIDTH = "max-w-7xl mx-auto w-full";

// Reusable motion variants for cinematic fades
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8 } },
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
            <div className="relative aspect-video bg-[#0A0A0A] rounded-lg sm:rounded-2xl border border-kyar-border shadow-[0_40px_80px_rgba(0,0,0,0.15)] overflow-hidden flex items-center justify-center">
               <HeroVideoPlayer />
            </div>
          </motion.div>
        </section>

        {/* PRODUCT SHOWCASE (Light Mode UI - Real components) */}
        <section className={`py-24 sm:py-32 bg-kyar-bgWarm border-t border-kyar-borderSubtle text-kyar-text`} aria-labelledby="showcase-heading">
          <div className={`${SECTION_PADDING} ${MAX_WIDTH}`}>
            <motion.div 
              initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={staggerContainer}
              className="mb-16 md:mb-24 flex flex-col md:flex-row md:items-end justify-between gap-8"
            >
              <div className="max-w-2xl">
                <motion.h2 id="showcase-heading" variants={fadeUp} className="font-serif-elegant text-3xl sm:text-5xl font-normal mb-6">
                  Everything in its place.
                </motion.h2>
                <motion.p variants={fadeUp} className="text-kyar-textSecondary text-lg leading-relaxed max-w-lg">
                  Designed explicitly for the meticulous nature of cosplay. Drop the spreadsheets and focus on the details that matter.
                </motion.p>
              </div>
            </motion.div>

            {/* UI Feature Grid */}
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
              
              {/* Closet Feature */}
              <motion.div 
                initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                className="flex flex-col gap-8"
              >
                <div>
                  <h3 className="font-sans-wide text-xs uppercase tracking-widest text-kyar-accent mb-4">Digital Closet</h3>
                  <p className="font-serif-elegant text-2xl mb-2 text-kyar-text">Your entire wardrobe, visually cataloged.</p>
                </div>
                
                {/* Mock UI: Digital Closet Grid */}
                <div className="bg-white border border-kyar-borderSubtle shadow-soft rounded-2xl p-6 sm:p-8 flex-1">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {[
                      { img: "/mock/Leather_Jacket.png", name: "Leather Jacket", type: "Outerwear", cost: "$120.00" },
                      { img: "/mock/blonde_wig.jpg", name: "Blonde Wig", type: "Wig", cost: "$45.00" },
                      { img: "/mock/red_scarf.png", name: "Silk Scarf", type: "Accessory", cost: "$25.00" },
                      { img: "/mock/Utility-belt.jpg", name: "Utility Belt", type: "Accessory", cost: "$35.00", bg: "bg-kyar-mutedWarm" },
                      { img: "/mock/urahara-sword.jpg", name: "Prop Sword", type: "Prop", cost: "$85.00", bg: "bg-gray-100" },
                      { img: "/mock/wig2.jpg", name: "Styled Wig", type: "Wig", cost: "$60.00", bg: "bg-kyar-muted" },
                    ].map((item, i) => (
                      <div key={i} className="flex flex-col rounded-xl border border-kyar-borderSubtle bg-kyar-surface overflow-hidden shadow-sm transition-all hover:shadow-md group w-full relative">
                        <div className={`relative aspect-square w-full ${item.bg || "bg-kyar-muted"} overflow-hidden`}>
                           <img src={item.img} alt={item.name} className="w-full h-full object-cover opacity-90 transition-transform group-hover:scale-105 duration-500" />
                        </div>
                        <div className="p-3 bg-white flex flex-col gap-1">
                          <p className="text-kyar-text text-xs font-medium truncate">{item.name}</p>
                          <div className="flex items-center justify-between text-kyar-textTertiary text-[10px]">
                            <span>{item.type}</span>
                            <span>{item.cost}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>

              <div className="flex flex-col gap-8 lg:gap-12">
                {/* Build Feature */}
                <motion.div 
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className="flex flex-col gap-6"
                >
                  <div>
                    <h3 className="font-sans-wide text-xs uppercase tracking-widest text-kyar-accent mb-4">Build Tracking</h3>
                    <p className="font-serif-elegant text-2xl mb-2 text-kyar-text">From raw materials to finished armor.</p>
                  </div>
                  
                  {/* Mock UI: Build Progress & Tasks */}
                  <div className="bg-white border border-kyar-borderSubtle shadow-soft rounded-2xl p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row gap-6 mb-8 items-center sm:items-start">
                      <div className="relative w-28 h-28 shrink-0">
                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                          <circle cx="18" cy="18" r="15.9155" fill="none" className="stroke-kyar-borderSubtle" strokeWidth="2.5" />
                          <circle cx="18" cy="18" r="15.9155" fill="none" className="stroke-kyar-accent" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="68 100" />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="font-serif text-2xl font-semibold text-kyar-text leading-none tabular-nums">68%</span>
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-2 pt-2">
                         <div className="font-sans-wide text-[10px] uppercase tracking-[0.2em] font-semibold text-kyar-textTertiary">Status</div>
                         <div className="font-serif text-2xl text-kyar-text">In Progress</div>
                         <div className="text-sm text-kyar-textSecondary mt-2">12 of 18 tasks complete</div>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {[
                        { label: "Prime and sand shoulder pieces", checked: true },
                        { label: "Paint base coat", checked: true },
                        { label: "Add weathering details", checked: false },
                        { label: "Seal with clear coat", checked: false },
                      ].map((task, i) => (
                        <div key={i} className="flex items-center gap-3 py-1">
                          <span className={`flex-shrink-0 w-4 h-4 border border-black flex items-center justify-center rounded-sm ${task.checked ? "bg-black" : "bg-transparent"}`}>
                            {task.checked && (
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </span>
                          <span className={`text-[13px] font-sans-wide font-semibold uppercase tracking-wide ${task.checked ? "opacity-40 line-through" : "text-kyar-text"}`}>
                            {task.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>

                {/* Events Feature */}
                <motion.div 
                  initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}
                  className="flex flex-col gap-6"
                >
                  <div>
                    <h3 className="font-sans-wide text-xs uppercase tracking-widest text-kyar-accent mb-4">Conventions</h3>
                    <p className="font-serif-elegant text-2xl mb-2 text-kyar-text">Lineups and packing lists, automated.</p>
                  </div>
                  
                  {/* Mock UI: Event Calendar & Packing */}
                  <div className="bg-white border border-kyar-borderSubtle shadow-soft rounded-2xl p-6 sm:p-8">
                    <div className="flex gap-4 overflow-hidden mb-6">
                      {[
                        { day: "Fri", label: "Casual", active: false },
                        { day: "Sat", label: "Competition", active: true },
                        { day: "Sun", label: "Photoshoot", active: false }
                      ].map((item, idx) => (
                        <div key={idx} className={`flex-1 rounded-xl p-4 transition-colors ${item.active ? 'border-2 border-kyar-accent bg-kyar-accent/5' : 'border border-kyar-borderSubtle bg-kyar-surface'}`}>
                          <div className={`text-[10px] font-sans-wide uppercase tracking-widest mb-1 font-semibold ${item.active ? 'text-kyar-accent' : 'text-kyar-textTertiary'}`}>{item.day}</div>
                          <div className="text-sm font-medium text-kyar-text truncate">{item.label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-kyar-borderSubtle pt-4">
                      <div className="text-[10px] font-sans-wide uppercase tracking-widest text-kyar-textTertiary mb-3 font-semibold">Saturday Packing List</div>
                      <div className="space-y-3">
                         <div className="flex items-center gap-3">
                           <span className="flex-shrink-0 w-4 h-4 border border-black bg-black flex items-center justify-center rounded-sm">
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                           </span>
                           <span className="text-[13px] font-sans-wide font-semibold uppercase tracking-wide opacity-40 line-through">Armor Chestplate</span>
                         </div>
                         <div className="flex items-center gap-3">
                           <span className="flex-shrink-0 w-4 h-4 border border-black flex items-center justify-center rounded-sm"></span>
                           <span className="text-[13px] font-sans-wide font-semibold uppercase tracking-wide text-kyar-text">Undergarments (Black)</span>
                         </div>
                      </div>
                    </div>
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
              {/* Desktop Mockup Layout */}
              <div className="absolute right-0 lg:-right-12 top-0 w-full max-w-[600px] aspect-video bg-white border border-kyar-border shadow-soft rounded-md overflow-hidden flex flex-col">
                <div className="h-6 border-b border-kyar-borderSubtle bg-kyar-bgWarm flex items-center px-3 gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-kyar-border" />
                  <div className="w-2 h-2 rounded-full bg-kyar-border" />
                  <div className="w-2 h-2 rounded-full bg-kyar-border" />
                </div>
                <div className="flex-1 bg-[#FAFAFA] flex">
                  {/* Sidebar */}
                  <div className="w-48 h-full bg-kyar-bgWarm border-r border-kyar-borderSubtle flex flex-col py-4 px-3 gap-4">
                     <div className="font-serif-elegant italic text-sm font-bold px-2">Kyarafit</div>
                     <div className="flex flex-col gap-1">
                       <div className="text-[10px] font-sans-wide uppercase tracking-widest text-kyar-textTertiary px-2 mb-1">Menu</div>
                       <div className="text-xs bg-kyar-muted rounded px-2 py-1.5 font-medium">Closet</div>
                       <div className="text-xs text-kyar-textSecondary px-2 py-1.5">Builds</div>
                       <div className="text-xs text-kyar-textSecondary px-2 py-1.5">Events</div>
                     </div>
                  </div>
                  {/* Content */}
                  <div className="flex-1 p-6 flex flex-col gap-4 overflow-hidden">
                    <div className="font-serif-elegant text-xl">Digital Closet</div>
                    <div className="grid grid-cols-3 gap-3">
                       {[
                         { img: "/mock/Leather_Jacket.png", name: "Jacket" },
                         { img: "/mock/blonde_wig.jpg", name: "Wig" },
                         { img: "/mock/urahara-sword.jpg", name: "Sword" }
                       ].map((item, i) => (
                         <div key={i} className="bg-white border border-kyar-borderSubtle rounded-lg overflow-hidden shadow-sm">
                           <div className="aspect-square bg-kyar-muted relative">
                              <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
                           </div>
                           <div className="p-2 text-[10px] font-medium truncate">{item.name}</div>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Mobile overlay */}
              <div className="absolute left-4 lg:left-0 bottom-0 w-[220px] h-[450px] bg-white border-[6px] border-[#E5E5E5] shadow-2xl rounded-3xl p-1 z-10">
                <div className="w-full h-full bg-[#FAFAFA] border border-kyar-borderSubtle rounded-2xl overflow-hidden flex flex-col relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-[#E5E5E5] rounded-b-xl z-20" />
                  <div className="h-28 bg-kyar-accent p-4 flex flex-col justify-end text-white relative overflow-hidden">
                     <img src="/mock/katsucon.png" alt="Convention Background" className="absolute inset-0 w-full h-full object-cover opacity-40 mix-blend-overlay" />
                     <div className="relative z-10">
                       <div className="font-serif-elegant text-xl">Katsu 2026</div>
                       <div className="text-[10px] font-sans-wide uppercase tracking-wider opacity-80">Packing List</div>
                     </div>
                  </div>
                  <div className="flex-1 p-3 flex flex-col gap-2 bg-white">
                    {[
                      { label: "Chestplate", checked: true },
                      { label: "Undergarments", checked: false },
                      { label: "Boots", checked: false },
                    ].map((task, i) => (
                       <div key={i} className="flex items-center gap-2 border-b border-kyar-borderSubtle/50 pb-2">
                         <span className={`flex-shrink-0 w-3 h-3 border border-black flex items-center justify-center rounded-sm ${task.checked ? "bg-black" : "bg-transparent"}`}>
                           {task.checked && (
                             <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                               <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                             </svg>
                           )}
                         </span>
                         <span className={`text-[10px] font-sans-wide font-semibold uppercase tracking-wide ${task.checked ? "opacity-40 line-through" : "text-kyar-text"}`}>
                           {task.label}
                         </span>
                       </div>
                    ))}
                  </div>
                  <div className="h-12 border-t border-kyar-borderSubtle bg-kyar-bgWarm flex items-center justify-around px-2 text-kyar-textTertiary">
                     <span className="material-symbols-outlined text-lg">checkroom</span>
                     <span className="material-symbols-outlined text-lg">architecture</span>
                     <span className="material-symbols-outlined text-lg text-kyar-accent">calendar_month</span>
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
